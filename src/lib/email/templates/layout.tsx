import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'

// Identidad Fidelitap para correo: verde de marca, tarjetas redondeadas y botones en píldora.
// Los correos usan tablas/estilos en línea (Gmail y Outlook ignoran casi todo lo demás).
export const COLORS = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#12161C',
  muted: '#5B6676',
  line: '#E6EAF1',
  brand: '#0A9F5B',
  brandDark: '#087A47',
  brandDeep: '#055B35',
  brandSoft: '#E3F6EC',
  coral: '#FF6B3D',
}

const FONT = "Outfit, 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const BODY_FONT = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"

export function EmailLayout({
  preview,
  appUrl,
  children,
}: {
  preview: string
  appUrl: string
  children: ReactNode
}) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLORS.bg, margin: 0, padding: '28px 12px', fontFamily: BODY_FONT, color: COLORS.text }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto' }}>
          <Section style={{ padding: '0 8px 20px', textAlign: 'center' }}>
            <Link href={appUrl}>
              <Img
                src={`${appUrl}/fidelitap-logo.png`}
                alt="fidelitap"
                width="120"
                style={{ display: 'inline-block', height: 'auto', fontFamily: FONT, fontWeight: 800, fontSize: '26px', color: COLORS.brandDark }}
              />
            </Link>
          </Section>
          {children}
          <Section style={{ padding: '24px 12px 0', textAlign: 'center' }}>
            <Text style={{ margin: '0 0 6px', fontSize: '12px', color: COLORS.muted }}>
              Fidelitap · Tarjetas de fidelización digitales hechas en Colombia
            </Text>
            <Text style={{ margin: 0, fontSize: '12px', color: COLORS.muted }}>
              <Link href={appUrl} style={{ color: COLORS.brandDark, fontWeight: 700, textDecoration: 'none' }}>
                fidelitap.co
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/** Cabecera verde con degradado (el color sólido es el respaldo si el cliente de correo no soporta degradados). */
export function Hero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  const style: CSSProperties = {
    backgroundColor: COLORS.brandDark,
    backgroundImage: `linear-gradient(135deg, #0FB36A 0%, ${COLORS.brandDark} 55%, ${COLORS.brandDeep} 100%)`,
    borderRadius: '28px 28px 0 0',
    padding: '36px 32px 32px',
  }
  return (
    <Section style={style}>
      <Text style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#BFFFE0', fontFamily: FONT }}>
        {eyebrow}
      </Text>
      <Text style={{ margin: 0, fontSize: '30px', lineHeight: '1.15', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', fontFamily: FONT }}>
        {title}
      </Text>
      {children}
    </Section>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <Section style={{ backgroundColor: COLORS.card, borderRadius: '0 0 28px 28px', padding: '28px 32px 32px', border: `1px solid ${COLORS.line}`, borderTop: 'none' }}>
      {children}
    </Section>
  )
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ margin: '0 0 18px', fontSize: '16px', lineHeight: '1.6', color: COLORS.muted }}>{children}</Text>
}

export function PillButton({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: 'primary' | 'ghost' }) {
  const primary = variant === 'primary'
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: primary ? COLORS.brand : '#FFFFFF',
        color: primary ? '#FFFFFF' : COLORS.brandDark,
        border: primary ? 'none' : `2px solid ${COLORS.brand}`,
        borderRadius: '999px',
        padding: primary ? '15px 30px' : '13px 26px',
        fontSize: '15px',
        fontWeight: 800,
        textDecoration: 'none',
        fontFamily: FONT,
      }}
    >
      {children}
    </Link>
  )
}

/** Fila de sellos (círculos). `filled` llenos de un total de `total`. */
export function StampRow({ filled, total }: { filled: number; total: number }) {
  const dots = Array.from({ length: total }, (_, i) => i < filled)
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '18px 0 4px' }}>
      <tbody>
        <tr>
          {dots.map((on, i) => (
            <td key={i} style={{ paddingRight: '8px' }}>
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: on ? '#FFFFFF' : 'transparent',
                  border: '2px solid rgba(255,255,255,0.75)',
                  boxSizing: 'border-box',
                }}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
