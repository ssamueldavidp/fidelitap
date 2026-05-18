import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardsGrid } from '@/components/cards/cards-grid'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'

export default async function CardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  // Fetch all non-deleted cards
  const { data: cards } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const cardList = cards ?? []

  // Fetch customer stats for all cards in one query
  const cardIds = cardList.map(c => c.id)
  const { data: customerCardRows } = cardIds.length > 0
    ? await supabase
        .from('customer_cards')
        .select('loyalty_card_id, customer_id, times_completed')
        .in('loyalty_card_id', cardIds)
    : { data: [] }

  const rows = customerCardRows ?? []

  // Aggregate per card
  const statsMap = new Map<string, { customerCount: number; redemptionCount: number }>()
  for (const cardId of cardIds) {
    const cardRows = rows.filter(r => r.loyalty_card_id === cardId)
    const customerCount = new Set(cardRows.map(r => r.customer_id)).size
    const redemptionCount = cardRows.reduce((sum, r) => sum + (r.times_completed ?? 0), 0)
    statsMap.set(cardId, { customerCount, redemptionCount })
  }

  const cardsWithStats = cardList.map(card => ({
    card,
    customerCount: statsMap.get(card.id)?.customerCount ?? 0,
    redemptionCount: statsMap.get(card.id)?.redemptionCount ?? 0,
  }))

  const limits = getPlanLimits(business.plan)
  const atLimit = isAtLimit(cardList.length, limits.maxCards)

  return (
    <div className="p-8">
      <CardsGrid
        cards={cardsWithStats}
        businessName={business.name}
        atCardLimit={atLimit}
      />
    </div>
  )
}
