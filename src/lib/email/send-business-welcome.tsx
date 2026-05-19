import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { BusinessWelcomeEmail } from './templates/business-welcome'

export async function sendBusinessWelcome(params: {
  to: string
  businessName: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  try {
    const html = await render(
      <BusinessWelcomeEmail businessName={params.businessName} appUrl={appUrl} />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Bienvenido a FideliTap, ${params.businessName}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendBusinessWelcome failed:', err)
  }
}
