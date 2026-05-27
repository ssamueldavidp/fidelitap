import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getPlanLimits, getUsagePct, getUsageState } from '@/lib/plan-limits'

interface PlanUsageProps {
  businessId: string
  plan: string
}

export async function PlanUsage({ businessId, plan }: PlanUsageProps) {
  const supabase = await createClient()

  // Fetch loyalty card IDs for this business
  const { data: loyaltyCards } = await supabase
    .from('loyalty_cards')
    .select('id')
    .eq('business_id', businessId)

  const loyaltyCardIds = (loyaltyCards ?? []).map((c) => c.id)

  // Count distinct customers across all loyalty cards for this business
  const { data: customerRows } = loyaltyCardIds.length > 0
    ? await supabase
        .from('customer_cards')
        .select('customer_id')
        .in('loyalty_card_id', loyaltyCardIds)
    : { data: [] }

  const customerCount = new Set((customerRows ?? []).map((r) => r.customer_id)).size

  // Count active loyalty cards for this business
  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .is('deleted_at', null)

  const limits = getPlanLimits(plan)
  const customers = customerCount ?? 0
  const cards = cardCount ?? 0

  const customerState = getUsageState(customers, limits.maxCustomers)
  const customerPct = getUsagePct(customers, limits.maxCustomers)
  const cardState = getUsageState(cards, limits.maxCards)

  const showWarning = customerState !== 'ok' || cardState !== 'ok'

  return (
    <div className="px-3 mt-4 flex flex-col gap-2">
      {/* Plan badge */}
      <div className="bg-muted rounded-xl p-3 border border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Plan actual</p>
        <p className="text-sm font-bold text-foreground capitalize mb-2">{plan}</p>

        {/* Customer usage */}
        {limits.maxCustomers !== null && (
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Clientes</span>
              <span className={
                customerState === 'full' ? 'text-red-400 font-bold' :
                customerState === 'warning' ? 'text-amber-400 font-bold' :
                'text-muted-foreground'
              }>
                {customers}/{limits.maxCustomers}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  customerState === 'full' ? 'bg-red-500' :
                  customerState === 'warning' ? 'bg-amber-400' :
                  'bg-[#00C896]'
                }`}
                style={{ width: `${customerPct ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Warning message */}
        {customerState === 'full' && (
          <p className="text-[10px] text-red-400 leading-relaxed mb-2">
            Límite alcanzado. No se registrarán nuevos clientes.
          </p>
        )}
        {customerState === 'warning' && (
          <p className="text-[10px] text-amber-400 leading-relaxed mb-2">
            Casi al límite. Quedan {(limits.maxCustomers ?? 0) - customers} espacios.
          </p>
        )}

        {/* Card usage */}
        {limits.maxCards !== null && (
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Tarjetas</span>
              <span className={
                cardState === 'full' ? 'text-red-400 font-bold' :
                cardState === 'warning' ? 'text-amber-400 font-bold' :
                'text-muted-foreground'
              }>
                {cards}/{limits.maxCards}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  cardState === 'full' ? 'bg-red-500' :
                  cardState === 'warning' ? 'bg-amber-400' :
                  'bg-[#00C896]'
                }`}
                style={{ width: `${getUsagePct(cards, limits.maxCards) ?? 0}%` }}
              />
            </div>
            {cardState === 'full' && (
              <p className="text-[10px] text-red-400 leading-relaxed mt-1">
                Límite de tarjetas alcanzado.
              </p>
            )}
          </div>
        )}

        {showWarning ? (
          <Link
            href="/settings#plan"
            className="block text-center text-xs font-bold bg-[#00C896] text-slate-900 rounded-lg py-1.5 hover:bg-[#00b386] transition-colors"
          >
            ↑ Actualizar plan
          </Link>
        ) : (
          <Link
            href="/settings#plan"
            className="block text-center text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualizar plan →
          </Link>
        )}
      </div>
    </div>
  )
}
