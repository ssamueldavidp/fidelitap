'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { resetPasswordAction } from './actions'
import { PasswordInput } from '@/components/ui/password-input'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-primary-foreground font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Guardando...' : 'Guardar nueva contraseña'}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState(resetPasswordAction, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'done' in state) {
      const t = setTimeout(() => router.push('/dashboard'), 2000)
      return () => clearTimeout(t)
    }
  }, [state, router])

  return (
    <div className="bg-card rounded-2xl p-8 border border-border">
      <h1 className="text-2xl font-black text-foreground mb-1">Nueva contraseña</h1>
      <p className="text-muted-foreground text-sm mb-7">Elige una contraseña nueva para tu cuenta.</p>

      {state && 'done' in state ? (
        <div role="status" className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl px-4 py-3 text-sm text-emerald-400">
          Contraseña actualizada. Entrando a tu panel...
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Nueva contraseña
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
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
    </div>
  )
}
