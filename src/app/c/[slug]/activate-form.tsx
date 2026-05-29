'use client'

import { useState, useTransition } from 'react'
import { activateCardAction } from './actions'
import { SuccessScreen } from './success-screen'

interface ActivateFormProps {
  loyaltyCardId: string
  businessId: string
  shareUrl: string
}

export function ActivateForm({ loyaltyCardId, businessId, shareUrl }: ActivateFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    customerCardId: string
    walletAuthToken: string
    alreadyHadCard: boolean
  } | null>(null)

  if (result) return <SuccessScreen {...result} shareUrl={shareUrl} />

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('loyalty_card_id', loyaltyCardId)
    fd.append('business_id', businessId)

    startTransition(async () => {
      const res = await activateCardAction(fd)
      if ('error' in res) {
        setError(res.error)
      } else {
        setResult(res)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Tu nombre</label>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Ej: María García"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Tu email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="Ej: maria@gmail.com"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
        />
      </div>

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

      <p className="text-xs text-slate-600 text-center">
        Sin contraseña. Solo nombre y email.
      </p>
    </form>
  )
}
