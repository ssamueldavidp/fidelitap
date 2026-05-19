import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export async function validateAppleWebServiceAuth(
  request: Request,
  serialNumber: string
): Promise<{ valid: true; customerCardId: string } | { valid: false }> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('ApplePass ')) return { valid: false }
  const providedToken = auth.slice('ApplePass '.length).trim()

  const supabase = createServiceClient()
  const { data: cc } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
    .eq('wallet_pass_serial', serialNumber)
    .maybeSingle()

  if (!cc?.wallet_auth_token) return { valid: false }

  const stored = Buffer.from(cc.wallet_auth_token)
  const provided = Buffer.from(providedToken)
  if (
    stored.length !== provided.length ||
    !timingSafeEqual(stored, provided)
  ) {
    return { valid: false }
  }

  return { valid: true, customerCardId: cc.id }
}
