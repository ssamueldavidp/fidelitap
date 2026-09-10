import { Resend } from 'resend'

let client: Resend | null = null

export function getResend(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada')
    }
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export const FROM = process.env.RESEND_FROM ?? 'FideliTap <noreply@fidelitap.co>'
