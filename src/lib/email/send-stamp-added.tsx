import { render } from '@react-email/render'
import { getResend, FROM, APP_URL } from './client'
import { StampAddedEmail } from './templates/stamp-added'

export async function sendStampAdded(params: {
  to: string
  customerName: string
  businessName: string
  currentStamps: number
  stampsRequired: number
  benefit?: string | null
  appleWalletUrl: string
  googleWalletUrl: string
}): Promise<void> {
  try {
    const html = await render(
      <StampAddedEmail
        customerName={params.customerName}
        businessName={params.businessName}
        currentStamps={params.currentStamps}
        stampsRequired={params.stampsRequired}
        benefit={params.benefit}
        appleWalletUrl={params.appleWalletUrl}
        googleWalletUrl={params.googleWalletUrl}
        appUrl={APP_URL}
      />
    )
    await getResend().emails.send({
      from: FROM,
      to: params.to,
      subject: `Sumaste un sello en ${params.businessName} (${params.currentStamps}/${params.stampsRequired})`,
      html,
    })
  } catch (err) {
    console.error('[email] sendStampAdded failed:', err)
  }
}
