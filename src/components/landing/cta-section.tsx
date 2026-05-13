import Link from 'next/link'

export function CtaSection() {
  return (
    <>
      {/* CTA */}
      <section className="bg-white py-20 px-6 border-t border-slate-100 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          ¿Listo para fidelizar a tus clientes?
        </h2>
        <p className="text-slate-500 text-[15px] mb-8">
          Empieza gratis hoy. Sin tarjeta de crédito.
        </p>
        <Link
          href="/register"
          className="inline-block font-bold bg-slate-900 text-white rounded-xl px-9 py-4 text-[15px] hover:bg-slate-700 transition-colors"
        >
          Crear mi tarjeta gratis →
        </Link>
        <div className="mt-6 flex gap-6 justify-center flex-wrap text-xs text-slate-400">
          <span>✓ Sin contrato</span>
          <span>✓ Cancela cuando quieras</span>
          <span>✓ Soporte en español</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-black tracking-tight text-slate-900">
            fideli<span className="text-[#00C896]">tap</span>
          </span>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="#como-funciona" className="hover:text-slate-600 transition-colors">Cómo funciona</Link>
            <Link href="/login" className="hover:text-slate-600 transition-colors">Iniciar sesión</Link>
            <Link href="/register" className="hover:text-slate-600 transition-colors">Registro</Link>
          </div>
          <p className="text-xs text-slate-400">© 2026 FideliTap. Hecho en Colombia 🇨🇴</p>
        </div>
      </footer>
    </>
  )
}
