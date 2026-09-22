import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'
import { customerProfileSchema, findOrCreateCustomer } from '@/lib/mobile/customer-registration'

// Lets a brand-new customer create their card entirely inside the app —
// scan a business's QR (or enter its slug), fill in name/email, done.
// Mirrors src/app/c/[slug]/actions.ts's activateCardAction, but links the
// new customer_cards row directly to the caller's auth uid instead of
// requiring a separate claim_customer_card RPC call afterwards.
const bodySchema = customerProfileSchema.extend({
  slug: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { slug, email } = parsed.data

  const serviceClient = createServiceClient()

  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, business_id, stamps_required, businesses(name, plan)')
    .eq('slug', slug)
    .is('deleted_at', null)
    .eq('is_active', true)
    .single()
  if (!card) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const business = card.businesses as unknown as { name: string; plan: string } | null

  // 1. Find or create the customer by email
  const customer = await findOrCreateCustomer(serviceClient, parsed.data)
  if (!customer) return NextResponse.json({ error: 'Error al registrarte. Intenta de nuevo.' }, { status: 500 })

  // 2. Anti-fraud: one email = one card per business. Already have one? Just link it.
  const { data: existing } = await serviceClient
    .from('customer_cards')
    .select('id, wallet_auth_token, current_stamps, status')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', card.id)
    .maybeSingle()

  if (existing) {
    await serviceClient
      .from('customer_cards')
      .update({ linked_auth_user_id: user.id })
      .eq('id', existing.id)
    return NextResponse.json({
      customer_card_id: existing.id,
      business_name: business?.name ?? '',
      card_name: '',
      stamps_required: card.stamps_required,
      current_stamps: existing.current_stamps,
      status: existing.status,
      already_had_card: true,
    })
  }

  // 3. Enforce maxCustomers plan limit (same rule as the web activation flow)
  const { data: bizCards } = await serviceClient
    .from('loyalty_cards')
    .select('id')
    .eq('business_id', card.business_id)
    .is('deleted_at', null)
  const bizCardIds = (bizCards ?? []).map((c) => c.id)
  const { data: customerRows } = bizCardIds.length > 0
    ? await serviceClient.from('customer_cards').select('customer_id').in('loyalty_card_id', bizCardIds)
    : { data: [] }
  const customerCount = new Set((customerRows ?? []).map((r) => r.customer_id)).size
  const limits = getPlanLimits(business?.plan ?? 'free')
  if (isAtLimit(customerCount, limits.maxCustomers)) {
    return NextResponse.json({ error: 'Este negocio alcanzó el límite de clientes de su plan.' }, { status: 403 })
  }

  // 4. Create the card, linked to this device's session right away
  const newId = crypto.randomUUID()
  const unique_code = generateUniqueCode(newId, card.business_id)

  const { data: newCard, error: cardErr } = await serviceClient
    .from('customer_cards')
    .insert({
      id: newId,
      customer_id: customer.id,
      loyalty_card_id: card.id,
      unique_code,
      wallet_pass_serial: crypto.randomUUID(),
      wallet_auth_token: crypto.randomUUID(),
      linked_auth_user_id: user.id,
    })
    .select('id, current_stamps, status')
    .single()
  if (cardErr || !newCard) return NextResponse.json({ error: 'Error al activar la tarjeta. Intenta de nuevo.' }, { status: 500 })

  if (business) {
    void sendCustomerWelcome({
      to: email,
      customerName: parsed.data.name,
      businessName: business.name,
      cardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'}/c/${slug}`,
    })
  }

  return NextResponse.json({
    customer_card_id: newCard.id,
    business_name: business?.name ?? '',
    stamps_required: card.stamps_required,
    current_stamps: newCard.current_stamps,
    status: newCard.status,
    already_had_card: false,
  }, { status: 201 })
}
