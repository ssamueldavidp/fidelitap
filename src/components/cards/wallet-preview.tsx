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

const CARD_COLORS: Record<string, { border: string; glow: string }> = {
  '#00C896': { border: 'border-[#00C896]', glow: 'shadow-[#00C896]/20' },
  '#6366f1': { border: 'border-[#6366f1]', glow: 'shadow-[#6366f1]/20' },
  '#f59e0b': { border: 'border-[#f59e0b]', glow: 'shadow-[#f59e0b]/20' },
  '#ef4444': { border: 'border-[#ef4444]', glow: 'shadow-[#ef4444]/20' },
  '#ec4899': { border: 'border-[#ec4899]', glow: 'shadow-[#ec4899]/20' },
  '#0ea5e9': { border: 'border-[#0ea5e9]', glow: 'shadow-[#0ea5e9]/20' },
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
  const colorClasses = CARD_COLORS[color] ?? CARD_COLORS['#00C896']
  const isSm = size === 'sm'

  const cardStyle: React.CSSProperties = bgType === 'image' && bgImageUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.5)), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <div
      className={`rounded-xl border ${colorClasses.border} shadow-lg ${colorClasses.glow} ${isSm ? 'p-3' : 'p-5'} ${bgType !== 'image' ? 'bg-slate-900' : ''}`}
      style={cardStyle}
    >
      <p className={`text-slate-400 ${isSm ? 'text-[9px]' : 'text-xs'} mb-0.5`}>{businessName}</p>
      <p className={`font-black text-white ${isSm ? 'text-sm' : 'text-lg'} mb-3`}>
        {stampIcon} {name || 'Nombre de la tarjeta'}
      </p>
      <div className={`flex flex-wrap ${isSm ? 'gap-1 mb-2' : 'gap-1.5 mb-4'}`}>
        {Array.from({ length: stampsRequired }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full ${isSm ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`}
            style={{ background: i < filledStamps ? color : '#1e293b', border: i < filledStamps ? 'none' : '1px solid #334155' }}
          />
        ))}
      </div>
      <p className={`text-slate-400 ${isSm ? 'text-[9px]' : 'text-xs'}`}>
        Premio: {benefitDescription || 'Premio al completar'}
      </p>
    </div>
  )
}
