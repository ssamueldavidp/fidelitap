import { EmailLayout, Hero, Panel, Paragraph, PillButton, StampRow } from './layout'

export function CustomerWelcomeEmail({
  customerName,
  businessName,
  cardUrl,
  appUrl,
}: {
  customerName: string
  businessName: string
  cardUrl: string
  appUrl: string
}) {
  return (
    <EmailLayout preview={`¡Tu tarjeta de ${businessName} está lista!`} appUrl={appUrl}>
      <Hero eyebrow={businessName} title={`Hola ${customerName}, tu tarjeta de sellos está activa`}>
        <StampRow filled={1} total={8} />
      </Hero>
      <Panel>
        <Paragraph>
          Ya puedes empezar a juntar sellos en <strong style={{ color: '#12161C' }}>{businessName}</strong>. Muestra tu
          tarjeta en cada visita y, cuando la completes, reclama tu premio.
        </Paragraph>
        <PillButton href={cardUrl}>Ver mi tarjeta</PillButton>
        <Paragraph>
          <span style={{ display: 'block', height: '20px' }} />
          Tip: guárdala en tu Wallet para tenerla siempre a la mano, sin buscar el correo.
        </Paragraph>
      </Panel>
    </EmailLayout>
  )
}
