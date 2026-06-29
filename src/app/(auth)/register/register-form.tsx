'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { registerAction, type RegisterResult } from './actions'
import { Check } from 'lucide-react'

const PLANS = [
  {
    slug: 'free',
    label: 'Gratis',
    price: null,
    badge: null,
    description: 'Empieza sin riesgo. Sin tarjeta de crédito.',
  },
  {
    slug: 'basic',
    label: 'Básico',
    price: '$49.900/mes',
    badge: null,
    description: 'Hasta 3 tarjetas y 500 clientes.',
  },
  {
    slug: 'pro',
    label: 'Pro',
    price: '$99.900/mes',
    badge: 'Más popular',
    description: 'Hasta 10 tarjetas y 2.000 clientes.',
  },
  {
    slug: 'premium',
    label: 'Premium',
    price: '$179.900/mes',
    badge: null,
    description: 'Tarjetas y clientes ilimitados.',
  },
]

function SubmitButton({ isPaid }: { isPaid: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending
        ? 'Creando cuenta...'
        : isPaid
          ? 'Crear cuenta e ir a pagar →'
          : 'Crear cuenta gratis →'}
    </button>
  )
}

export function RegisterForm({ initialPlan }: { initialPlan: string }) {
  const [selectedPlan, setSelectedPlan] = useState(initialPlan)
  const [state, formAction] = useFormState<RegisterResult, FormData>(registerAction, null)

  useEffect(() => {
    if (state && 'checkoutUrl' in state) {
      window.location.href = state.checkoutUrl
    }
  }, [state])

  const isPaid = selectedPlan !== 'free'

  return (
    <div className="bg-card rounded-2xl p-8 border border-border">
      <h1 className="text-2xl font-black text-foreground mb-1">Crea tu cuenta</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {isPaid ? 'Completa tu registro y finaliza el pago en Mercado Pago.' : 'Empieza gratis, sin tarjeta de crédito.'}
      </p>

      {/* Plan selector */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Selecciona tu plan</p>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map((plan) => {
            const active = selectedPlan === plan.slug
            return (
              <button
                key={plan.slug}
                type="button"
                onClick={() => setSelectedPlan(plan.slug)}
                className={`relative text-left rounded-xl border px-3 py-2.5 transition-all ${
                  active
                    ? 'border-[#00C896] bg-[#00C896]/10 ring-1 ring-[#00C896]/40'
                    : 'border-border bg-muted/30 hover:border-muted-foreground/30'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2 right-2 bg-[#00C896] text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className={`text-xs font-bold ${active ? 'text-[#00C896]' : 'text-foreground'}`}>
                      {plan.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {plan.price ?? 'Gratis'}
                    </p>
                  </div>
                  {active && (
                    <Check size={12} className="text-[#00C896] mt-0.5 shrink-0" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="plan" value={selectedPlan} />

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
            Redirigiendo a Mercado Pago...
          </div>
        )}

        <SubmitButton isPaid={isPaid} />

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terms" className="hover:underline">Términos</Link>
          {' '}y{' '}
          <Link href="/privacy" className="hover:underline">Política de privacidad</Link>.
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
