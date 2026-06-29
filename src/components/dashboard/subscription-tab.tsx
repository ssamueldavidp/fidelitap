'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

type SubscriptionData = {
  plan: string
  subscriptionStatus: string
  subscriptionEndDate: string | null
  paymentHistory: {
    id: string
    event_type: string
    plan_slug: string | null
    amount_cop: number | null
    status: string | null
    created_at: string
  }[]
}

const PLAN_PRICES: Record<string, number> = {
  basic:   49900,
  pro:     99900,
  premium: 179900,
}

const PLAN_LABELS: Record<string, string> = {
  free:    'Gratis',
  basic:   'Básico',
  pro:     'Pro',
  premium: 'Premium',
}

const STATUS_CONFIG = {
  active:         { label: 'Activo',               color: 'text-green-400',  icon: CheckCircle2 },
  pending_cancel: { label: 'Cancelación pendiente', color: 'text-amber-400', icon: AlertTriangle },
  canceled:       { label: 'Cancelado',             color: 'text-red-400',   icon: XCircle },
  past_due:       { label: 'Pago pendiente',        color: 'text-amber-400', icon: AlertTriangle },
  trialing:       { label: 'En prueba',             color: 'text-blue-400',  icon: CheckCircle2 },
}

const EVENT_LABELS: Record<string, string> = {
  payment_success:        'Pago exitoso',
  payment_failed:         'Pago fallido',
  subscription_created:   'Suscripción creada',
  subscription_cancelled: 'Suscripción cancelada',
  payment_received:       'Pago recibido',
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(iso))
}

export function SubscriptionTab() {
  const searchParams = useSearchParams()
  const paymentFailed = searchParams.get('payment') === 'failed'
  const [data, setData]       = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [cancelMsg, setCancelMsg]    = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/subscriptions/status')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Error cargando datos de suscripción'); setLoading(false) })
  }, [])

  const handleUpgrade = (planSlug: string) => {
    startTransition(async () => {
      const res  = await fetch('/api/subscriptions/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planSlug }),
      })
      const json = await res.json()
      if (json.init_point) {
        window.location.href = json.init_point
      } else {
        setError(json.error ?? 'Error al iniciar la suscripción')
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('¿Estás seguro que deseas cancelar tu suscripción? Tu plan seguirá activo hasta el final del período.')) return
    startTransition(async () => {
      const res  = await fetch('/api/subscriptions/cancel', { method: 'POST' })
      const json = await res.json()
      if (json.availableUntil) {
        setCancelMsg(`Tu plan estará activo hasta el ${formatDate(json.availableUntil)}`)
        const status = await fetch('/api/subscriptions/status').then((r) => r.json())
        setData(status)
      } else {
        setError(json.error ?? 'Error al cancelar')
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Cargando suscripción...</span>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-400 py-4">{error}</p>
  }

  if (!data) return null

  const PLAN_ORDER = ['free', 'basic', 'pro', 'premium']
  const statusCfg  = STATUS_CONFIG[data.subscriptionStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active
  const StatusIcon = statusCfg.icon
  const isPaid     = data.plan !== 'free'
  const planPrice  = PLAN_PRICES[data.plan]
  const upgradePlans = (['basic', 'pro', 'premium'] as const).filter(
    (slug) => PLAN_ORDER.indexOf(slug) > PLAN_ORDER.indexOf(data.plan)
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Plan actual</p>
            <p className="text-2xl font-black text-foreground">{PLAN_LABELS[data.plan] ?? data.plan}</p>
          </div>
          {isPaid && planPrice && (
            <p className="text-sm text-muted-foreground">{formatCOP(planPrice)}/mes</p>
          )}
        </div>

        <div className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
          <StatusIcon size={14} />
          <span>{statusCfg.label}</span>
        </div>

        {data.subscriptionStatus === 'pending_cancel' && data.subscriptionEndDate && (
          <p className="mt-2 text-sm text-amber-400">
            Activo hasta el {formatDate(data.subscriptionEndDate)}
          </p>
        )}

        {cancelMsg && (
          <p className="mt-2 text-sm text-green-400">{cancelMsg}</p>
        )}
      </div>

      {/* Payment failed banner */}
      {paymentFailed && (
        <div className="flex items-start gap-3 bg-amber-950/50 border border-amber-700/50 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Pago no completado</p>
            <p className="text-xs text-amber-400/80 mt-0.5">Puedes intentarlo de nuevo seleccionando tu plan a continuación.</p>
          </div>
        </div>
      )}

      {/* Upgrade options */}
      {upgradePlans.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {data.plan === 'free' ? 'Elige tu plan' : 'Mejorar plan'}
          </p>
          {upgradePlans.map((slug) => (
            <div key={slug} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-foreground text-sm">{PLAN_LABELS[slug]}</p>
                <p className="text-xs text-muted-foreground">{formatCOP(PLAN_PRICES[slug])}/mes</p>
              </div>
              <button
                type="button"
                onClick={() => handleUpgrade(slug)}
                disabled={isPending}
                className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Suscribirme
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cancel subscription */}
      {isPaid && data.subscriptionStatus === 'active' && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="text-sm text-muted-foreground hover:text-red-400 transition-colors self-start disabled:opacity-50"
        >
          {isPending ? 'Cancelando...' : 'Cancelar suscripción'}
        </button>
      )}

      {/* Payment history */}
      {data.paymentHistory.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Historial de pagos
          </p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Evento</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentHistory.map((ev) => (
                  <tr key={ev.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(ev.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs">
                      {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs text-right">
                      {ev.amount_cop ? formatCOP(ev.amount_cop) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
