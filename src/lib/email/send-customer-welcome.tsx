import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { CustomerWelcomeEmail } from './templates/customer-welcome'

export async function sendCustomerWelcome(params: {
  to: string
  customerName: string
  businessName: string
  cardUrl: string
}): Promise<void> {
  try {
    const html = await render(
      <CustomerWelcomeEmail
        customerName={params.customerName}
        businessName={params.businessName}
        cardUrl={params.cardUrl}
      />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `¡Tu tarjeta de ${params.businessName} está lista!`,
      html,
    })
  } catch (err) {
    console.error('[email] sendCustomerWelcome failed:', err)
  }
}
