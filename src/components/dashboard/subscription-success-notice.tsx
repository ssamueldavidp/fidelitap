'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

export function SubscriptionSuccessNotice() {
  const params       = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('subscription') === 'success') {
      setShow(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [params])

  if (!show) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-green-950 border border-green-700 text-green-300 rounded-2xl px-4 py-3 shadow-xl text-sm font-medium">
      <CheckCircle2 size={16} />
      ¡Suscripción activada! Tu plan se actualizará en unos segundos.
      <button type="button" onClick={() => setShow(false)} className="text-green-400 hover:text-green-200">
        <X size={14} />
      </button>
    </div>
  )
}
