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
  const { count: customerCount } = loyaltyCardIds.length > 0
    ? await supabase
        .from('customer_cards')
        .select('customer_id', { count: 'exact', head: true })
        .in('loyalty_card_id', loyaltyCardIds)
    : { count: 0 }

  // Count active loyalty cards for this business
  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)

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
      <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Plan actual</p>
        <p className="text-sm font-bold text-white capitalize mb-2">{plan}</p>

        {/* Customer usage */}
        {limits.maxCustomers !== null && (
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">Clientes</span>
              <span className={
                customerState === 'full' ? 'text-red-400 font-bold' :
                customerState === 'warning' ? 'text-amber-400 font-bold' :
                'text-slate-400'
              }>
                {customers}/{limits.maxCustomers}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  customerState === 'full' ? 'bg-red-500' :
                  customerState === 'warning' ? 'bg-amber-400' :
                  'bg-[#00C896]'
                }`}
                style={{ width: `${customerPct ?? 100}%` }}
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
            className="block text-center text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Actualizar plan →
          </Link>
        )}
      </div>
    </div>
  )
}
