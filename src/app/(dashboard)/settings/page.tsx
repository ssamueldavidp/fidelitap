/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SettingsForm } from './settings-form'
import { AccountForm } from './account-form'
import { SubscriptionTab } from '@/components/dashboard/subscription-tab'
import { LocationForm } from '@/components/dashboard/location-form'
import { GeofenceForm } from './geofence-form'
import { getPlanLimits, getUsageState, getUsagePct } from '@/lib/plan-limits'

type Tab = 'cuenta' | 'suscripcion' | 'uso' | 'scanner'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from('businesses')
    .select('id, name, plan, stamp_cooldown_seconds, lat, lng, geo_radius_m, address, latitude, longitude, timezone, geofence_enabled, geofence_radius_m, geofence_message, geofence_cooldown_h, quiet_hours_start, quiet_hours_end')
    .eq('owner_id', user.id)
    .single() as { data: Record<string, any> | null }

  const params = await searchParams
  const activeTab: Tab =
    params.tab === 'suscripcion' ? 'suscripcion'
    : params.tab === 'uso'      ? 'uso'
    : params.tab === 'scanner'  ? 'scanner'
    : 'cuenta'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cuenta',      label: 'Cuenta' },
    { key: 'suscripcion', label: 'Suscripción' },
    { key: 'uso',         label: 'Uso' },
    { key: 'scanner',     label: 'Scanner' },
  ]

  // Fetch usage metrics for the "Uso" tab
  type BusinessMetrics = { activos: number; sellos_hoy: number; canjes_totales: number; retencion_pct: number }
  let metrics: BusinessMetrics | null = null
  let cardCount = 0
  if (activeTab === 'uso' && business) {
    const serviceClient = createServiceClient()
    const [metricsRes, cardsRes] = await Promise.all([
      serviceClient.rpc('get_business_metrics', { p_business_id: business.id }),
      serviceClient
        .from('loyalty_cards')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .is('deleted_at', null),
    ])
    metrics = metricsRes.data as BusinessMetrics | null
    cardCount = cardsRes.count ?? 0
  }

  const limits = business ? getPlanLimits(business.plan) : getPlanLimits('free')

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-foreground mb-1">Ajustes</h1>
      <p className="text-muted-foreground text-sm mb-6">Configuración de tu cuenta y negocio.</p>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-xl p-1 mb-8 w-fit">
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
              Datos del negocio
            </h2>
            <AccountForm
              name={business?.name ?? ''}
              address={business?.address ?? null}
              latitude={business?.latitude ?? null}
              longitude={business?.longitude ?? null}
            />
          </div>
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Plan actual
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-foreground font-semibold capitalize">{business?.plan ?? 'free'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {limits.maxCards === null ? 'Tarjetas ilimitadas' : `Hasta ${limits.maxCards} tarjeta${limits.maxCards !== 1 ? 's' : ''}`}
                  {' · '}
                  {limits.maxCustomers === null ? 'Clientes ilimitados' : `Hasta ${limits.maxCustomers} clientes`}
                </p>
              </div>
              <a href="/settings?tab=suscripcion" className="text-xs text-primary hover:underline">
                Gestionar →
              </a>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Ubicación del negocio
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <LocationForm
                initialLat={(business as any)?.lat ?? null}
                initialLng={(business as any)?.lng ?? null}
                initialRadius={(business as any)?.geo_radius_m ?? 200}
              />
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Geofencing — Push automático
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <GeofenceForm
                plan={business?.plan ?? 'free'}
                enabled={business?.geofence_enabled ?? false}
                radiusM={business?.geofence_radius_m ?? 300}
                message={business?.geofence_message ?? null}
                cooldownH={business?.geofence_cooldown_h ?? 24}
                quietStart={business?.quiet_hours_start ?? 22}
                quietEnd={business?.quiet_hours_end ?? 6}
                timezone={business?.timezone ?? 'America/Bogota'}
              />
            </div>
          </div>
        </section>
      )}

      {/* Suscripción tab */}
      {activeTab === 'suscripcion' && <SubscriptionTab />}

      {/* Uso tab */}
      {activeTab === 'uso' && (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">Métricas de uso</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <_MetricBox label="Clientes activos" value={metrics?.activos ?? 0} />
            <_MetricBox label="Sellos hoy" value={metrics?.sellos_hoy ?? 0} color="text-primary" />
            <_MetricBox label="Canjes totales" value={metrics?.canjes_totales ?? 0} color="text-amber-400" />
            <_MetricBox label="Retención 30d" value={`${metrics?.retencion_pct ?? 0}%`} color="text-violet-400" />
          </div>

          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">Límites del plan</h2>
          <div className="flex flex-col gap-3">
            <_UsageBar
              label="Tarjetas creadas"
              current={cardCount}
              limit={limits.maxCards}
            />
            <_UsageBar
              label="Clientes registrados"
              current={metrics?.activos ?? 0}
              limit={limits.maxCustomers}
            />
          </div>
        </section>
      )}

      {/* Scanner tab */}
      {activeTab === 'scanner' && (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">Scanner</h2>
          <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
        </section>
      )}
    </div>
  )
}

function _MetricBox({ label, value, color = 'text-foreground' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function _UsageBar({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const state = getUsageState(current, limit)
  const pct = getUsagePct(current, limit) ?? 100
  const barColor =
    state === 'full' ? 'bg-red-500' :
    state === 'warning' ? 'bg-amber-400' :
    'bg-primary'

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-foreground font-medium">{label}</span>
        <span className={state === 'full' ? 'text-red-400 font-bold' : state === 'warning' ? 'text-amber-400 font-bold' : 'text-muted-foreground'}>
          {current}{limit !== null ? ` / ${limit}` : ' (ilimitado)'}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
