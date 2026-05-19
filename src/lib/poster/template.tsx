import React from 'react'

export interface PosterData {
  businessName: string
  rewardText: string
  stampsRequired: number
  qrDataUrl: string      // base64 PNG data URL from qrcode package
  bgColor: string        // hex e.g. '#0B0B0B'
  bgImageUrl: string | null
  orientation: 'vertical' | 'horizontal'
}

// Vertical: 794 × 1123px  (A4 portrait at 96dpi)
// Horizontal: 1123 × 794px (A4 landscape at 96dpi)

const ACCENT = '#00C896'
const WHITE = '#FFFFFF'
const GREY = '#6B7280'

function StampDots({ total }: { total: number }) {
  const dots = Array.from({ length: Math.min(total, 10) })
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {dots.map((_, i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: '#222',
            border: `2px solid ${GREY}`,
          }}
        />
      ))}
    </div>
  )
}

function WalletSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 16, width: '100%', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
        <div style={{ color: WHITE, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          ¿Cómo guardar tu tarjeta?
        </div>
        <div style={{ color: GREY, fontSize: 11 }}>① Escanea el QR de arriba y regístrate</div>
        <div style={{ color: GREY, fontSize: 11 }}>② Toca "Agregar a Apple Wallet" o "Google Wallet"</div>
        <div style={{ color: GREY, fontSize: 11 }}>③ ¡Listo! Tu tarjeta queda en tu teléfono</div>
        <div style={{ color: ACCENT, fontSize: 11, marginTop: 4 }}>fidelitap.co/ayuda/wallet</div>
      </div>
    </div>
  )
}

export function VerticalPosterTemplate(data: PosterData) {
  const bg = data.bgImageUrl
    ? { backgroundImage: `url(${data.bgImageUrl})`, backgroundSize: 'cover' }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 794,
        height: 1123,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '64px 80px',
        fontFamily: '"Inter", sans-serif',
        ...bg,
      }}
    >
      {/* Top */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ color: ACCENT, fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>
          FIDELITAP
        </div>
        <div style={{ color: WHITE, fontSize: 44, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
          {data.businessName}
        </div>
        <div style={{ color: GREY, fontSize: 18, textAlign: 'center' }}>
          {data.rewardText}
        </div>
      </div>

      {/* QR */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            background: WHITE,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={data.qrDataUrl} width={220} height={220} alt="QR" />
        </div>
        <div style={{ color: GREY, fontSize: 14 }}>Escanea para unirte</div>
        <StampDots total={data.stampsRequired} />
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 24 }}>
        <div style={{ height: 1, background: '#222', width: '100%' }} />
        <WalletSection />
        <div style={{ color: '#333', fontSize: 12, textAlign: 'center' }}>
          powered by FideliTap
        </div>
      </div>
    </div>
  )
}

export function HorizontalPosterTemplate(data: PosterData) {
  const bg = data.bgImageUrl
    ? { backgroundImage: `url(${data.bgImageUrl})`, backgroundSize: 'cover' }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 1123,
        height: 794,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: '"Inter", sans-serif',
        ...bg,
      }}
    >
      {/* Left column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>
            FIDELITAP
          </div>
          <div style={{ color: WHITE, fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>
            {data.businessName}
          </div>
          <div style={{ color: GREY, fontSize: 16 }}>{data.rewardText}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {Array.from({ length: Math.min(data.stampsRequired, 10) }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#222',
                  border: `2px solid ${GREY}`,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 1, background: '#222', width: '100%' }} />
          <WalletSection />
          <div style={{ color: '#333', fontSize: 11 }}>powered by FideliTap</div>
        </div>
      </div>

      {/* Right column — QR */}
      <div
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '56px 48px',
          borderLeft: '1px solid #1a1a1a',
        }}
      >
        <div
          style={{
            background: WHITE,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={data.qrDataUrl} width={200} height={200} alt="QR" />
        </div>
        <div style={{ color: GREY, fontSize: 14, textAlign: 'center' }}>Escanea para unirte</div>
      </div>
    </div>
  )
}
