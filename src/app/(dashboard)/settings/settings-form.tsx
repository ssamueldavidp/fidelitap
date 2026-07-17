'use client'

import { useState, useTransition } from 'react'
import { saveSettingsAction } from './actions'

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'Sin cooldown' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
  { value: 900, label: '15 minutos' },
  { value: 3600, label: '1 hora' },
  { value: 86400, label: '24 horas' },
]

export function SettingsForm({ cooldownSeconds }: { cooldownSeconds: number }) {
  const [value, setValue] = useState(cooldownSeconds)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setError('')
    startTransition(async () => {
      const res = await saveSettingsAction(value)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Cooldown entre sellos</label>
        <select
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#00C896]"
        >
          {COOLDOWN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Tiempo mínimo entre dos sellos para el mismo cliente.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00b386] disabled:opacity-40 transition-colors self-start"
      >
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>

      {saved && <p className="text-[#00C896] text-sm">✓ Configuración guardada</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  )
}
