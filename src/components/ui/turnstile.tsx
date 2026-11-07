'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
    __turnstileLoading?: Promise<void>
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!window.__turnstileLoading) {
    window.__turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('turnstile'))
      document.head.appendChild(s)
    })
  }
  return window.__turnstileLoading
}

/**
 * Desafío anti-bots de Cloudflare. Si no hay NEXT_PUBLIC_TURNSTILE_SITE_KEY no pinta nada.
 * `onToken` recibe el token (de un solo uso); cambia `resetKey` para pedir uno nuevo tras usarlo.
 */
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'auto',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      cb.current('')
      window.turnstile.reset(widgetId.current)
    }
  }, [resetKey])

  if (!SITE_KEY) return null
  return <div ref={ref} className="min-h-[65px]" />
}

export const turnstileActive = !!SITE_KEY
