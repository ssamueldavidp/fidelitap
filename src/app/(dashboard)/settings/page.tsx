import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-white mb-1">Ajustes</h1>
      <p className="text-slate-500 text-sm mb-8">Configuración de tu negocio.</p>

      <section>
        <h2 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">
          Scanner
        </h2>
        <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
      </section>
    </div>
  )
}
