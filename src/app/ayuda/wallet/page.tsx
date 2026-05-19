import Link from 'next/link'

export const metadata = {
  title: 'Cómo agregar tu tarjeta al Wallet — FideliTap',
  description: 'Tutorial paso a paso para agregar tu tarjeta de sellos a Apple Wallet y Google Wallet.',
}

export default function WalletTutorialPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-16 px-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <Link href="/" className="text-xl font-black tracking-tight block mb-12">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <h1 className="text-3xl font-black mb-2">
          ¿Cómo agregar tu tarjeta al Wallet?
        </h1>
        <p className="text-slate-500 text-sm mb-12">
          Guarda tu tarjeta de sellos en tu teléfono para tenerla siempre a mano.
        </p>

        {/* Apple Wallet */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🍎</span> Apple Wallet (iPhone)
          </h2>
          <ol className="flex flex-col gap-4">
            {[
              'Abre el email de bienvenida de FideliTap en tu iPhone.',
              'Toca el botón verde "Agregar a Apple Wallet".',
              'En la hoja que aparece, toca "Agregar" para confirmar.',
              'Tu tarjeta de sellos aparece en la app Wallet. Ábrela para mostrarla en el negocio.',
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-7 h-7 rounded-full bg-slate-800 text-[#00C896] flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Google Wallet */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🤖</span> Google Wallet (Android)
          </h2>
          <ol className="flex flex-col gap-4">
            {[
              'Abre el email de bienvenida de FideliTap en tu Android.',
              'Toca el botón "Agregar a Google Wallet".',
              'Si te lo pide, inicia sesión con tu cuenta de Google.',
              'Toca "Guardar en Google Wallet" para confirmar.',
              'Tu tarjeta queda guardada. Ábrela desde la app Google Wallet para mostrarla.',
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-7 h-7 rounded-full bg-slate-800 text-[#00C896] flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <div className="border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-sm mb-4">
            ¿Todavía no tienes tu tarjeta? Pídele al negocio el cartel con el QR o visita su página de FideliTap.
          </p>
          <p className="text-xs text-slate-600">© 2026 FideliTap · fidelitap.co</p>
        </div>
      </div>
    </div>
  )
}
