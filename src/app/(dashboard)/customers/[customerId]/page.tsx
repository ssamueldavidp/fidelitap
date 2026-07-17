import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export default async function CustomerDetailPage({
  params,
}: {
  params: { customerId: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()

  // Fetch customer basic info
  const { data: customer } = await serviceClient
    .from('customers')
    .select('id, name, email')
    .eq('id', params.customerId)
    .single()
  if (!customer) notFound()

  // Fetch customer's card records
  const { data: customerCardRecords } = await serviceClient
    .from('customer_cards')
    .select('id, current_stamps, times_completed, loyalty_card_id')
    .eq('customer_id', params.customerId)

  if (!customerCardRecords || customerCardRecords.length === 0) notFound()

  // Fetch loyalty cards for those customer cards (filter by business)
  const { data: loyaltyCards } = await serviceClient
    .from('loyalty_cards')
    .select('id, name, stamps_required, business_id')
    .in(
      'id',
      customerCardRecords.map((cc) => cc.loyalty_card_id)
    )

  // Filter to only cards belonging to this business
  const validCardIds = (loyaltyCards ?? [])
    .filter((lc) => lc.business_id === business.id)
    .map((lc) => lc.id)

  if (validCardIds.length === 0) notFound()

  const customerCards = customerCardRecords.filter((cc) =>
    validCardIds.includes(cc.loyalty_card_id)
  )

  const cardLookup = new Map(
    (loyaltyCards ?? []).map((lc) => [lc.id, lc])
  )

  // Fetch stamp history for these customer cards
  const { data: stampEvents } = await serviceClient
    .from('stamp_events')
    .select('id, created_at, customer_card_id')
    .in('customer_card_id', customerCards.map((cc) => cc.id))
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/customers" className="text-muted-foreground text-sm hover:text-foreground mb-6 inline-block">
        ← Volver a clientes
      </Link>

      <h1 className="text-2xl font-black text-foreground mb-1">{customer.name}</h1>
      {customer.email && <p className="text-muted-foreground text-sm mb-6">{customer.email}</p>}

      {/* Card summaries */}
      <div className="flex flex-col gap-3 mb-8">
        {customerCards.map((cc) => {
          const lc = cardLookup.get(cc.loyalty_card_id)
          if (!lc) return null
          return (
            <div key={cc.id} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{lc.name}</p>
              <div className="flex items-center gap-3">
                <span className="tracking-tight">
                  {Array.from({ length: lc.stamps_required }).map((_, i) => (
                    <span
                      key={i}
                      className={i < cc.current_stamps ? 'text-[#00C896]' : 'text-muted-foreground/30'}
                    >
                      ●
                    </span>
                  ))}
                </span>
                <span className="text-muted-foreground text-sm">
                  {cc.current_stamps}/{lc.stamps_required}
                </span>
                <span className="text-muted-foreground/60 text-xs">·</span>
                <span className="text-muted-foreground text-xs">{cc.times_completed} completadas</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stamp history */}
      <h2 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
        Historial de sellos
      </h2>
      {!stampEvents || stampEvents.length === 0 ? (
        <p className="text-muted-foreground/60 text-sm">Sin sellos registrados.</p>
      ) : (
        <div className="flex flex-col">
          {stampEvents.map((se) => {
            const d = new Date(se.created_at)
            return (
              <div key={se.id} className="flex items-center gap-4 py-3 border-b border-border/50">
                <div className="w-2 h-2 rounded-full bg-[#00C896] shrink-0" />
                <span className="text-foreground text-sm">
                  {d.toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-muted-foreground text-sm">
                  {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-muted-foreground/60 text-xs ml-auto">Cajero</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
