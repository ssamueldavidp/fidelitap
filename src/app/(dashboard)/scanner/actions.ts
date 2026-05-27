'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendApnsPush } from '@/lib/wallet/apns'
import { updateGoogleWalletStamps } from '@/lib/wallet/google'
import { sendCardComplete } from '@/lib/email/send-card-complete'

export type CardStatus = 'active' | 'ready_to_claim' | 'claimed'

export type StampResult =
  | { error: string }
  | {
      customerCardId: string
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
      status: CardStatus
    }

export type ClaimResult =
  | { error: string }
  | { timesCompleted: number; status: CardStatus }

export async function addStampAction(uniqueCode: string): Promise<StampResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const serviceClient = createServiceClient()

  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      loyalty_cards ( id, stamps_required, business_id ),
      customers ( name, email )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()

  if (!ccRaw) return { error: 'Código QR inválido' }

  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string; email: string | null } | null
  }

  const card = cc.loyalty_cards
  if (!card || card.business_id !== business.id) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  // Cooldown check — only count 'stamp' type events
  if (business.stamp_cooldown_seconds > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastStamp } = await (serviceClient.from('stamp_events') as any)
      .select('created_at')
      .eq('customer_card_id', cc.id)
      .eq('type', 'stamp')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { created_at: string } | null }

    if (lastStamp) {
      const secondsSinceLast = (Date.now() - new Date(lastStamp.created_at).getTime()) / 1000
      if (secondsSinceLast < business.stamp_cooldown_seconds) {
        const waitMinutes = Math.ceil((business.stamp_cooldown_seconds - secondsSinceLast) / 60)
        return { error: `Espera ${waitMinutes} min antes del próximo sello` }
      }
    }
  }

  const { data: stampResult, error: rpcError } = await serviceClient.rpc('add_stamp', {
    p_card_id: cc.id,
  })

  if (rpcError || !stampResult) return { error: 'Error al agregar sello' }

  const result = stampResult as {
    current_stamps?: number
    is_complete?: boolean
    times_completed?: number
    status?: string
  }

  if (
    result.current_stamps === undefined ||
    result.is_complete === undefined ||
    result.times_completed === undefined
  ) {
    return { error: 'Error al agregar sello' }
  }

  const currentStamps = result.current_stamps
  const isComplete = result.is_complete
  const timesCompleted = result.times_completed
  const status = (result.status ?? 'active') as CardStatus

  // Record stamp event with type='stamp'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('stamp_events') as any).insert({
    customer_card_id: cc.id,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'stamp',
  })

  let pushTokens: string[] = []
  if (cc.wallet_pass_serial) {
    const { data: registrations } = await serviceClient
      .from('device_registrations')
      .select('push_token')
      .eq('serial_number', cc.wallet_pass_serial)
    pushTokens = registrations?.map((r) => r.push_token) ?? []
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const customerEmail = cc.customers?.email
  void Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
    isComplete && customerEmail
      ? sendCardComplete({
          to: customerEmail,
          customerName: cc.customers?.name ?? 'Cliente',
          businessName: business.name,
          appleWalletUrl: `${appUrl}/api/wallet/apple/${cc.id}`,
          googleWalletUrl: `${appUrl}/api/wallet/google/${cc.id}`,
        })
      : Promise.resolve(),
  ])

  return {
    customerCardId: cc.id,
    customerName: cc.customers?.name ?? 'Cliente',
    currentStamps,
    stampsRequired: card.stamps_required,
    isComplete,
    timesCompleted,
    status,
  }
}

export async function claimRewardAction(customerCardId: string): Promise<ClaimResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const serviceClient = createServiceClient()

  // Verify the card belongs to this business
  const { data: cc } = await serviceClient
    .from('customer_cards')
    .select('id, loyalty_cards(business_id)')
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc) return { error: 'Tarjeta no encontrada' }

  const lcRaw = cc.loyalty_cards as unknown as { business_id: string } | null
  if (!lcRaw || lcRaw.business_id !== business.id) {
    return { error: 'No autorizado' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claimResult, error: rpcError } = await (serviceClient as any).rpc('claim_reward', {
    p_card_id: customerCardId,
  }) as { data: { times_completed?: number; status?: string } | null; error: unknown }

  if (rpcError || !claimResult) {
    return { error: 'Error al reclamar el premio' }
  }

  const result = claimResult as { times_completed?: number; status?: string }

  // Record reward_claimed event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from('stamp_events') as any).insert({
    customer_card_id: customerCardId,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'reward_claimed',
  })

  return {
    timesCompleted: result.times_completed ?? 0,
    status: (result.status ?? 'active') as CardStatus,
  }
}
