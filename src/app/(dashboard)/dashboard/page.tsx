import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: metricsRaw } = await serviceClient.rpc('get_business_metrics', {
    p_business_id: business.id,
  })

  const m = metricsRaw as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    retencion_pct: number
  } | null

  const cards = [
    { label: 'Clientes activos', value: m ? String(m.activos) : '—' },
    { label: 'Sellos hoy', value: m ? String(m.sellos_hoy) : '—' },
    { label: 'Canjes totales', value: m ? String(m.canjes_totales) : '—' },
    { label: 'Retención 30d', value: m ? `${m.retencion_pct}%` : '—' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-1">
        Hola, {business.name} 👋
      </h1>
      <p className="text-slate-500 text-sm mb-8">Tu resumen de hoy.</p>

      <div className="grid grid-cols-2 gap-4 max-w-lg">
        {cards.map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-xs font-medium mb-2">{label}</p>
            <p className="text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
