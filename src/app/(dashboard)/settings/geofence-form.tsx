'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { saveGeofenceAction } from './actions'
import { Lock, Radio } from 'lucide-react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Guardando…' : 'Guardar geofencing'}
    </button>
  )
}

interface Props {
  plan: string
  enabled: boolean
  radiusM: number
  message: string | null
  cooldownH: number
  quietStart: number
  quietEnd: number
  timezone: string
}

const RADII = [
  { label: '100 m', value: 100 },
  { label: '300 m', value: 300 },
  { label: '500 m', value: 500 },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  label: `${i.toString().padStart(2, '0')}:00`,
  value: i,
}))

const COOLDOWNS = [
  { label: '1 hora', value: 1 },
  { label: '6 horas', value: 6 },
  { label: '12 horas', value: 12 },
  { label: '24 horas', value: 24 },
  { label: '48 horas', value: 48 },
  { label: '72 horas', value: 72 },
]

const initial = { error: undefined, success: false }

export function GeofenceForm({ plan, enabled, radiusM, message, cooldownH, quietStart, quietEnd, timezone }: Props) {
  const [state, formAction] = useFormState(saveGeofenceAction, initial)
  const isPro = ['pro', 'premium'].includes(plan)

  if (!isPro) {
    return (
      <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-dashed border-border">
        <Lock size={16} className="text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Solo Plan Pro / Premium</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            El geofencing envía push automáticos cuando un cliente entra al radio del negocio.
          </p>
          <a href="/settings?tab=suscripcion" className="text-xs text-primary hover:underline mt-2 inline-block">
            Actualizar plan →
          </a>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Activar geofencing</p>
          <p className="text-xs text-muted-foreground">Enviar push al entrar al radio</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" name="geofence_enabled" defaultChecked={enabled} className="sr-only peer" />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {/* Radius */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
          <Radio size={11} /> Radio de detección
        </label>
        <div className="flex gap-2">
          {RADII.map(r => (
            <label key={r.value} className="flex-1 cursor-pointer">
              <input type="radio" name="geofence_radius_m" value={r.value} defaultChecked={radiusM === r.value} className="sr-only peer" />
              <span className="block text-center py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground peer-checked:border-primary peer-checked:text-primary peer-checked:bg-primary/10 transition-colors">
                {r.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Mensaje del push
        </label>
        <input
          name="geofence_message"
          defaultValue={message ?? ''}
          maxLength={200}
          placeholder="¡Estás cerca! Acumula sellos."
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">Máx. 200 caracteres. Dejar vacío usa el mensaje por defecto.</p>
      </div>

      {/* Cooldown */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Cooldown por cliente
        </label>
        <select
          name="geofence_cooldown_h"
          defaultValue={cooldownH}
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
        >
          {COOLDOWNS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">Tiempo mínimo entre notificaciones al mismo cliente.</p>
      </div>

      {/* Quiet hours */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          Horas silenciosas
        </label>
        <div className="flex gap-3 items-center">
          <select
            name="quiet_hours_start"
            defaultValue={quietStart}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
          >
            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
          <span className="text-muted-foreground text-sm">→</span>
          <select
            name="quiet_hours_end"
            defaultValue={quietEnd}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
          >
            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Sin notificaciones en este intervalo (puede cruzar medianoche).</p>
      </div>

      {/* Timezone */}
      <input type="hidden" name="timezone" value={timezone || 'America/Bogota'} />

      {/* Status + submit */}
      {state.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-xl">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-400 bg-green-400/10 px-4 py-2 rounded-xl">Geofencing guardado.</p>
      )}

      <SubmitButton />
    </form>
  )
}
