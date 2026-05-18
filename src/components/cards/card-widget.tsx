import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

interface CardWidgetProps {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
  onClick: () => void
  dimmed?: boolean
}

export function CardWidget({ card, customerCount, redemptionCount, onClick, dimmed }: CardWidgetProps) {
  const design = card.design_config as unknown as CardDesignConfig

  const cardStyle: React.CSSProperties = design.bg_type === 'image' && design.bg_image_url
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.4)), url(${design.bg_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl p-5 border cursor-pointer transition-all hover:-translate-y-1 ${dimmed ? 'opacity-40' : ''}`}
      style={{
        borderColor: design.color,
        backgroundColor: design.bg_type !== 'image' ? '#0f172a' : undefined,
        ...cardStyle,
      }}
    >
      {/* Active badge */}
      <div
        className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full border"
        style={{
          color: design.color,
          background: `${design.color}15`,
          borderColor: `${design.color}40`,
        }}
      >
        ● {card.is_active ? 'Activa' : 'Inactiva'}
      </div>

      <p className="text-3xl mb-2">{design.stamp_icon}</p>
      <p className="font-black text-white text-sm mb-0.5">{card.name}</p>
      <p className="text-xs text-slate-400 mb-3">{card.benefit_description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {Array.from({ length: card.stamps_required }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full"
            style={{
              background: i < 3 ? design.color : '#1e293b',
              border: i < 3 ? 'none' : '1px solid #334155',
            }}
          />
        ))}
      </div>

      <div className="flex gap-4">
        <div>
          <p className="text-sm font-bold text-slate-300">{customerCount}</p>
          <p className="text-[10px] text-slate-500">clientes</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-300">{card.stamps_required}</p>
          <p className="text-[10px] text-slate-500">sellos</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-300">{redemptionCount}</p>
          <p className="text-[10px] text-slate-500">canjes</p>
        </div>
      </div>
    </div>
  )
}
