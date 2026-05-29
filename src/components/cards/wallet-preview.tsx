// src/components/cards/wallet-preview.tsx
import React from 'react'

export type CardStyle = 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'

export interface WalletPreviewProps {
  businessName: string
  name: string
  benefitDescription: string
  stampsRequired: number
  stampIcon: string
  color: string
  cardStyle?: CardStyle
  bgMode?: 'light' | 'dark'
  bgType?: 'solid' | 'image'
  bgImageUrl?: string | null
  logoUrl?: string | null
  filledStamps?: number
  qrDataUrl?: string | null
  size?: 'sm' | 'md'
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r},${g},${b}`
}

function QRPlaceholder({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg">
      <rect width="37" height="37" fill="white"/>
      <rect x="1" y="1" width="11" height="11" rx="2" fill="#111"/>
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#111"/>
      <rect x="25" y="1" width="11" height="11" rx="2" fill="#111"/>
      <rect x="26" y="2" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="27" y="3" width="7" height="7" rx="1" fill="#111"/>
      <rect x="1" y="25" width="11" height="11" rx="2" fill="#111"/>
      <rect x="2" y="26" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="3" y="27" width="7" height="7" rx="1" fill="#111"/>
      <rect x="14" y="1" width="2" height="2" fill="#111"/><rect x="17" y="1" width="2" height="2" fill="#111"/><rect x="20" y="1" width="2" height="2" fill="#111"/>
      <rect x="14" y="4" width="2" height="2" fill="#111"/><rect x="20" y="4" width="2" height="2" fill="#111"/>
      <rect x="14" y="7" width="2" height="2" fill="#111"/><rect x="17" y="7" width="2" height="2" fill="#111"/>
      <rect x="1" y="14" width="2" height="2" fill="#111"/><rect x="4" y="14" width="2" height="2" fill="#111"/><rect x="7" y="14" width="2" height="2" fill="#111"/>
      <rect x="14" y="14" width="2" height="2" fill="#111"/><rect x="17" y="14" width="2" height="2" fill="#111"/><rect x="20" y="14" width="2" height="2" fill="#111"/>
      <rect x="26" y="14" width="2" height="2" fill="#111"/><rect x="29" y="14" width="2" height="2" fill="#111"/><rect x="32" y="14" width="2" height="2" fill="#111"/>
      <rect x="1" y="17" width="2" height="2" fill="#111"/><rect x="7" y="17" width="2" height="2" fill="#111"/>
      <rect x="14" y="17" width="2" height="2" fill="#111"/><rect x="20" y="17" width="2" height="2" fill="#111"/><rect x="26" y="17" width="2" height="2" fill="#111"/>
      <rect x="1" y="20" width="2" height="2" fill="#111"/><rect x="4" y="20" width="2" height="2" fill="#111"/><rect x="10" y="20" width="2" height="2" fill="#111"/>
      <rect x="17" y="20" width="2" height="2" fill="#111"/><rect x="23" y="20" width="2" height="2" fill="#111"/><rect x="29" y="20" width="2" height="2" fill="#111"/>
      <rect x="14" y="23" width="2" height="2" fill="#111"/><rect x="20" y="23" width="2" height="2" fill="#111"/>
      <rect x="17" y="26" width="2" height="2" fill="#111"/><rect x="23" y="26" width="2" height="2" fill="#111"/>
      <rect x="14" y="29" width="2" height="2" fill="#111"/><rect x="20" y="29" width="2" height="2" fill="#111"/>
      <rect x="17" y="32" width="2" height="2" fill="#111"/><rect x="26" y="32" width="2" height="2" fill="#111"/>
    </svg>
  )
}

interface StyleVisuals {
  nameColor: string
  subtleColor: string
  verySubtleColor: string
  logoBg: string
  logoBorder: string
  stampFilledBg: string
  stampFilledShadow: string
  stampEmptyBg: string
  stampEmptyBorder: string
  rewardBannerBg: string
  rewardBannerBorder: string
  rewardLabelColor: string
  rewardValueColor: string
  statLabelColor: string
  statValueColor: string
  footerBg: string
  footerBorder: string
  poweredByColor: string
  stampShape: 'circle' | 'square'
}

function getVisuals(style: CardStyle, color: string, bgMode: 'light' | 'dark'): StyleVisuals {
  const rgb = hexToRgb(color)
  const light = style === 'clean' && bgMode === 'light'
  const minimal = style === 'minimal'
  const isLight = light || minimal
  const luxury = style === 'luxury'
  const accentColor = luxury ? '#c9a227' : color

  return {
    nameColor:          isLight ? color : (luxury ? '#e8e8e8' : '#fff'),
    subtleColor:        isLight ? '#999' : 'rgba(255,255,255,0.35)',
    verySubtleColor:    isLight ? '#bbb' : 'rgba(255,255,255,0.22)',
    logoBg:             isLight ? color : `rgba(${rgb},0.18)`,
    logoBorder:         isLight ? 'none' : `1.5px solid rgba(${rgb},0.3)`,
    stampFilledBg:      luxury ? 'linear-gradient(135deg,#c9a227,#f0c940)' : color,
    stampFilledShadow:  luxury ? '0 4px 14px rgba(201,162,39,0.45)' : `0 4px 16px rgba(${rgb},0.4)`,
    stampEmptyBg:       isLight ? '#f0f0f0' : 'transparent',
    stampEmptyBorder:   isLight ? '1.5px solid #e0e0e0' : `2px dashed rgba(${rgb},0.25)`,
    rewardBannerBg:     isLight ? '#f0f0f0' : `rgba(${rgb},0.08)`,
    rewardBannerBorder: isLight ? '1.5px solid #e8e8e8' : `1.5px solid rgba(${rgb},0.16)`,
    rewardLabelColor:   accentColor,
    rewardValueColor:   isLight ? '#222' : '#e2e8f0',
    statLabelColor:     accentColor,
    statValueColor:     isLight ? '#1a1a1a' : '#e2e8f0',
    footerBg:           isLight ? '#ede8de' : (luxury ? '#060606' : 'rgba(0,0,0,0.22)'),
    footerBorder:       isLight ? 'rgba(0,0,0,0.07)' : (luxury ? 'rgba(201,162,39,0.1)' : 'rgba(255,255,255,0.06)'),
    poweredByColor:     isLight ? '#aaa' : 'rgba(255,255,255,0.32)',
    stampShape:         style === 'editorial' ? 'square' : 'circle',
  }
}

interface CardShell {
  wrapperStyle: React.CSSProperties
  shadow: string
  overlays: React.ReactNode
  separatorBg: string
}

function getCardShell(
  style: CardStyle,
  color: string,
  bgMode: 'light' | 'dark',
  bgType: string,
  bgImageUrl?: string | null,
): CardShell {
  const rgb = hexToRgb(color)

  if (bgType === 'image' && bgImageUrl) {
    return {
      wrapperStyle: {
        backgroundImage: `linear-gradient(145deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      shadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
      overlays: null,
      separatorBg: '#111',
    }
  }

  switch (style) {
    case 'clean': {
      const isLight = bgMode === 'light'
      return {
        wrapperStyle: { background: isLight ? '#F5F0E8' : '#111' },
        shadow: isLight
          ? '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)'
          : '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        overlays: null,
        separatorBg: isLight ? '#F5F0E8' : '#111',
      }
    }
    case 'modern':
      return {
        wrapperStyle: { background: 'linear-gradient(145deg,#080e17 0%,#0d1520 55%,#060f18 100%)' },
        shadow: `0 24px 64px rgba(${rgb},0.12), 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)`,
        overlays: (
          <>
            <div style={{ position:'absolute',top:'-80px',right:'-80px',width:'260px',height:'260px',borderRadius:'50%',background:`radial-gradient(circle,rgba(${rgb},0.14) 0%,transparent 68%)`,pointerEvents:'none' }} />
            <div style={{ position:'absolute',bottom:'-60px',left:'-40px',width:'180px',height:'180px',borderRadius:'50%',background:'radial-gradient(circle,rgba(14,165,233,0.08) 0%,transparent 70%)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',pointerEvents:'none' }} />
          </>
        ),
        separatorBg: '#080e17',
      }
    case 'luxury':
      return {
        wrapperStyle: { background: '#0a0a0a' },
        shadow: '0 24px 64px rgba(201,162,39,0.1), 0 8px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,162,39,0.06)',
        overlays: (
          <>
            <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 32px,rgba(255,255,255,0.012) 32px,rgba(255,255,255,0.012) 33px)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',top:'-40px',right:'-30px',width:'160px',height:'160px',borderRadius:'50%',background:'radial-gradient(circle,rgba(201,162,39,0.12) 0%,transparent 65%)',pointerEvents:'none' }} />
          </>
        ),
        separatorBg: '#0a0a0a',
      }
    case 'editorial':
      return {
        wrapperStyle: { background: 'linear-gradient(160deg,#1a0038 0%,#0d0d22 40%,#001a38 100%)' },
        shadow: '0 24px 64px rgba(99,102,241,0.15), 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
        overlays: (
          <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at 75% 20%,rgba(99,102,241,0.22) 0%,transparent 55%),radial-gradient(ellipse at 20% 80%,rgba(236,72,153,0.16) 0%,transparent 50%)',pointerEvents:'none' }} />
        ),
        separatorBg: '#0d0d22',
      }
    case 'minimal':
      return {
        wrapperStyle: { background: '#f8f8f8' },
        shadow: '0 16px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        overlays: (
          <div style={{ position:'absolute',top:0,left:0,right:0,height:'3px',background:color,pointerEvents:'none' }} />
        ),
        separatorBg: '#f8f8f8',
      }
  }
}

export function WalletPreview({
  businessName,
  name,
  benefitDescription,
  stampsRequired,
  stampIcon,
  color,
  cardStyle = 'clean',
  bgMode = 'light',
  bgType = 'solid',
  bgImageUrl,
  logoUrl,
  filledStamps = 3,
  qrDataUrl,
  size = 'md',
}: WalletPreviewProps) {
  const isSm = size === 'sm'
  const filled    = Math.min(filledStamps, stampsRequired)
  const remaining = Math.max(stampsRequired - filled, 0)

  const shell = getCardShell(cardStyle, color, bgMode, bgType ?? 'solid', bgImageUrl)
  const vis   = getVisuals(cardStyle, color, bgMode)

  return (
    <div
      className={`relative overflow-hidden font-sans select-none ${isSm ? 'rounded-xl' : 'rounded-2xl'}`}
      style={{ ...shell.wrapperStyle, boxShadow: shell.shadow }}
    >
      {shell.overlays}

      {/* TOP: Business name + logo */}
      <div className={`relative z-10 flex justify-between items-start ${isSm ? 'px-3 pt-4 pb-2' : 'px-6 pt-6 pb-4'}`}>
        <div className="flex-1 min-w-0 pr-2">
          <p
            className={`font-black uppercase leading-tight ${isSm ? 'text-xl' : 'text-3xl'}`}
            style={{ color: vis.nameColor, letterSpacing: '-0.02em' }}
          >
            {businessName || 'Mi Negocio'}
          </p>
          <p className={`font-medium mt-0.5 truncate ${isSm ? 'text-[10px]' : 'text-sm'}`} style={{ color: vis.subtleColor }}>
            {name || 'Tarjeta de fidelización'}
          </p>
        </div>
        <div
          className={`flex-shrink-0 flex items-center justify-center overflow-hidden ${isSm ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'}`}
          style={{ background: vis.logoBg, border: vis.logoBorder }}
        >
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt="" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <span className={isSm ? 'text-xl' : 'text-3xl'}>{stampIcon}</span>
          }
        </div>
      </div>

      {/* STAMPS GRID */}
      <div className={`relative z-10 ${isSm ? 'px-3 pb-2' : 'px-6 pb-4'}`}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: stampsRequired }).map((_, i) => {
            const active = i < filled
            const isSquare = vis.stampShape === 'square'
            return (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center ${isSm ? 'text-[10px]' : 'text-xl'} ${isSquare ? 'rounded-lg' : 'rounded-full'}`}
                style={
                  active
                    ? { background: vis.stampFilledBg, boxShadow: vis.stampFilledShadow }
                    : { background: vis.stampEmptyBg, border: vis.stampEmptyBorder, opacity: 0.45, filter: 'grayscale(1)' }
                }
              >
                {active ? stampIcon : (isSm ? '' : stampIcon)}
              </div>
            )
          })}
        </div>
      </div>

      {/* REWARD BANNER */}
      {!isSm && (
        <div
          className="relative z-10 mx-6 mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: vis.rewardBannerBg, border: vis.rewardBannerBorder }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: color }}
          >
            🎁
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: vis.rewardLabelColor }}>
              Premio al completar
            </p>
            <p className="text-sm font-bold mt-0.5 truncate" style={{ color: vis.rewardValueColor }}>
              {benefitDescription || 'Premio especial'}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xl font-black leading-none" style={{ color: vis.rewardLabelColor }}>{filled}</p>
            <p className="text-[10px]" style={{ color: vis.subtleColor }}>de {stampsRequired}</p>
          </div>
        </div>
      )}

      {/* STATS ROW */}
      {!isSm && (
        <div className="relative z-10 grid grid-cols-2 gap-4 px-6 pb-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: vis.statLabelColor }}>
              Hasta próx premio
            </p>
            <p className="text-2xl font-black leading-none" style={{ color: vis.statValueColor }}>
              {remaining}{' '}
              <span className="text-sm font-semibold" style={{ color: vis.subtleColor }}>sellos</span>
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: vis.statLabelColor }}>
              Premios disponibles
            </p>
            <p className="text-2xl font-black leading-none" style={{ color: vis.statValueColor }}>
              0{' '}
              <span className="text-sm font-semibold" style={{ color: vis.subtleColor }}>premios</span>
            </p>
          </div>
        </div>
      )}

      {/* EDITORIAL SEPARATOR */}
      {cardStyle === 'editorial' && !isSm && (
        <div className="relative z-10" style={{ height: '1px', borderTop: '1.5px dashed rgba(255,255,255,0.12)' }}>
          <div style={{ position:'absolute',top:'-8px',left:'-8px',width:'16px',height:'16px',borderRadius:'50%',background:shell.separatorBg }} />
          <div style={{ position:'absolute',top:'-8px',right:'-8px',width:'16px',height:'16px',borderRadius:'50%',background:shell.separatorBg }} />
        </div>
      )}

      {/* QR + FIDELITAP FOOTER */}
      <div
        className={`relative z-10 flex items-center justify-between ${isSm ? 'px-3 py-2.5' : 'px-6 py-5'}`}
        style={{ background: vis.footerBg, borderTop: `1px solid ${vis.footerBorder}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`bg-white flex items-center justify-center rounded-xl overflow-hidden ${isSm ? 'w-10 h-10 p-1' : 'w-16 h-16 p-2'}`}
            style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
          >
            {qrDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qrDataUrl} alt="QR" className="w-full h-full" />
              : <QRPlaceholder size={isSm ? 32 : 52} />
            }
          </div>
          {!isSm && (
            <div>
              <p className="text-[9px] font-mono tracking-widest" style={{ color: vis.subtleColor }}>
                FDL·A2X9·K7M3
              </p>
              <p className="text-[8px] mt-0.5" style={{ color: vis.verySubtleColor }}>
                Escanea en cada visita
              </p>
            </div>
          )}
        </div>
        <div className="text-right">
          {!isSm && (
            <p className="text-[8px] uppercase tracking-wider" style={{ color: vis.verySubtleColor }}>
              Powered by
            </p>
          )}
          <p className={`font-black ${isSm ? 'text-[9px]' : 'text-xs'}`} style={{ color: vis.poweredByColor }}>
            Fideli<span style={{ color: '#00C896' }}>tap</span>
          </p>
        </div>
      </div>
    </div>
  )
}
