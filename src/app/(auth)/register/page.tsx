'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { registerAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-primary-foreground font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
    </button>
  )
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, null)

  return (
    <div className="bg-card rounded-2xl p-8 border border-border">
      <h1 className="text-2xl font-black text-foreground mb-1">Crea tu cuenta</h1>
      <p className="text-muted-foreground text-sm mb-7">Empieza gratis, sin tarjeta de crédito</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="businessName" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Nombre de tu negocio
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            autoComplete="organization"
            required
            placeholder="Café Luna, Studio Hair..."
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

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

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {state?.error && (
          <div role="alert" className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <SubmitButton />

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terms" className="text-muted-foreground hover:underline">Términos de servicio</Link>
          {' '}y{' '}
          <Link href="/privacy" className="text-muted-foreground hover:underline">Política de privacidad</Link>.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#00C896] font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
