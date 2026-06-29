'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { onboardingAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Guardando...' : 'Continuar al dashboard →'}
    </button>
  )
}

export default function OnboardingPage() {
  const [state, formAction] = useFormState(onboardingAction, null)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-2xl font-black mb-2">
            fideli<span className="text-[#00C896]">tap</span>
          </div>
          <h1 className="text-xl font-black text-foreground mb-2">¿Cómo se llama tu negocio?</h1>
          <p className="text-muted-foreground text-sm">Este nombre aparecerá en tus tarjetas de fidelización.</p>
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border">
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label htmlFor="businessName" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Nombre del negocio
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                autoFocus
                required
                placeholder="Café Luna, Studio Hair..."
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896] transition-colors"
              />
            </div>

            {state?.error && (
              <div role="alert" className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  )
}
