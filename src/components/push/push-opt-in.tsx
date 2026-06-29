'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

interface PushOptInProps {
  customerCardId: string
  walletAuthToken: string
}

type Status = 'idle' | 'loading' | 'enabled' | 'denied' | 'unsupported' | 'error'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function PushOptIn({ customerCardId, walletAuthToken }: PushOptInProps) {
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('push_prompt_dismissed') === 'true') {
      setStatus('denied')
    }
  }, [])

  async function handleEnable() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        localStorage.setItem('push_prompt_dismissed', 'true')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCardId,
          walletAuthToken,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
              auth: arrayBufferToBase64Url(subscription.getKey('auth')),
            },
          },
        }),
      })

      if (!res.ok) throw new Error('subscribe failed')
      setStatus('enabled')
    } catch (err) {
      console.error('[push] opt-in failed', err)
      setStatus('error')
    }
  }

  function handleDismiss() {
    localStorage.setItem('push_prompt_dismissed', 'true')
    setStatus('denied')
  }

  if (status === 'enabled') {
    return (
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-[#00C896]">
        <Bell size={14} />
        Notificaciones activadas
      </div>
    )
  }

  if (status === 'denied' || status === 'unsupported') {
    return null
  }

  return (
    <div className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Bell size={14} className="text-[#00C896]" />
        Recibe un aviso cuando estés cerca de tu premio
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Te avisamos solo cuando te falte poco para completar tus sellos, o si el negocio tiene una promo. Nada más.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleEnable}
          disabled={status === 'loading'}
          className="flex-1 bg-[#00C896] text-slate-900 font-semibold text-xs rounded-lg py-2 hover:bg-[#00b386] disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Activando...' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center gap-1 px-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <BellOff size={12} />
          No, gracias
        </button>
      </div>
    </div>
  )
}
