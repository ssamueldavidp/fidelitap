import React from 'react'

export interface PosterData {
  businessName: string
  cardName: string
  rewardText: string
  stampsRequired: number
  stampIcon: string
  qrDataUrl: string
  bgColor: string
  bgImageUrl: string | null
  orientation: 'vertical' | 'horizontal'
}

// Vertical: 794 × 1123px  (A4 portrait at 96dpi)
// Horizontal: 1123 × 794px (A4 landscape at 96dpi)

const ACCENT  = '#00C896'
const WHITE   = '#FFFFFF'
const DARK    = '#0B0B0B'
const GREY    = '#9CA3AF'
const GREY2   = '#4B5563'
const GOLD    = '#F59E0B'

function StampRow({ total, icon }: { total: number; icon: string }) {
  const count = Math.min(total, 12)
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            border: `1.5px dashed ${GREY2}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            opacity: 0.5,
          }}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}

function HowItWorks({ small }: { small?: boolean }) {
  const fs  = small ? 11 : 12
  const gap = small ? 6 : 8
  const steps = [
    'Escanea el QR con tu cámara',
    'Ingresa tu nombre y email para activar',
    'En cada visita muestra tu QR de la tarjeta',
    'Al completar los sellos reclama tu premio',
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div style={{ color: WHITE, fontSize: fs + 1, fontWeight: 700, marginBottom: 2 }}>
        ¿Cómo funciona?
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div
            style={{
              width: fs + 6,
              height: fs + 6,
              borderRadius: (fs + 6) / 2,
              background: ACCENT,
              color: DARK,
              fontSize: fs - 1,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {i + 1}
          </div>
          <div style={{ color: GREY, fontSize: fs, lineHeight: 1.4 }}>{s}</div>
        </div>
      ))}
    </div>
  )
}

// ─── VERTICAL ────────────────────────────────────────────────────────────────
export function VerticalPosterTemplate(data: PosterData) {
  const hasBg = !!data.bgImageUrl
  const overlayStyle = hasBg
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.58) 100%),url(${data.bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 794,
        height: 1123,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter", sans-serif',
        position: 'relative',
        ...overlayStyle,
      }}
    >
      {/* ── TOP HEADER ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 56,
          paddingBottom: 32,
          paddingLeft: 64,
          paddingRight: 64,
          borderBottom: `1px solid ${GREY2}`,
          gap: 8,
        }}
      >
        <div style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 4 }}>
          TARJETA DE FIDELIZACIÓN
        </div>
        <div
          style={{
            color: WHITE,
            fontSize: 48,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.05,
          }}
        >
          {data.businessName}
        </div>
        {data.cardName && data.cardName !== data.businessName && (
          <div style={{ color: GREY, fontSize: 16, textAlign: 'center' }}>
            {data.cardName}
          </div>
        )}
      </div>

      {/* ── PRIZE BANNER ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 64,
          paddingRight: 64,
          borderBottom: `1px solid ${GREY2}`,
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 20 }}>🏆</div>
          <div style={{ color: GOLD, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>
            {`ACUMULA ${data.stampsRequired} SELLOS Y GANA`}
          </div>
        </div>
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: `1.5px solid rgba(245,158,11,0.25)`,
            borderRadius: 12,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 24,
            paddingRight: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              color: WHITE,
              fontSize: 22,
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {data.rewardText || 'Premio al completar tus sellos'}
          </div>
        </div>
        {/* Stamp dots */}
        <div style={{ display: 'flex', marginTop: 8 }}>
          <StampRow total={data.stampsRequired} icon={data.stampIcon} />
        </div>
      </div>

      {/* ── QR SECTION ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 64,
          paddingRight: 64,
          borderBottom: `1px solid ${GREY2}`,
          gap: 16,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div style={{ color: WHITE, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
          Escanea con la cámara de tu teléfono para activar tu tarjeta gratis
        </div>
        <div
          style={{
            background: WHITE,
            borderRadius: 20,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={data.qrDataUrl} width={220} height={220} alt="QR" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,200,150,0.1)',
            border: `1px solid rgba(0,200,150,0.3)`,
            borderRadius: 20,
            paddingTop: 6,
            paddingBottom: 6,
            paddingLeft: 14,
            paddingRight: 14,
          }}
        >
          <div style={{ fontSize: 12 }}>📱</div>
          <div style={{ color: ACCENT, fontSize: 12, fontWeight: 600 }}>
            Sin descargar ninguna app
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS + FOOTER ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 24,
          paddingBottom: 36,
          paddingLeft: 64,
          paddingRight: 64,
          gap: 20,
        }}
      >
        <HowItWorks />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ color: GREY2, fontSize: 11 }}>powered by</div>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 700 }}>FideliTap</div>
        </div>
      </div>
    </div>
  )
}

// ─── HORIZONTAL ───────────────────────────────────────────────────────────────
export function HorizontalPosterTemplate(data: PosterData) {
  const hasBg = !!data.bgImageUrl
  const overlayStyle = hasBg
    ? {
        backgroundImage: `linear-gradient(90deg,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.55) 100%),url(${data.bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 1123,
        height: 794,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: '"Inter", sans-serif',
        ...overlayStyle,
      }}
    >
      {/* ── LEFT ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 48,
          paddingBottom: 40,
          paddingLeft: 60,
          paddingRight: 48,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 3 }}>
            TARJETA DE FIDELIZACIÓN
          </div>
          <div style={{ color: WHITE, fontSize: 38, fontWeight: 700, lineHeight: 1.05 }}>
            {data.businessName}
          </div>
          {data.cardName && data.cardName !== data.businessName && (
            <div style={{ color: GREY, fontSize: 14 }}>{data.cardName}</div>
          )}
        </div>

        {/* Prize */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 16 }}>🏆</div>
            <div style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>
              {`ACUMULA ${data.stampsRequired} SELLOS Y GANA`}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: `1.5px solid rgba(245,158,11,0.25)`,
              borderRadius: 10,
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 18,
              paddingRight: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ color: WHITE, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
              {data.rewardText || 'Premio al completar tus sellos'}
            </div>
          </div>
          <StampRow total={data.stampsRequired} icon={data.stampIcon} />
        </div>

        {/* Instructions + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 1, background: GREY2 }} />
          <HowItWorks small />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ color: GREY2, fontSize: 10 }}>powered by</div>
            <div style={{ color: ACCENT, fontSize: 10, fontWeight: 700 }}>FideliTap</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT — QR ── */}
      <div
        style={{
          width: 340,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          paddingTop: 48,
          paddingBottom: 48,
          paddingLeft: 40,
          paddingRight: 48,
          borderLeft: `1px solid ${GREY2}`,
        }}
      >
        <div style={{ color: WHITE, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          Escanea para activar tu tarjeta gratis
        </div>
        <div
          style={{
            background: WHITE,
            borderRadius: 18,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={data.qrDataUrl} width={210} height={210} alt="QR" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0,200,150,0.1)',
            border: `1px solid rgba(0,200,150,0.3)`,
            borderRadius: 16,
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          <div style={{ fontSize: 11 }}>📱</div>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 600 }}>Sin descargar apps</div>
        </div>
      </div>
    </div>
  )
}
