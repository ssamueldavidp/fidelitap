import { createHmac } from 'crypto'

export function generateUniqueCode(customerCardId: string, businessId: string): string {
  return createHmac('sha256', process.env.APP_HMAC_SECRET!)
    .update(`${customerCardId}.${businessId}`)
    .digest('hex')
}
