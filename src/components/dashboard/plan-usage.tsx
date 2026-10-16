import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getPlanLimits, getUsagePct, getUsageState, type UsageState } from '@/lib/plan-limits'

interface PlanUsageProps {
  businessId: string
  plan: string
}

const BAR_COLOR: Record<UsageState, string> = {
  ok: 'from-[#34D399] to-[#0A9F5B]',
  warning: 'from-[#FFB020] to-[#FF7A45]',
  full: 'from-[#FF7A45] to-[#E8452C]',
}

function UsageRow({ label, value, limit }: { label: string; value: number; limit: number | null }) {
  if (limit === null) return null
  const state = getUsageState(value, limit)
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[13px] font-semibold">
        <span>{label}</span>
        <span className={state === 'ok' ? 'text-muted-foreground' : 'text-tone-coral'}>
          {value} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${BAR_COLOR[state]}`}
          style={{ width: `${getUsagePct(value, limit) ?? 0}%` }}
        />
      </div>
    </div>
  )
}

export async function PlanUsage({ businessId, plan }: PlanUsageProps) {
  const supabase = await createClient()

  const { data: loyaltyCards } = await supabase
    .from('loyalty_cards')
    .select('id')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  const loyaltyCardIds = (loyaltyCards ?? []).map((c) => c.id)

  const { data: customerRows } = loyaltyCardIds.length > 0
    ? await supabase
        .from('customer_cards')
        .select('customer_id')
        .in('loyalty_card_id', loyaltyCardIds)
    : { data: [] }

  const customers = new Set((customerRows ?? []).map((r) => r.customer_id)).size
  const cards = loyaltyCardIds.length
  const limits = getPlanLimits(plan)

  const customerState = getUsageState(customers, limits.maxCustomers)
  const cardState = getUsageState(cards, limits.maxCards)
  const showWarning = customerState !== 'ok' || cardState !== 'ok'
  const isTopPlan = plan === 'premium'

  return (
    <div className="rounded-3xl border border-border bg-muted p-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Plan actual</span>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold capitalize text-accent-foreground">
          {plan}
        </span>
      </div>

      <UsageRow label="Clientes" value={customers} limit={limits.maxCustomers} />
      <UsageRow label="Tarjetas" value={cards} limit={limits.maxCards} />

      {customerState === 'full' && (
        <p className="mt-3 text-xs leading-relaxed text-tone-coral">
          Límite alcanzado. No se registrarán nuevos clientes.
        </p>
      )}
      {customerState === 'warning' && (
        <p className="mt-3 text-xs leading-relaxed text-tone-coral">
          Casi al límite. Quedan {(limits.maxCustomers ?? 0) - customers} espacios.
        </p>
      )}
      {cardState === 'full' && (
        <p className="mt-2 text-xs leading-relaxed text-tone-coral">Límite de tarjetas alcanzado.</p>
      )}

      {!isTopPlan && (
        <Link
          href="/settings#plan"
          className={`mt-4 flex h-11 items-center justify-center rounded-full text-sm font-extrabold transition-transform hover:-translate-y-0.5 ${
            showWarning || plan === 'free'
              ? 'bg-gradient-to-br from-[#FF8A5B] to-[#FF6B3D] text-white shadow-[0_10px_22px_rgba(255,107,61,0.35)]'
              : 'border border-border bg-card text-foreground'
          }`}
        >
          {plan === 'free' ? 'Mejorar a Pro' : 'Actualizar plan'}
        </Link>
      )}
    </div>
  )
}
