import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

type CustomerRow = {
  customer_id: string
  customer_name: string
  card_name: string
  loyalty_card_id: string
  current_stamps: number
  stamps_required: number
  times_completed: number
  last_visit: string | null
}

function relativeTime(date: string | null): string {
  if (!date) return 'Sin visitas'
  const diffMs = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; card?: string }
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

  const [customersResult, cardsResult] = await Promise.all([
    serviceClient.rpc('get_customers_list', {
      p_business_id: business.id,
      p_q: searchParams.q,
      p_card_id: searchParams.card,
    }),
    serviceClient
      .from('loyalty_cards')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const customers = (customersResult.data ?? []) as CustomerRow[]
  const loyaltyCards = cardsResult.data ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-foreground mb-6">Clientes</h1>

      {/* Search + filter */}
      <form className="flex gap-3 mb-6 flex-wrap">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Buscar por nombre..."
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] w-56"
        />
        <select
          name="card"
          defaultValue={searchParams.card ?? ''}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#00C896]"
        >
          <option value="">Todas las tarjetas</option>
          {loyaltyCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2 hover:bg-[#00b386] transition-colors"
        >
          Buscar
        </button>
        {(searchParams.q || searchParams.card) && (
          <Link href="/customers" className="text-muted-foreground text-sm underline self-center">
            Limpiar
          </Link>
        )}
      </form>

      {/* Table */}
      {customers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay clientes aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-3 pr-6 font-medium">Nombre</th>
                <th className="text-left py-3 pr-6 font-medium">Tarjeta</th>
                <th className="text-left py-3 pr-6 font-medium">Progreso</th>
                <th className="text-left py-3 pr-6 font-medium">Última visita</th>
                <th className="text-left py-3 font-medium">Completadas</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={`${c.customer_id}-${c.loyalty_card_id}`}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 pr-6">
                    <Link
                      href={`/customers/${c.customer_id}`}
                      className="text-foreground font-medium hover:text-[#00C896] transition-colors"
                    >
                      {c.customer_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-muted-foreground">{c.card_name}</td>
                  <td className="py-3 pr-6">
                    <span className="tracking-tight">
                      {Array.from({ length: c.stamps_required }).map((_, i) => (
                        <span
                          key={i}
                          className={i < c.current_stamps ? 'text-[#00C896]' : 'text-muted-foreground/30'}
                        >
                          ●
                        </span>
                      ))}
                    </span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {c.current_stamps}/{c.stamps_required}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-muted-foreground">{relativeTime(c.last_visit)}</td>
                  <td className="py-3 text-muted-foreground">{c.times_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
