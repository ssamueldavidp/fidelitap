import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function CustomerWelcomeEmail({
  customerName,
  businessName,
  cardUrl,
}: {
  customerName: string
  businessName: string
  cardUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Tu tarjeta de {businessName} está lista!</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            Hola {customerName}, tu tarjeta de sellos está activa
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Tu tarjeta de <strong style={{ color: '#FFFFFF' }}>{businessName}</strong> ya está
            lista. Muéstrasela al negocio cada vez que visites para acumular sellos.
          </Text>
          <Button
            href={cardUrl}
            style={{
              backgroundColor: '#00C896',
              color: '#0B0B0B',
              fontWeight: 'bold',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              display: 'inline-block',
              textDecoration: 'none',
            }}
          >
            Ver mi tarjeta
          </Button>
          <Hr style={{ borderColor: '#1F2937', margin: '32px 0' }} />
          <Text style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
            © 2026 FideliTap · fidelitap.co
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
