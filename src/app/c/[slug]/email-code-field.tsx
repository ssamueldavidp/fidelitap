'use client'

import { useState, useTransition } from 'react'
import { sendEmailCodeAction } from './actions'
import { Turnstile, turnstileActive } from '@/components/ui/turnstile'

const INPUT =
  'w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors'

// Email input + "Enviar código" + code input. Submits `email` and `code` with
// the surrounding form; the server actions verify the code before doing anything.
export function EmailCodeField({ placeholder, hint }: { placeholder: string; hint?: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [token, setToken] = useState('')
  const [resetKey, setResetKey] = useState(0)

  function send() {
    setError(null)
    startTransition(async () => {
      const res = await sendEmailCodeAction(email, token)
      setResetKey(k => k + 1) // el token es de un solo uso
      if (res.error) setError(res.error)
      else setSent(true)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); setSent(false) }}
        placeholder={placeholder}
        className={INPUT}
      />
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
      <Turnstile onToken={setToken} resetKey={resetKey} />

      {!sent ? (
        <button
          type="button"
          onClick={send}
          disabled={pending || !email || (turnstileActive && !token)}
          className="text-xs font-semibold text-primary border border-primary/40 rounded-lg py-2 hover:bg-primary/10 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Enviando...' : 'Enviar código de verificación'}
        </button>
      ) : (
        <>
          <input
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="Código de 6 dígitos"
            className={INPUT}
          />
          <p className="text-[10px] text-muted-foreground/60">
            Te enviamos un código a {email}.{' '}
            <button type="button" onClick={send} disabled={pending || (turnstileActive && !token)} className="text-primary underline">
              Reenviar
            </button>
          </p>
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
