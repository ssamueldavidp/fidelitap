'use client'

import { motion } from 'framer-motion'
import { resolveStorageUrl } from '@/lib/storage-url'
import { WalletPreview } from '@/components/cards/wallet-preview'
import type { LoyaltyCard, CardDesignConfig } from '@/types/database'

interface CardWidgetProps {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
  onClick: () => void
  dimmed?: boolean
}

export function CardWidget({ card, customerCount, redemptionCount, onClick, dimmed }: CardWidgetProps) {
  const design = card.design_config as unknown as CardDesignConfig

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`cursor-pointer transition-opacity ${dimmed ? 'opacity-40' : ''}`}
    >
      <WalletPreview
        businessName={card.name}
        name={card.name}
        benefitDescription={card.benefit_description}
        stampsRequired={card.stamps_required}
        stampIcon={design.stamp_icon ?? '⭐'}
        color={design.color ?? '#00C896'}
        cardStyle={design.style ?? 'clean'}
        bgMode={design.bg_mode ?? 'light'}
        bgType={design.bg_type === 'image' ? 'image' : 'solid'}
        bgImageUrl={resolveStorageUrl(design.bg_image_url)}
        logoUrl={resolveStorageUrl(design.logo_url) ?? undefined}
        filledStamps={3}
        size="sm"
      />
      <div className="mt-2.5 flex gap-4 px-1">
        <div>
          <p className="text-sm font-bold text-white">{customerCount}</p>
          <p className="text-[10px] text-white/30">clientes</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{card.stamps_required}</p>
          <p className="text-[10px] text-white/30">sellos</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{redemptionCount}</p>
          <p className="text-[10px] text-white/30">canjes</p>
        </div>
        <div className="ml-auto">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              color: design.color ?? '#00C896',
              background: `${design.color ?? '#00C896'}18`,
            }}
          >
            {card.is_active ? '● Activa' : '● Inactiva'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
