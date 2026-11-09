import { EmailLayout, Hero, Panel, Paragraph, PillButton, StampRow } from './layout'

export function StampAddedEmail({
  customerName,
  businessName,
  currentStamps,
  stampsRequired,
  benefit,
  googleWalletUrl,
  appleWalletUrl,
  appUrl,
}: {
  customerName: string
  businessName: string
  currentStamps: number
  stampsRequired: number
  benefit?: string | null
  googleWalletUrl: string
  appleWalletUrl: string
  appUrl: string
}) {
  const remaining = Math.max(stampsRequired - currentStamps, 0)
  return (
    <EmailLayout
      preview={`Sumaste un sello en ${businessName}: llevas ${currentStamps} de ${stampsRequired}`}
      appUrl={appUrl}
    >
      <Hero eyebrow="Nuevo sello" title={`¡Sello sumado en ${businessName}!`}>
        <StampRow filled={currentStamps} total={stampsRequired} />
      </Hero>
      <Panel>
        <Paragraph>
          Hola {customerName}, acabas de recibir un sello en <strong style={{ color: '#12161C' }}>{businessName}</strong>.
          Llevas <strong style={{ color: '#12161C' }}>{currentStamps} de {stampsRequired}</strong>
          {remaining > 0
            ? `: te ${remaining === 1 ? 'falta 1 sello' : `faltan ${remaining} sellos`}${benefit ? ` para ganar ${benefit}` : ' para tu premio'}.`
            : '.'}
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
