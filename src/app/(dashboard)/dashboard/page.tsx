import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('owner_id', user!.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-1">
        Hola, {business?.name ?? 'bienvenido'} 👋
      </h1>
      <p className="text-slate-500 text-sm">
        Plan 3 construirá el dashboard completo con métricas y tabla de clientes.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg">
        {['Clientes activos', 'Sellos hoy', 'Canjes totales', 'Retención'].map(metric => (
          <div key={metric} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-xs font-medium mb-2">{metric}</p>
            <p className="text-3xl font-black text-white">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
