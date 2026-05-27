import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Users, Stamp, Gift, TrendingUp } from 'lucide-react'
import { SubscriptionSuccessNotice } from '@/components/dashboard/subscription-success-notice'

const METRIC_CONFIG = [
  {
    key: 'activos' as const,
    label: 'Clientes activos',
    icon: Users,
    format: (v: number) => String(v),
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    description: 'Total acumulado',
  },
  {
    key: 'sellos_hoy' as const,
    label: 'Sellos hoy',
    icon: Stamp,
    format: (v: number) => String(v),
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Últimas 24 horas',
  },
  {
    key: 'canjes_totales' as const,
    label: 'Canjes totales',
    icon: Gift,
    format: (v: number) => String(v),
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    description: 'Premios entregados',
  },
  {
    key: 'retencion_pct' as const,
    label: 'Retención 30d',
    icon: TrendingUp,
    format: (v: number) => `${v}%`,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    description: 'Clientes recurrentes',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <Suspense fallback={null}>
        <SubscriptionSuccessNotice />
      </Suspense>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-foreground">
          Hola, {business.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{today}</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, format, color, bg, description }) => {
          const value = m ? format(m[key]) : null
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <p className="text-3xl font-black text-foreground mt-0.5">
                  {value ?? '—'}
                </p>
                <p className="text-muted-foreground text-xs mt-1">{description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Acciones rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/scanner"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Escanear QR
          </a>
          <a
            href="/cards/nueva"
            className="inline-flex items-center gap-2 bg-muted text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-muted/80 transition-colors"
          >
            Nueva tarjeta
          </a>
          <a
            href="/customers"
            className="inline-flex items-center gap-2 bg-muted text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-muted/80 transition-colors"
          >
            Ver clientes
          </a>
        </div>
      </div>
    </div>
  )
}
