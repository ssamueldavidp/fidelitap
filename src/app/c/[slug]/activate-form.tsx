'use client'

import { useState, useTransition } from 'react'
import { Shield, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { activateCardAction, recoverCardAction } from './actions'
import { SuccessScreen } from './success-screen'

interface ActivateFormProps {
  loyaltyCardId: string
  businessId:   string
  shareUrl:     string
  businessPlan: string
  businessSubscriptionStatus: string
}

type CardResult = {
  customerCardId:  string
  walletAuthToken: string
  alreadyHadCard:  boolean
}

export function ActivateForm({ loyaltyCardId, businessId, shareUrl, businessPlan, businessSubscriptionStatus }: ActivateFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error,     setError]        = useState<string | null>(null)
  const [result,    setResult]       = useState<CardResult | null>(null)
  const [showRecover, setShowRecover] = useState(false)
  const [recoverPending, startRecoverTransition] = useTransition()
  const [recoverError,   setRecoverError]        = useState<string | null>(null)

  if (result) return <SuccessScreen {...result} shareUrl={shareUrl} businessPlan={businessPlan} businessSubscriptionStatus={businessSubscriptionStatus} />

  function handleActivate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('loyalty_card_id', loyaltyCardId)
    fd.append('business_id',     businessId)

    startTransition(async () => {
      const res = await activateCardAction(fd)
      if ('error' in res) setError(res.error)
      else setResult(res)
    })
  }

  function handleRecover(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setRecoverError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('loyalty_card_id', loyaltyCardId)

    startRecoverTransition(async () => {
      const res = await recoverCardAction(fd)
      if ('error' in res) setRecoverError(res.error)
      else setResult(res)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Activation form ── */}
      <form onSubmit={handleActivate} className="flex flex-col gap-3.5">

        {/* Name */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            Nombre completo <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ej: María García"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="Ej: maria@gmail.com"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Tu email identifica tu tarjeta. Usa siempre el mismo.
          </p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
            Celular <span className="text-muted-foreground/60">(opcional)</span>
          </label>
          <input
            name="phone"
            type="tel"
            maxLength={20}
            placeholder="Ej: 3001234567"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {/* Anti-fraud notice */}
        <div className="flex items-start gap-2 bg-muted/60 border border-border/50 rounded-lg px-3 py-2.5">
          <Shield size={13} className="text-[#00C896] mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cada email puede tener solo una tarjeta por negocio. Si perdiste el acceso, usa
            la opción <span className="text-[#00C896]">Recuperar tarjeta</span> abajo.
          </p>
        </div>

        {/* Data consent — required */}
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            name="data_consent"
            type="checkbox"
            value="true"
            required
            className="mt-0.5 accent-[#00C896] shrink-0"
          />
          <span className="text-[11px] text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
            Acepto el{' '}
            <a href="/privacy" target="_blank" className="text-[#00C896] underline underline-offset-2">
              tratamiento de mis datos personales
            </a>{' '}
            conforme a la Ley 1581 de 2012. <span className="text-red-400">*</span>
          </span>
        </label>

        {/* Marketing consent — optional */}
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            name="marketing"
            type="checkbox"
            value="true"
            className="mt-0.5 accent-[#00C896] shrink-0"
          />
          <span className="text-[11px] text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
            Acepto recibir comunicaciones y promociones del negocio por email.
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Activando...' : 'Activar mi tarjeta'}
        </button>
      </form>

      {/* ── Recover card section ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRecover(v => !v)}
          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={13} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">¿Perdiste o eliminaste tu tarjeta?</span>
          </div>
          {showRecover
            ? <ChevronUp size={13} className="text-muted-foreground/60" />
            : <ChevronDown size={13} className="text-muted-foreground/60" />}
        </button>

        {showRecover && (
          <form onSubmit={handleRecover} className="px-4 pb-4 flex flex-col gap-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground pt-3 leading-relaxed">
              Ingresa el email con el que activaste la tarjeta y te enviamos el enlace a tu Wallet.
            </p>
            <input
              name="email"
              type="email"
              required
              placeholder="Tu email de activación"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
            />
            {recoverError && (
              <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
                {recoverError}
              </p>
            )}
            <button
              type="submit"
              disabled={recoverPending}
              className="bg-muted text-foreground font-semibold text-sm rounded-lg py-2.5 hover:bg-muted/70 disabled:opacity-50 transition-colors"
            >
              {recoverPending ? 'Buscando...' : 'Recuperar tarjeta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
