import { render } from '@react-email/render'
import { getResend, FROM, APP_URL } from './client'
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
        appUrl={APP_URL}
      />
    )
    await getResend().emails.send({
      from: FROM,
      to: params.to,
      subject: `¡Completaste tu tarjeta de ${params.businessName}!`,
      html,
    })
  } catch (err) {
    console.error('[email] sendCardComplete failed:', err)
  }
}
