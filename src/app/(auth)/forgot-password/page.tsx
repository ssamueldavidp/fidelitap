'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-primary-foreground font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Enviando...' : 'Enviar enlace de recuperación'}
    </button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPasswordAction, null)

  return (
    <div className="bg-card rounded-2xl p-8 border border-border">
      <h1 className="text-2xl font-black text-foreground mb-1">Recuperar contraseña</h1>
      <p className="text-muted-foreground text-sm mb-7">
        Te enviamos un enlace para restablecerla.
      </p>

      {state && 'sent' in state ? (
        <div role="status" className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl px-4 py-3 text-sm text-emerald-400">
          Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@negocio.com"
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
            />
          </div>

          {state && 'error' in state && (
            <div role="alert" className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <SubmitButton />
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="text-[#00C896] font-semibold hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  )
}
