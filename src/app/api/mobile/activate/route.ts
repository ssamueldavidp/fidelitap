import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'

// Lets a brand-new customer create their card entirely inside the app —
// scan a business's QR (or enter its slug), fill in name/email, done.
// Mirrors src/app/c/[slug]/actions.ts's activateCardAction, but links the
// new customer_cards row directly to the caller's auth uid instead of
// requiring a separate claim_customer_card RPC call afterwards.
const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email: z.string().email('Email inválido').toLowerCase().trim(),
  phone: z.string().max(20).trim().optional(),
  data_consent: z.literal(true, { message: 'Debes aceptar el tratamiento de datos para continuar.' }),
  marketing_consent: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { slug, name, email, phone, marketing_consent } = parsed.data

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
  let { data: customer } = await serviceClient
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer, error: insertErr } = await serviceClient
      .from('customers')
      .insert({ email, name, phone: phone ?? null, marketing_consent })
      .select('id')
      .single()
    if (insertErr || !newCustomer) return NextResponse.json({ error: 'Error al registrarte. Intenta de nuevo.' }, { status: 500 })
    customer = newCustomer
  } else if (phone || marketing_consent) {
    await serviceClient
      .from('customers')
      .update({ ...(phone ? { phone } : {}), ...(marketing_consent ? { marketing_consent: true } : {}) })
      .eq('id', customer.id)
  }

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
      customerName: name,
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
