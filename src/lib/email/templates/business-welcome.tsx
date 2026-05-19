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

export function BusinessWelcomeEmail({
  businessName,
  appUrl,
}: {
  businessName: string
  appUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Bienvenido a FideliTap, {businessName}!</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            ¡Ya puedes empezar a fidelizar!
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Hola {businessName}, tu negocio está registrado en FideliTap. Crea tu primera tarjeta de
            sellos y comparte el cartel con tus clientes.
          </Text>
          <Button
            href={`${appUrl}/dashboard`}
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
            Ir al dashboard
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
