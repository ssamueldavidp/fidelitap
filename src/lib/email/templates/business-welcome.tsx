import { EmailLayout, Hero, Panel, Paragraph, PillButton } from './layout'

export function BusinessWelcomeEmail({
  businessName,
  appUrl,
}: {
  businessName: string
  appUrl: string
}) {
  return (
    <EmailLayout preview={`¡Bienvenido a Fidelitap, ${businessName}!`} appUrl={appUrl}>
      <Hero eyebrow="Bienvenido a Fidelitap" title="¡Ya puedes empezar a fidelizar!" />
      <Panel>
        <Paragraph>
          Hola <strong style={{ color: '#12161C' }}>{businessName}</strong>, tu negocio ya está registrado. En unos
          minutos puedes tener tus clientes juntando sellos:
        </Paragraph>
        <Paragraph>
          <strong style={{ color: '#12161C' }}>1.</strong> Diseña tu tarjeta de sellos.
          <br />
          <strong style={{ color: '#12161C' }}>2.</strong> Descarga el cartel con tu código QR y pégalo en tu local.
          <br />
          <strong style={{ color: '#12161C' }}>3.</strong> Escanea la tarjeta de tus clientes para darles su primer sello.
        </Paragraph>
        <PillButton href={`${appUrl}/dashboard`}>Ir a mi panel</PillButton>
      </Panel>
    </EmailLayout>
  )
}
