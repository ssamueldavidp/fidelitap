import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { CardCompleteEmail } from './templates/card-complete'

export async function sendCardComplete(params: {
  to: string
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
}): Promise<void> {
  try {
    const html = await render(
      <CardCompleteEmail
        customerName={params.customerName}
        businessName={params.businessName}
        appleWalletUrl={params.appleWalletUrl}
        googleWalletUrl={params.googleWalletUrl}
      />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `¡Completaste tu tarjeta de ${params.businessName}! 🎉`,
      html,
    })
  } catch (err) {
    console.error('[email] sendCardComplete failed:', err)
  }
}
