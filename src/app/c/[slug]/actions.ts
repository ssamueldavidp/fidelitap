'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'

const schema = z.object({
  name:            z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email:           z.string().email('Email inválido').toLowerCase(),
  phone:           z.string().max(20).trim().optional(),
  data_consent:    z.literal('true').refine(v => v === 'true', 'Debes aceptar el tratamiento de datos para continuar.'),
  marketing:       z.string().optional(),
  loyalty_card_id: z.string().uuid(),
  business_id:     z.string().uuid(),
})

const recoverSchema = z.object({
  email:           z.string().email('Email inválido').toLowerCase(),
  loyalty_card_id: z.string().uuid(),
})

export type ActivateResult =
  | { error: string }
  | { customerCardId: string; walletAuthToken: string; alreadyHadCard: boolean }

export async function activateCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = schema.safeParse({
    name:            formData.get('name'),
    email:           formData.get('email'),
    phone:           formData.get('phone') || undefined,
    data_consent:    formData.get('data_consent'),
    marketing:       formData.get('marketing') || undefined,
    loyalty_card_id: formData.get('loyalty_card_id'),
    business_id:     formData.get('business_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, email, phone, marketing, loyalty_card_id, business_id } = parsed.data
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
    .select('id, wallet_auth_token')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (existing) {
    return {
      customerCardId:  existing.id,
      walletAuthToken: existing.wallet_auth_token!,
      alreadyHadCard:  true,
    }
  }

  // 3. Create new card
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
    .select('id, wallet_auth_token')
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
  }
}

// Recover an existing card using only email
export async function recoverCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = recoverSchema.safeParse({
    email:           formData.get('email'),
    loyalty_card_id: formData.get('loyalty_card_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, loyalty_card_id } = parsed.data
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
    .select('id, wallet_auth_token')
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
  }
}
