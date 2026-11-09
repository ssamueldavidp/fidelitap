'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, X } from 'lucide-react'

type Phase = 'hidden' | 'activating' | 'done' | 'slow'

// Al volver de MercadoPago el plan lo activa el webhook, que puede tardar unos segundos.
// Se consulta el estado hasta que el plan cambie y entonces se refresca el panel.
export function SubscriptionSuccessNotice({ currentPlan }: { currentPlan?: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    if (params.get('subscription') !== 'success') return
    window.history.replaceState({}, '', '/dashboard')
    setPhase('activating')

    let stopped = false
    let tries = 0
    const tick = async () => {
      if (stopped) return
      tries++
      try {
        const res = await fetch('/api/subscriptions/status', { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as { plan: string; subscriptionStatus: string }
          if (data.plan !== currentPlan && data.subscriptionStatus === 'active') {
            setPhase('done')
            router.refresh()
            return
          }
        }
      } catch { /* reintenta */ }
      if (tries >= 20) { setPhase('slow'); return }
      setTimeout(tick, 3000)
    }
    tick()
    return () => { stopped = true }
  }, [params, currentPlan, router])

  if (phase === 'hidden') return null

  const text =
    phase === 'activating' ? 'Estamos activando tu plan…'
    : phase === 'done' ? '¡Listo! Tu plan ya está activo.'
    : 'Recibimos tu pago. La activación puede tardar un par de minutos; si no ves el cambio, recarga la página.'

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/30 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card"
    >
      {phase === 'activating' ? <Loader2 size={16} className="animate-spin text-primary" /> : <CheckCircle2 size={16} className="text-primary" />}
      {text}
      <button type="button" onClick={() => setPhase('hidden')} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
        <X size={14} />
      </button>
    </div>
  )
}
