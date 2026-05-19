'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email: z.string().email('Email inválido').toLowerCase(),
  loyalty_card_id: z.string().uuid(),
  business_id: z.string().uuid(),
})

export type ActivateResult =
  | { error: string }
  | { customerCardId: string; walletAuthToken: string; alreadyHadCard: boolean }

export async function activateCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    loyalty_card_id: formData.get('loyalty_card_id'),
    business_id: formData.get('business_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, email, loyalty_card_id, business_id } = parsed.data
  const supabase = createServiceClient()

  // Fetch card slug + business name for the welcome email
  const { data: cardInfo } = (await supabase
    .from('loyalty_cards')
    .select('slug, businesses(name)')
    .eq('id', loyalty_card_id)
    .single()) as { data: { slug: string; businesses: { name: string } | null } | null; error: unknown }

  // 1. Find or create customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({ email, name })
      .select('id')
      .single()
    if (insertErr || !newCustomer) return { error: 'Error al registrarte. Intenta de nuevo.' }
    customer = newCustomer
  }

  // 2. Find or create customer_card
  const { data: existing } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (existing) {
    return {
      customerCardId: existing.id,
      walletAuthToken: existing.wallet_auth_token!,
      alreadyHadCard: true,
    }
  }

  // Pre-generate ID so we can use it in unique_code
  const newId = crypto.randomUUID()
  const unique_code = generateUniqueCode(newId, business_id)

  const { data: newCard, error: cardErr } = await supabase
    .from('customer_cards')
    .insert({
      id: newId,
      customer_id: customer.id,
      loyalty_card_id,
      unique_code,
      wallet_pass_serial: crypto.randomUUID(),
      wallet_auth_token: crypto.randomUUID(),
    })
    .select('id, wallet_auth_token')
    .single()

  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  // Send welcome email fire-and-forget
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const biz = cardInfo?.businesses
  if (biz && cardInfo?.slug) {
    void sendCustomerWelcome({
      to: email,
      customerName: name,
      businessName: biz.name,
      cardUrl: `${appUrl}/c/${cardInfo.slug}`,
    })
  }

  return {
    customerCardId: newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard: false,
  }
}
