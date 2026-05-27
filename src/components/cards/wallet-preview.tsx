import React from 'react'

interface WalletPreviewProps {
  businessName: string
  name: string
  benefitDescription: string
  stampsRequired: number
  stampIcon: string
  color: string
  bgType: 'solid' | 'image'
  bgImageUrl?: string | null
  filledStamps?: number
  size?: 'sm' | 'md'
}

export function WalletPreview({
  businessName,
  name,
  benefitDescription,
  stampsRequired,
  stampIcon,
  color,
  bgType,
  bgImageUrl,
  filledStamps = 3,
  size = 'md',
}: WalletPreviewProps) {
  const isSm = size === 'sm'
  const filled = Math.min(filledStamps, stampsRequired)
  const pct = stampsRequired > 0 ? (filled / stampsRequired) * 100 : 0

  const cardStyle: React.CSSProperties =
    bgType === 'image' && bgImageUrl
      ? {
          backgroundImage: `linear-gradient(145deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          background: `linear-gradient(145deg, #0d1117 0%, #0f172a 50%, color-mix(in srgb, ${color} 12%, #0f172a) 100%)`,
        }

  return (
    <div
      className={`relative overflow-hidden ${isSm ? 'rounded-xl p-3' : 'rounded-2xl p-5'}`}
      style={{
        ...cardStyle,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}30, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* Subtle shine line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />

      {/* Header */}
      <div className={`flex items-start justify-between ${isSm ? 'mb-2' : 'mb-4'}`}>
        <div className="min-w-0">
          <p className={`text-white/50 font-medium truncate ${isSm ? 'text-[9px]' : 'text-[11px]'}`}>
            {businessName}
          </p>
          <p className={`font-black text-white truncate leading-tight ${isSm ? 'text-sm mt-0.5' : 'text-xl mt-0.5'}`}>
            {stampIcon} {name || 'Nombre de la tarjeta'}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-full flex items-center justify-center font-bold text-white ${
            isSm ? 'w-6 h-6 text-[9px] ml-1' : 'w-9 h-9 text-xs ml-2'
          }`}
          style={{ background: color }}
        >
          {filled}/{stampsRequired}
        </div>
      </div>

      {/* Stamps */}
      <div className={`${isSm ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex flex-wrap ${isSm ? 'gap-1' : 'gap-1.5'}`}>
          {Array.from({ length: stampsRequired }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full flex items-center justify-center font-bold transition-all ${
                isSm ? 'w-5 h-5 text-[8px]' : 'w-8 h-8 text-sm'
              }`}
              style={
                i < filled
                  ? { background: color, boxShadow: `0 0 8px ${color}60` }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }
              }
            >
              {i < filled ? (isSm ? '·' : stampIcon) : ''}
            </div>
          ))}
        </div>

        {!isSm && (
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        )}
      </div>

      {/* Benefit */}
      <div
        className={`rounded-xl ${isSm ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className={`text-white/40 uppercase tracking-widest ${isSm ? 'text-[7px] mb-0.5' : 'text-[9px] mb-1'}`}>
          Premio
        </p>
        <p className={`text-white font-semibold truncate ${isSm ? 'text-[9px]' : 'text-xs'}`}>
          🎁 {benefitDescription || 'Premio al completar'}
        </p>
      </div>
    </div>
  )
}
