import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export function CardCompleteEmail({
  customerName,
  businessName,
  appleWalletUrl,
  googleWalletUrl,
}: {
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Completaste tu tarjeta de {businessName}! 🎉</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            ¡Felicidades, {customerName}!
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Completaste tu tarjeta de <strong style={{ color: '#FFFFFF' }}>{businessName}</strong>.
            Muéstrale este email al negocio para reclamar tu recompensa.
          </Text>
          <Section style={{ marginBottom: '16px' }}>
            <Button
              href={appleWalletUrl}
              style={{
                backgroundColor: '#00C896',
                color: '#0B0B0B',
                fontWeight: 'bold',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                display: 'inline-block',
                textDecoration: 'none',
                marginRight: '12px',
              }}
            >
              Apple Wallet
            </Button>
            <Button
              href={googleWalletUrl}
              style={{
                backgroundColor: '#1F2937',
                color: '#FFFFFF',
                fontWeight: 'bold',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              Google Wallet
            </Button>
          </Section>
          <Hr style={{ borderColor: '#1F2937', margin: '32px 0' }} />
          <Text style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
            © 2026 FideliTap · fidelitap.co
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
