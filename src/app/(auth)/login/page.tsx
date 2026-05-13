'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null)

  return (
    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
      <h1 className="text-2xl font-black text-white mb-1">Bienvenido de vuelta</h1>
      <p className="text-slate-500 text-sm mb-7">Ingresa a tu panel de negocio</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@negocio.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Contraseña
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {state?.error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-[#00C896] font-semibold hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
