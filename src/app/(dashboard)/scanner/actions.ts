'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendApnsPush } from '@/lib/wallet/apns'
import { updateGoogleWalletStamps } from '@/lib/wallet/google'

export type StampResult =
  | { error: string }
  | {
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
    }

export async function addStampAction(uniqueCode: string): Promise<StampResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
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
      customers ( name )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()

  if (!ccRaw) return { error: 'Código QR inválido' }

  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string } | null
  }

  const card = cc.loyalty_cards
  if (!card || card.business_id !== business.id) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  const { data: stampResult, error: rpcError } = await serviceClient.rpc('add_stamp', {
    p_card_id: cc.id,
  })

  if (rpcError || !stampResult) return { error: 'Error al agregar sello' }

  const { current_stamps: currentStamps, is_complete: isComplete, times_completed: timesCompleted } =
    stampResult as { current_stamps: number; is_complete: boolean; times_completed: number }

  await serviceClient.from('stamp_events').insert({
    customer_card_id: cc.id,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
  })

  const { data: registrations } = await serviceClient
    .from('device_registrations')
    .select('push_token')
    .eq('serial_number', cc.wallet_pass_serial ?? '')

  const pushTokens = registrations?.map((r) => r.push_token) ?? []

  Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
  ]).catch(() => {})

  return {
    customerName: cc.customers?.name ?? 'Cliente',
    currentStamps,
    stampsRequired: card.stamps_required,
    isComplete,
    timesCompleted,
  }
}
