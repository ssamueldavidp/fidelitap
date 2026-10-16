'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CardWidget } from '@/components/cards/card-widget'
import { CardDrawer } from '@/components/cards/card-drawer'
import type { LoyaltyCard } from '@/types/database'

interface CardWithStats {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
}

interface CardsGridProps {
  cards: CardWithStats[]
  businessName: string
  atCardLimit: boolean
}

type Tab = 'active' | 'inactive'

export function CardsGrid({ cards, businessName, atCardLimit }: CardsGridProps) {
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const filtered = cards.filter(({ card }) =>
    activeTab === 'active' ? card.is_active : !card.is_active
  )
  const activeCount = cards.filter(({ card }) => card.is_active).length
  const inactiveCount = cards.filter(({ card }) => !card.is_active).length

  const selectedCardData = selectedCardId
    ? cards.find(({ card }) => card.id === selectedCardId)
    : null

  useEffect(() => {
    if (selectedCardId && !selectedCardData) setSelectedCardId(null)
  }, [selectedCardId, selectedCardData])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">Mis tarjetas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestiona tus programas de fidelización</p>
        </div>
        {atCardLimit ? (
          <Link
            href="/settings#plan"
            className="bg-muted border border-border text-foreground text-sm font-semibold rounded-xl px-4 py-2.5 hover:border-foreground/30 transition-colors"
          >
            Límite alcanzado — Actualizar plan
          </Link>
        ) : (
          <Link
            href="/cards/nueva"
            className="bg-primary text-primary-foreground text-sm font-bold rounded-xl px-4 py-2.5 hover:bg-primary/90 transition-colors"
          >
            + Nueva tarjeta
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {([['active', `Activas (${activeCount})`], ['inactive', `Inactivas (${inactiveCount})`]] as const).map(
          ([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-3 gap-4 ${selectedCardId ? 'mr-80' : ''} transition-all`}>
        {filtered.map(({ card, customerCount, redemptionCount }) => (
          <CardWidget
            key={card.id}
            card={card}
            customerCount={customerCount}
            redemptionCount={redemptionCount}
            onClick={() => setSelectedCardId(card.id)}
            dimmed={!!selectedCardId && selectedCardId !== card.id}
          />
        ))}

        {!atCardLimit && (
          <Link
            href="/cards/nueva"
            className="rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 min-h-[200px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <span className="text-4xl font-light">+</span>
            <span className="text-sm font-semibold">Nueva tarjeta</span>
          </Link>
        )}

        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">◉</p>
            <p className="font-semibold">
              {activeTab === 'active' ? 'No tienes tarjetas activas' : 'No tienes tarjetas inactivas'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedCardId && selectedCardData && (
        <CardDrawer
          card={selectedCardData.card}
          businessName={businessName}
          customerCount={selectedCardData.customerCount}
          redemptionCount={selectedCardData.redemptionCount}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </>
  )
}
