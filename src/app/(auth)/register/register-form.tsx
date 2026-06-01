'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { useEffect } from 'react'
import Link from 'next/link'
import { registerAction, type RegisterResult } from './actions'

const PLAN_LABELS: Record<string, string> = {
  free:    'Gratis',
  basic:   'Básico — $49.900/mes',
  pro:     'Pro — $99.900/mes',
  premium: 'Premium — $179.900/mes',
}

const PLAN_COLORS: Record<string, string> = {
  free:    'bg-slate-800 text-slate-300 border-slate-700',
  basic:   'bg-blue-950 text-blue-300 border-blue-800',
  pro:     'bg-[#00C896]/10 text-[#00C896] border-[#00C896]/30',
  premium: 'bg-amber-950 text-amber-300 border-amber-800',
}

function SubmitButton({ plan }: { plan: string }) {
  const { pending } = useFormStatus()
  const isPaid = ['basic', 'pro', 'premium'].includes(plan)
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending
        ? (isPaid ? 'Creando cuenta...' : 'Creando cuenta...')
        : isPaid
          ? 'Crear cuenta e ir a pagar →'
          : 'Crear cuenta gratis →'}
    </button>
  )
}

export function RegisterForm({ initialPlan }: { initialPlan: string }) {
  const [state, formAction] = useFormState<RegisterResult, FormData>(registerAction, null)

  // Redirect to MercadoPago checkout if action returns a checkoutUrl
  useEffect(() => {
    if (state && 'checkoutUrl' in state) {
      window.location.href = state.checkoutUrl
    }
  }, [state])

  const isPaid = ['basic', 'pro', 'premium'].includes(initialPlan)

  return (
    <div className="bg-card rounded-2xl p-8 border border-border">
      <h1 className="text-2xl font-black text-foreground mb-1">Crea tu cuenta</h1>
      <p className="text-muted-foreground text-sm mb-5">
        {isPaid ? 'Completa tu registro y finaliza el pago.' : 'Empieza gratis, sin tarjeta de crédito.'}
      </p>

      {/* Plan seleccionado */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 border mb-6 ${PLAN_COLORS[initialPlan] ?? PLAN_COLORS.free}`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">Plan seleccionado</p>
          <p className="font-bold text-sm">{PLAN_LABELS[initialPlan] ?? 'Gratis'}</p>
        </div>
        <Link href="/pricing" className="text-[10px] underline opacity-50 hover:opacity-80">
          Cambiar
        </Link>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {/* Campo oculto con el plan */}
        <input type="hidden" name="plan" value={initialPlan} />

        <div>
          <label htmlFor="businessName" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Nombre de tu negocio
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            autoComplete="organization"
            required
            placeholder="Café Luna, Studio Hair..."
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@negocio.com"
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {state && 'error' in state && (
          <div role="alert" className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        {state && 'checkoutUrl' in state && (
          <div className="bg-[#00C896]/10 border border-[#00C896]/30 rounded-xl px-4 py-3 text-sm text-[#00C896]">
            Redirigiendo al pago...
          </div>
        )}

        <SubmitButton plan={initialPlan} />

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terms" className="text-muted-foreground hover:underline">Términos de servicio</Link>
          {' '}y{' '}
          <Link href="/privacy" className="text-muted-foreground hover:underline">Política de privacidad</Link>.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#00C896] font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
