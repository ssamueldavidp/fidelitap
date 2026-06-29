'use client'

import { useState, useTransition } from 'react'
import { createCampaignAction } from './actions'

interface Card {
  id: string
  name: string
}

interface CampaignFormProps {
  cards: Card[]
}

const input =
  'w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#00C896] transition-colors'

export function CampaignForm({ cards }: CampaignFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const form = e.currentTarget
    const fd = new FormData(form)
    const scheduledAtLocal = fd.get('scheduledAt') as string
    if (scheduledAtLocal) {
      fd.set('scheduledAt', new Date(scheduledAtLocal).toISOString())
    }
    startTransition(async () => {
      const res = await createCampaignAction(fd)
      if (res?.error) setError(res.error)
      else {
        setSuccess(true)
        form.reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-card/50 border border-border rounded-xl p-5">
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Título</label>
        <input name="title" required maxLength={60} placeholder="Ej: 20% de descuento este finde" className={input} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Mensaje</label>
        <textarea
          name="body"
          required
          maxLength={150}
          rows={2}
          placeholder="Ej: Aplica en toda la tienda hasta el domingo"
          className={`${input} resize-none`}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Tarjeta</label>
        <select name="loyaltyCardId" className={input}>
          <option value="">Todas las tarjetas</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Programar envío (opcional)</label>
        <input name="scheduledAt" type="datetime-local" className={input} />
      </div>
      {error && <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-xs text-[#00C896]">✓ Campaña creada</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Enviando...' : 'Crear campaña'}
      </button>
    </form>
  )
}
