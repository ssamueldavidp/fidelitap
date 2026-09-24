'use client'

import { useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

// Browser geolocation -> reload /tiendas sorted by distance from here.
export function LocationButton({ category }: { category?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function locate() {
    if (!navigator.geolocation) { setError('Tu navegador no permite ubicación'); return }
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const q = new URLSearchParams({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })
        if (category) q.set('category', category)
        window.location.href = `/tiendas?${q.toString()}`
      },
      () => { setBusy(false); setError('No pudimos obtener tu ubicación. Busca por ciudad.') }
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm font-semibold border border-border rounded-xl px-4 py-2.5 hover:bg-muted disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
        Usar mi ubicación
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
