import type { SupabaseClient } from '@supabase/supabase-js'
import { sendApnsPush } from '@/lib/wallet/apns'
import { updateGoogleWalletStamps } from '@/lib/wallet/google'
import { sendCardComplete } from '@/lib/email/send-card-complete'
import { sendPushToCustomerCard } from '@/lib/push/send'
import { isPushEligible } from '@/lib/push/eligibility'

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

export interface AddStampParams {
  serviceClient: SupabaseClient
  businessId: string
  businessName: string
  businessPlan: string
  businessSubscriptionStatus: string | null
  stampCooldownSeconds: number
  ownerId: string
  uniqueCode: string
}

// Single source of truth for "add a stamp" — called by both the web
// dashboard scanner (src/app/(dashboard)/scanner/actions.ts) and the
// Flutter app's scanner (src/app/api/mobile/add-stamp/route.ts). Keep it
// that way: this used to be duplicated between the two call sites and the
// implementations drifted (web had Web Push progress/completion
// notifications, mobile had multi-level card_rewards support for the
// Google Wallet label — neither client had both).
export async function addStampForBusiness(params: AddStampParams): Promise<StampResult> {
  const {
    serviceClient,
    businessId,
    businessName,
    businessPlan,
    businessSubscriptionStatus,
    stampCooldownSeconds,
    ownerId,
    uniqueCode,
  } = params

  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      near_completion_notified_at,
      loyalty_cards ( id, stamps_required, benefit_description, business_id, push_notify_threshold ),
      customers ( name, email )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()

  if (!ccRaw) return { error: 'Código QR inválido' }

  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    near_completion_notified_at: string | null
    loyalty_cards: {
      id: string
      stamps_required: number
      benefit_description: string | null
      business_id: string
      push_notify_threshold: number
    } | null
    customers: { name: string; email: string | null } | null
  }

  const card = cc.loyalty_cards
  if (!card || card.business_id !== businessId) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  // Cooldown check — only count 'stamp' type events
  if (stampCooldownSeconds > 0) {
    const { data: lastStamp } = await serviceClient
      .from('stamp_events')
      .select('created_at')
      .eq('customer_card_id', cc.id)
      .eq('type', 'stamp')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastStamp) {
      const secondsSinceLast = (Date.now() - new Date(lastStamp.created_at).getTime()) / 1000
      if (secondsSinceLast < stampCooldownSeconds) {
        const waitMinutes = Math.ceil((stampCooldownSeconds - secondsSinceLast) / 60)
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

  // Fetch next reward label for multi-level cards
  const { data: cardRewards } = await serviceClient
    .from('card_rewards')
    .select('stamps_required, reward_label')
    .eq('loyalty_card_id', card.id)
    .order('stamps_required', { ascending: true })

  const nextReward = (cardRewards ?? []).find((r) => r.stamps_required > currentStamps)
  const nextRewardLabel = nextReward?.reward_label

  // Record stamp event with type='stamp'
  await serviceClient.from('stamp_events').insert({
    customer_card_id: cc.id,
    business_id: businessId,
    stamped_by: ownerId,
    scan_token: crypto.randomUUID(),
    type: 'stamp',
  })

  const remaining = card.stamps_required - currentStamps
  const shouldNotifyProgress =
    !isComplete &&
    remaining === card.push_notify_threshold &&
    !cc.near_completion_notified_at &&
    isPushEligible(businessPlan, businessSubscriptionStatus)

  const { error: progressUpdateError } = await serviceClient
    .from('customer_cards')
    .update({
      last_stamp_at: new Date().toISOString(),
      ...(shouldNotifyProgress ? { near_completion_notified_at: new Date().toISOString() } : {}),
    })
    .eq('id', cc.id)

  if (progressUpdateError) {
    console.error('[addStamp] failed to update last_stamp_at/near_completion_notified_at', progressUpdateError)
  }

  let pushTokens: string[] = []
  if (cc.wallet_pass_serial) {
    const { data: registrations } = await serviceClient
      .from('device_registrations')
      .select('push_token')
      .eq('serial_number', cc.wallet_pass_serial)
    pushTokens = registrations?.map((r) => r.push_token) ?? []
  }

  const skipWalletUpdate = businessPlan === 'free'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const customerEmail = cc.customers?.email
  const sideEffectNames = [
    'apns_push',
    'google_wallet_update',
    'completion_email',
    'progress_web_push',
    'completion_web_push',
  ]
  void Promise.allSettled([
    !skipWalletUpdate && pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    !skipWalletUpdate
      ? updateGoogleWalletStamps(cc.id, card.id, currentStamps, nextRewardLabel)
      : Promise.resolve(),
    isComplete && customerEmail
      ? sendCardComplete({
          to: customerEmail,
          customerName: cc.customers?.name ?? 'Cliente',
          businessName,
          appleWalletUrl: `${appUrl}/api/wallet/apple/${cc.id}`,
          googleWalletUrl: `${appUrl}/api/wallet/google/${cc.id}`,
        })
      : Promise.resolve(),
    shouldNotifyProgress
      ? sendPushToCustomerCard(serviceClient, cc.id, {
          title: `⭐ Sellos en ${businessName}`,
          body: `Llevas ${currentStamps} de ${card.stamps_required} sellos. ¡Ya casi tienes tu premio!`,
        })
      : Promise.resolve(),
    isComplete && isPushEligible(businessPlan, businessSubscriptionStatus)
      ? sendPushToCustomerCard(serviceClient, cc.id, {
          title: '🎉 ¡Premio listo!',
          body: `Completaste tu tarjeta en ${businessName}. Muéstrala en caja para reclamar${card.benefit_description ? ': ' + card.benefit_description : ' tu premio'}.`,
        })
      : Promise.resolve(),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[addStamp] ${sideEffectNames[i]} failed for customer_card ${cc.id}:`, r.reason)
      }
    })
  })

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

export async function claimRewardForBusiness(
  serviceClient: SupabaseClient,
  businessId: string,
  ownerId: string,
  customerCardId: string
): Promise<ClaimResult> {
  const { data: cc } = await serviceClient
    .from('customer_cards')
    .select('id, loyalty_cards(business_id)')
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc) return { error: 'Tarjeta no encontrada' }

  const lcRaw = cc.loyalty_cards as unknown as { business_id: string } | null
  if (!lcRaw || lcRaw.business_id !== businessId) {
    return { error: 'No autorizado' }
  }

  const { data: claimResult, error: rpcError } = await serviceClient.rpc('claim_reward', {
    p_card_id: customerCardId,
  })

  if (rpcError || !claimResult) {
    return { error: 'Error al reclamar el premio' }
  }

  const result = claimResult as { times_completed?: number; status?: string }

  await serviceClient.from('stamp_events').insert({
    customer_card_id: customerCardId,
    business_id: businessId,
    stamped_by: ownerId,
    scan_token: crypto.randomUUID(),
    type: 'reward_claimed',
  })

  await serviceClient
    .from('customer_cards')
    .update({ near_completion_notified_at: null })
    .eq('id', customerCardId)

  return {
    timesCompleted: result.times_completed ?? 0,
    status: (result.status ?? 'active') as CardStatus,
  }
}
