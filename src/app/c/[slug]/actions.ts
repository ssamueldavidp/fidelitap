'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'
import { emailSchema } from '@/lib/validations/common'
import { sendEmailCode, verifyEmailCode } from '@/lib/email-otp'

const BAD_CODE = 'El código es incorrecto o venció. Pide uno nuevo.'

// Step 1 of activation/recovery: email a 6-digit code to prove the address is theirs.
// Disposable domains are rejected here too so no code is even sent to them.
export async function sendEmailCodeAction(email: string): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(email)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const ok = await sendEmailCode(parsed.data)
  return ok ? {} : { error: 'No pudimos enviar el código. Intenta de nuevo en un minuto.' }
}

const schema = z.object({
  name:            z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email:           emailSchema,
  phone:           z.string().max(20).trim().optional(),
  data_consent:    z.literal('true').refine(v => v === 'true', 'Debes aceptar el tratamiento de datos para continuar.'),
  marketing:       z.string().optional(),
  loyalty_card_id: z.string().uuid(),
  business_id:     z.string().uuid(),
  code:            z.string(),
})

const recoverSchema = z.object({
  email:           z.string().email('Email inválido').toLowerCase(),
  loyalty_card_id: z.string().uuid(),
  code:            z.string(),
})

export type ActivateResult =
  | { error: string }
  | { customerCardId: string; walletAuthToken: string; alreadyHadCard: boolean; uniqueCode: string }

export async function activateCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = schema.safeParse({
    name:            formData.get('name'),
    email:           formData.get('email'),
    phone:           formData.get('phone') || undefined,
    data_consent:    formData.get('data_consent'),
    marketing:       formData.get('marketing') || undefined,
    loyalty_card_id: formData.get('loyalty_card_id'),
    business_id:     formData.get('business_id'),
    code:            formData.get('code') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, email, phone, marketing, loyalty_card_id, business_id } = parsed.data
  if (!(await verifyEmailCode(email, parsed.data.code))) return { error: BAD_CODE }
  const marketingConsent = marketing === 'true'
  const supabase = createServiceClient()

  // Fetch card info for welcome email
  const { data: cardInfo } = (await supabase
    .from('loyalty_cards')
    .select('slug, businesses(name)')
    .eq('id', loyalty_card_id)
    .single()) as { data: { slug: string; businesses: { name: string } | null } | null; error: unknown }

  // 1. Find existing customer by email
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({
        email,
        name,
        phone:              phone ?? null,
        marketing_consent:  marketingConsent,
      })
      .select('id')
      .single()
    if (insertErr || !newCustomer) return { error: 'Error al registrarte. Intenta de nuevo.' }
    customer = newCustomer
  } else {
    // Update phone/marketing if provided on re-activation
    if (phone) {
      await supabase.from('customers').update({ phone }).eq('id', customer.id)
    }
    if (marketingConsent) {
      await supabase.from('customers').update({ marketing_consent: true }).eq('id', customer.id)
    }
  }

  // 2. Check existing card (anti-fraud + recovery)
  const { data: existing } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token, unique_code')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (existing) {
    return {
      customerCardId:  existing.id,
      walletAuthToken: existing.wallet_auth_token!,
      alreadyHadCard:  true,
      uniqueCode:      existing.unique_code,
    }
  }

  // 3. Enforce maxCustomers plan limit — count distinct customers already
  // linked to any of this business's cards (mirrors plan-usage.tsx's query)
  const { data: business } = await supabase
    .from('businesses')
    .select('plan')
    .eq('id', business_id)
    .single()

  if (business) {
    const { data: bizCards } = await supabase
      .from('loyalty_cards')
      .select('id')
      .eq('business_id', business_id)
      .is('deleted_at', null)

    const bizCardIds = (bizCards ?? []).map((c) => c.id)
    const { data: customerRows } = bizCardIds.length > 0
      ? await supabase
          .from('customer_cards')
          .select('customer_id')
          .in('loyalty_card_id', bizCardIds)
      : { data: [] }

    const customerCount = new Set((customerRows ?? []).map((r) => r.customer_id)).size
    const limits = getPlanLimits(business.plan)
    if (isAtLimit(customerCount, limits.maxCustomers)) {
      return { error: 'Este negocio alcanzó el límite de clientes de su plan. Contáctalo directamente para más información.' }
    }
  }

  // 4. Create new card
  const newId      = crypto.randomUUID()
  const unique_code = generateUniqueCode(newId, business_id)

  const { data: newCard, error: cardErr } = await supabase
    .from('customer_cards')
    .insert({
      id:                newId,
      customer_id:       customer.id,
      loyalty_card_id,
      unique_code,
      wallet_pass_serial: crypto.randomUUID(),
      wallet_auth_token:  crypto.randomUUID(),
    })
    .select('id, wallet_auth_token, unique_code')
    .single()

  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const biz    = cardInfo?.businesses
  if (biz && cardInfo?.slug) {
    void sendCustomerWelcome({
      to:           email,
      customerName: name,
      businessName: biz.name,
      cardUrl:      `${appUrl}/c/${cardInfo.slug}`,
    })
  }

  return {
    customerCardId:  newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard:  false,
    uniqueCode:      newCard.unique_code,
  }
}

// Recover an existing card — requires proving ownership of the email (emailed code)
export async function recoverCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = recoverSchema.safeParse({
    email:           formData.get('email'),
    loyalty_card_id: formData.get('loyalty_card_id'),
    code:            formData.get('code') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, loyalty_card_id } = parsed.data
  if (!(await verifyEmailCode(email, parsed.data.code))) return { error: BAD_CODE }
  const supabase = createServiceClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    return { error: 'No encontramos ninguna tarjeta con ese email. Verifica o actívala de nuevo.' }
  }

  const { data: card } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token, unique_code')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (!card) {
    return { error: 'No tienes esta tarjeta activada. Usa el formulario de arriba para activarla.' }
  }

  return {
    customerCardId:  card.id,
    walletAuthToken: card.wallet_auth_token!,
    alreadyHadCard:  true,
    uniqueCode:      card.unique_code,
  }
}
