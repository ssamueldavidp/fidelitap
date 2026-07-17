'use client'

import { useActionState, useState } from 'react'
import { saveAccountAction } from './actions'
import { MapPin, Building2, Check, AlertCircle, Loader2 } from 'lucide-react'

interface AccountFormProps {
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
}

const initial = { error: undefined, success: false }

export function AccountForm({ name, address, latitude, longitude }: AccountFormProps) {
  const [state, formAction, isPending] = useActionState(saveAccountAction, initial)
  const [lat, setLat] = useState(latitude?.toString() ?? '')
  const [lng, setLng] = useState(longitude?.toString() ?? '')
  const [detecting, setDetecting] = useState(false)

  function detectLocation() {
    if (!navigator.geolocation) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
        setDetecting(false)
      },
      () => setDetecting(false)
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5 max-w-md">
      {/* Nombre */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          <Building2 size={12} />
          Nombre del negocio
        </label>
        <input
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={100}
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Dirección */}
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">
          Dirección del local <span className="font-normal normal-case">(opcional)</span>
        </label>
        <input
          name="address"
          defaultValue={address ?? ''}
          maxLength={200}
          placeholder="Calle 123 # 45-67, Bogotá"
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Ubicación GPS (geofencing) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <MapPin size={12} />
            Coordenadas GPS <span className="font-normal normal-case">(para notificaciones de proximidad)</span>
          </label>
          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {detecting ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
            {detecting ? 'Detectando...' : 'Usar mi ubicación'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Latitud</p>
            <input
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="4.710989"
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Longitud</p>
            <input
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-74.072092"
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          La app móvil usará estas coordenadas para avisar a tus clientes cuando estén a 300m del local (plan Pro+).
        </p>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-xl p-3">
          <AlertCircle size={14} />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 rounded-xl p-3">
          <Check size={14} />
          Cambios guardados correctamente
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 bg-primary text-black font-bold rounded-xl py-2.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
        {isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
