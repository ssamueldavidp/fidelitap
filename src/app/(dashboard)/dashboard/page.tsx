import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getDashboardOverview, timeAgo, type ActivityItem } from '@/lib/dashboard/overview'
import { resolveStorageUrl } from '@/lib/storage-url'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { SubscriptionSuccessNotice } from '@/components/dashboard/subscription-success-notice'
import type { CardDesignConfig } from '@/types/database'
import {
  Users,
  CheckCircle2,
  Gift,
  TrendingUp,
  Plus,
  ScanLine,
  Check,
  Sparkles,
} from 'lucide-react'

const card = 'rounded-[28px] border border-border bg-card shadow-card'
const rise = 'animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both'

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  note,
  delay,
}: {
  icon: typeof Users
  tone: 'primary' | 'sky' | 'sun' | 'lilac'
  label: string
  value: string
  note: string
  delay: number
}) {
  const toneClass = {
    primary: 'bg-accent text-accent-foreground',
    sky: 'bg-tone-sky-soft text-tone-sky',
    sun: 'bg-tone-sun-soft text-tone-sun',
    lilac: 'bg-tone-lilac-soft text-tone-lilac',
  }[tone]
  return (
    <div className={`${card} ${rise} p-4 transition-transform hover:-translate-y-1 sm:p-6`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-[46px] w-[46px] items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon size={24} strokeWidth={1.9} />
        </span>
        <span className={`hidden rounded-full px-2.5 py-1 text-xs font-extrabold sm:inline-block ${toneClass}`}>{note}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted-foreground sm:mt-[18px]">{label}</p>
      <p className="mt-1 font-display text-[34px] sm:text-[44px] font-bold leading-none tracking-tight">{value}</p>
    </div>
  )
}

function Activity({ item, now }: { item: ActivityItem; now: number }) {
  const isReward = item.kind === 'reward'
  return (
    <div className="flex items-center gap-3.5 rounded-2xl p-3">
      <span
        className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full font-display text-[17px] font-bold ${
          isReward ? 'bg-tone-sun-soft text-tone-sun' : 'bg-accent text-accent-foreground'
        }`}
      >
        {item.who.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{item.who}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{isReward ? 'canjeó su premio' : 'sumó 1 sello'}</p>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-extrabold ${
            isReward ? 'bg-tone-sun-soft text-tone-sun' : 'bg-accent text-accent-foreground'
          }`}
        >
          {isReward ? 'Premio' : 'Sello'}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.at, now)}</p>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const service = createServiceClient()
  const [metricsRes, overview, cardsRes] = await Promise.all([
    service.rpc('get_business_metrics', { p_business_id: business.id }),
    getDashboardOverview(business.id),
    supabase
      .from('loyalty_cards')
      .select('id, name, benefit_description, stamps_required, design_config')
      .eq('business_id', business.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])

  const m = metricsRes.data as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    total_clientes: number
    retencion_pct: number
  } | null

  const cards = cardsRes.data ?? []
  const firstCard = cards[0]
  const design = firstCard?.design_config as unknown as CardDesignConfig | undefined

  const steps = [
    { label: 'Crear tu cuenta', done: true, href: null as string | null, cta: '' },
    { label: 'Diseñar tu tarjeta de sellos', done: cards.length > 0, href: '/cards/nueva', cta: 'Crear' },
    { label: 'Descargar y pegar tu cartel QR', done: overview.hasAnyStamp || (m?.total_clientes ?? 0) > 0, href: '/poster', cta: 'Descargar' },
    { label: 'Dar el primer sello', done: overview.hasAnyStamp, href: '/scanner', cta: 'Escanear' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const showOnboarding = doneCount < steps.length

  const maxDay = Math.max(1, ...overview.days.map((d) => d.count))
  const delta = overview.stampsToday - overview.stampsYesterday
  const now = Date.now()
  const todayRaw = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
  const todayLabel = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1)
  const hasMetrics = m !== null
  const showUpsell = business.plan === 'free' || business.plan === 'basic'

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-5 md:p-8">
      <Suspense fallback={null}>
        <SubscriptionSuccessNotice />
      </Suspense>

      {/* Saludo */}
      <div className={`${rise} flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{todayLabel}</p>
          <h1 className="mt-1.5 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-[42px]">
            Hola, {business.name}
          </h1>
          <p className="mt-2 text-[17px] text-muted-foreground">Así va tu negocio hoy.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/cards/nueva"
            className="inline-flex h-[52px] items-center gap-2 rounded-full border border-border bg-card px-5 text-[15px] font-bold shadow-card transition-transform hover:-translate-y-0.5"
          >
            <Plus size={18} strokeWidth={2.2} /> Nueva tarjeta
          </Link>
          <Link
            href="/scanner"
            className="inline-flex h-[52px] items-center gap-2 rounded-full bg-gradient-to-br from-[#0A9F5B] to-[#087A47] px-6 text-[15px] font-extrabold text-white shadow-[0_12px_26px_rgba(10,159,91,0.4)] transition-transform hover:-translate-y-0.5"
          >
            <ScanLine size={18} strokeWidth={2.2} /> Escanear QR
          </Link>
        </div>
      </div>

      {/* Primeros pasos + tu tarjeta */}
      {(showOnboarding || firstCard) && (
        <div className={`grid gap-6 ${showOnboarding && firstCard ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
          {showOnboarding && (
            <section
              className={`${rise} relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0FB36A] via-[#087A47] to-[#055B35] p-7 text-white shadow-[0_24px_50px_rgba(8,122,71,0.35)] md:p-8`}
              style={{ animationDelay: '80ms' }}
            >
              <div className="pointer-events-none absolute -right-14 -top-14 h-64 w-64 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-white/[0.08]" />
              <div className="relative max-w-[460px]">
                <span className="inline-flex rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest">
                  Primeros pasos · {doneCount} de {steps.length}
                </span>
                <h2 className="mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-tight md:text-[30px]">
                  {steps.length - doneCount === 1
                    ? 'Te falta 1 paso para empezar a fidelizar'
                    : `Te faltan ${steps.length - doneCount} pasos para sellar tu primer cliente`}
                </h2>
                <div className="mt-[18px] h-2.5 overflow-hidden rounded-full bg-white/[0.22]">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                </div>
                <ul className="mt-6 flex flex-col gap-3">
                  {steps.map((s) => (
                    <li key={s.label} className={`flex items-center justify-between gap-3 text-base font-semibold ${s.done ? '' : 'opacity-95'}`}>
                      <span className="flex items-center gap-3">
                        {s.done ? (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#087A47]">
                            <Check size={16} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="h-7 w-7 shrink-0 rounded-full border-2 border-white/70" />
                        )}
                        {s.label}
                      </span>
                      {!s.done && s.href && (
                        <Link href={s.href} className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#087A47]">
                          {s.cta}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {firstCard && design && (
            <section
              className={`${card} ${rise} flex flex-col gap-4 p-7 ${showOnboarding ? '' : 'md:flex-row md:items-center md:gap-10'}`}
              style={{ animationDelay: '140ms' }}
            >
              <div className={showOnboarding ? 'flex items-center justify-between' : 'md:hidden flex items-center justify-between'}>
                <h2 className="font-display text-[22px] font-bold tracking-tight">Tu tarjeta</h2>
                <Link href={`/cards/${firstCard.id}/editar`} className="rounded-full bg-accent px-4 py-2 text-[13px] font-extrabold text-accent-foreground">
                  Editar
                </Link>
              </div>
              <div className="flex shrink-0 justify-center">
                <WalletPreview
                  businessName={firstCard.name}
                  name={firstCard.name}
                  benefitDescription={firstCard.benefit_description}
                  stampsRequired={firstCard.stamps_required}
                  stampIcon={design.stamp_icon ?? '⭐'}
                  color={design.color ?? '#00C896'}
                  cardStyle={design.style ?? 'clean'}
                  bgMode={design.bg_mode ?? 'light'}
                  bgType={design.bg_type === 'image' ? 'image' : 'solid'}
                  bgImageUrl={resolveStorageUrl(design.bg_image_url)}
                  logoUrl={resolveStorageUrl(design.logo_url) ?? undefined}
                  filledStamps={Math.ceil(firstCard.stamps_required * 0.6)}
                  size="sm"
                />
              </div>
              <div className={showOnboarding ? 'contents' : 'flex min-w-0 flex-1 flex-col gap-4'}>
                {!showOnboarding && (
                  <div className="hidden md:block">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Tu tarjeta</p>
                    <h2 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight">{firstCard.name}</h2>
                    <p className="mt-2 text-[15px] text-muted-foreground">
                      {firstCard.stamps_required} sellos = {firstCard.benefit_description}
                    </p>
                  </div>
                )}
                <div className={`flex flex-wrap gap-2.5 ${showOnboarding ? 'justify-center' : ''}`}>
                  {!showOnboarding && (
                    <Link href={`/cards/${firstCard.id}/editar`} className="hidden rounded-full bg-accent px-5 py-2.5 text-sm font-extrabold text-accent-foreground md:inline-flex">
                      Editar tarjeta
                    </Link>
                  )}
                  <Link href="/poster" className="rounded-full border border-border bg-muted px-[18px] py-2.5 text-sm font-bold">Ver cartel QR</Link>
                  <Link href="/cards" className="rounded-full border border-border bg-muted px-[18px] py-2.5 text-sm font-bold">Mis tarjetas</Link>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <Kpi icon={Users} tone="primary" label="Clientes activos" value={hasMetrics ? String(m.activos) : '—'} note={`${m?.total_clientes ?? 0} en total`} delay={200} />
        <Kpi
          icon={CheckCircle2}
          tone="sky"
          label="Sellos hoy"
          value={String(overview.stampsToday)}
          note={delta === 0 ? 'igual que ayer' : `${delta > 0 ? '+' : ''}${delta} vs ayer`}
          delay={260}
        />
        <Kpi icon={Gift} tone="sun" label="Premios canjeados" value={hasMetrics ? String(m.canjes_totales) : '—'} note={`${overview.rewardsThisMonth} este mes`} delay={320} />
        <Kpi icon={TrendingUp} tone="lilac" label="Clientes que regresan" value={hasMetrics ? `${m.retencion_pct}%` : '—'} note="30 días" delay={380} />
      </div>

      {/* Gráfica + actividad */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} ${rise} p-7`} style={{ animationDelay: '400ms' }}>
          <div>
            <h2 className="font-display text-[22px] font-bold tracking-tight">Sellos esta semana</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {overview.weekTotal} {overview.weekTotal === 1 ? 'sello' : 'sellos'} en los últimos 7 días
            </p>
          </div>
          <div className="mt-6 flex h-[250px] items-end gap-3.5" role="img" aria-label={`Sellos por día: ${overview.days.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
            {overview.days.map((d) => {
              const px = d.count === 0 ? 8 : Math.max(14, Math.round((d.count / maxDay) * 176))
              return (
                <div key={d.key} className="relative flex h-full flex-1 flex-col items-center justify-end gap-2.5">
                  {d.count > 0 && (
                    <span className="text-[13px] font-extrabold tabular-nums">{d.count}</span>
                  )}
                  <div
                    className={`w-full max-w-[56px] origin-bottom rounded-t-2xl rounded-b-lg bar-grow ${
                      d.isToday
                        ? 'bg-gradient-to-b from-[#34D399] to-[#0A9F5B]'
                        : d.count === 0
                          ? 'bg-border'
                          : 'bg-accent'
                    }`}
                    style={{ height: px }}
                  />
                  <span className={`text-[13px] font-bold ${d.isToday ? 'text-foreground' : 'text-muted-foreground'}`}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`${card} ${rise} p-7`} style={{ animationDelay: '460ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-bold tracking-tight">Actividad reciente</h2>
            <Link href="/customers" className="text-sm font-bold text-primary">Ver clientes</Link>
          </div>
          {overview.activity.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-muted px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles size={22} />
              </span>
              <p className="text-[15px] font-bold">Aún no hay actividad</p>
              <p className="max-w-[260px] text-sm text-muted-foreground">Cuando des el primer sello, aparecerá aquí.</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-1.5">
              {overview.activity.map((a) => (
                <Activity key={a.id} item={a} now={now} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Oferta Pro */}
      {showUpsell && (
        <section
          className={`${rise} relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-[#FF8A5B] via-[#FF6B3D] to-[#E8452C] px-7 py-8 text-white shadow-[0_24px_50px_rgba(255,107,61,0.32)] md:px-9`}
          style={{ animationDelay: '500ms' }}
        >
          <div className="pointer-events-none absolute -top-12 right-[18%] h-44 w-44 rounded-full bg-white/[0.12]" />
          <div className="relative max-w-[620px]">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] opacity-90">Plan Pro</p>
            <h2 className="mt-2 font-display text-[28px] font-bold leading-[1.1] tracking-tight md:text-[30px]">
              Aparece en Tiendas cercanas y avisa a tus clientes
            </h2>
            <p className="mt-2.5 text-base leading-relaxed opacity-95">
              Notificaciones push, alertas de proximidad y estadísticas de retención para que vuelvan más seguido.
            </p>
          </div>
          <Link
            href="/settings#plan"
            className="relative inline-flex h-14 items-center rounded-full bg-white px-8 text-base font-extrabold text-[#D9431F] shadow-[0_12px_26px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
          >
            Ver planes
          </Link>
        </section>
      )}
    </div>
  )
}
