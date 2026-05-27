import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { SubscriptionTab } from '@/components/dashboard/subscription-tab'

type Tab = 'cuenta' | 'suscripcion' | 'scanner'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()

  const params = await searchParams
  const activeTab: Tab =
    params.tab === 'suscripcion' ? 'suscripcion'
    : params.tab === 'scanner'  ? 'scanner'
    : 'cuenta'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cuenta',      label: 'Cuenta' },
    { key: 'suscripcion', label: 'Suscripción' },
    { key: 'scanner',     label: 'Scanner' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-foreground mb-1">Ajustes</h1>
      <p className="text-muted-foreground text-sm mb-6">Configuración de tu cuenta y negocio.</p>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-8 w-fit">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Cuenta tab */}
      {activeTab === 'cuenta' && (
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Negocio
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm text-muted-foreground mb-1">Nombre del negocio</p>
              <p className="text-foreground font-semibold">{business?.name}</p>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Plan actual
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
              <p className="text-foreground font-semibold capitalize">{business?.plan ?? 'free'}</p>
              <a
                href="/settings?tab=suscripcion"
                className="text-xs text-primary hover:underline"
              >
                Gestionar →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Suscripción tab */}
      {activeTab === 'suscripcion' && <SubscriptionTab />}

      {/* Scanner tab */}
      {activeTab === 'scanner' && (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
            Scanner
          </h2>
          <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
        </section>
      )}
    </div>
  )
}
