import Link from 'next/link'

export const metadata = {
  title: 'Términos y condiciones — FideliTap',
  description: 'Términos y condiciones de uso de la plataforma FideliTap.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-16 px-6">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-xl font-black tracking-tight block mb-12">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <h1 className="text-3xl font-black mb-2">Términos y condiciones</h1>
        <p className="text-slate-500 text-sm mb-10">
          Última actualización: [fecha]. Este documento es un borrador inicial y debe ser revisado
          por un asesor legal antes de considerarse definitivo o vinculante.
        </p>

        <div className="flex flex-col gap-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Objeto</h2>
            <p>
              FideliTap es una plataforma que permite a negocios crear tarjetas de fidelización
              digitales y a sus clientes activarlas, acumular sellos y reclamar premios. Estos
              términos aplican tanto a negocios registrados como a clientes que activan una
              tarjeta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Cuentas de negocio y planes</h2>
            <p>
              Los negocios se registran eligiendo un plan (Gratis, Básico, Pro o Premium), cada uno
              con límites de tarjetas y clientes activos. Los planes pagos se facturan
              mensualmente a través de la pasarela de pagos integrada y se renuevan automáticamente
              salvo cancelación.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Uso por parte de clientes</h2>
            <p>
              Un cliente puede activar una tarjeta de fidelización por negocio, asociada a su
              correo electrónico. Los sellos y premios son otorgados a discreción del negocio
              correspondiente; FideliTap actúa únicamente como la plataforma tecnológica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Uso aceptable</h2>
            <p>
              No está permitido usar la plataforma para fines fraudulentos, incluyendo la creación
              de tarjetas o cuentas falsas para obtener premios indebidamente. FideliTap puede
              suspender cuentas que incumplan esta condición.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Disponibilidad del servicio</h2>
            <p>
              Hacemos esfuerzos razonables para mantener la plataforma disponible, pero no
              garantizamos un funcionamiento ininterrumpido. No nos hacemos responsables por
              pérdidas derivadas de interrupciones del servicio fuera de nuestro control razonable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Tratamiento de datos</h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{' '}
              <Link href="/privacy" className="text-[#00C896] underline underline-offset-2">
                política de tratamiento de datos
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Contacto</h2>
            <p>Para preguntas sobre estos términos, escríbenos a [correo de contacto].</p>
          </section>
        </div>

        <div className="border border-slate-800 rounded-xl p-6 text-center mt-12">
          <p className="text-xs text-slate-600">© 2026 FideliTap · fidelitap.co</p>
        </div>
      </div>
    </div>
  )
}
