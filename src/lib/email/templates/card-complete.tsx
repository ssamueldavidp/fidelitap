import { EmailLayout, Hero, Panel, Paragraph, PillButton, StampRow } from './layout'

export function CardCompleteEmail({
  customerName,
  businessName,
  appleWalletUrl,
  googleWalletUrl,
  appUrl,
}: {
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
  appUrl: string
}) {
  return (
    <EmailLayout preview={`¡Completaste tu tarjeta de ${businessName}!`} appUrl={appUrl}>
      <Hero eyebrow="Tarjeta completa" title={`¡Felicidades, ${customerName}!`}>
        <StampRow filled={8} total={8} />
      </Hero>
      <Panel>
        <Paragraph>
          Completaste tu tarjeta de <strong style={{ color: '#12161C' }}>{businessName}</strong>. Muestra este correo o
          tu tarjeta en el negocio para reclamar tu premio.
        </Paragraph>
        <PillButton href={googleWalletUrl}>Ver en Google Wallet</PillButton>
        <span style={{ display: 'inline-block', width: '10px' }} />
        <PillButton href={appleWalletUrl} variant="ghost">
          Ver en Apple Wallet
        </PillButton>
      </Panel>
    </EmailLayout>
  )
}
