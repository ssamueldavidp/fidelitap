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
              con límites de tarjetas y clientes activos. Los planes pagos son suscripciones
              mensuales que se cobran a través de la pasarela de pagos integrada (Mercado Pago) y
              se renuevan automáticamente, según se explica en la sección 3.
            </p>
          </section>

          <section id="suscripciones">
            <h2 className="text-lg font-bold text-white mb-2">3. Suscripción, renovación automática y cancelación</h2>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong>Renovación automática.</strong> Al suscribirte a un plan pago autorizas el cobro
                recurrente del valor del plan cada mes, en la misma fecha del primer cobro (la &quot;fecha
                de corte&quot;), hasta que canceles.
              </li>
              <li>
                <strong>Cómo cancelar.</strong> Puedes cancelar en cualquier momento desde Ajustes →
                Suscripción en la versión web. Si no cancelas antes de la fecha de corte, la suscripción
                se renueva y se cobra el mes siguiente.
              </li>
              <li>
                <strong>Efecto de la cancelación.</strong> Al cancelar dejamos de cobrarte. Mantienes tu
                plan hasta el final del período ya pagado; después tu cuenta pasa al plan Gratis y se
                aplican sus límites.
              </li>
              <li>
                <strong>Cobros fallidos.</strong> Si un cobro no se puede realizar, Mercado Pago intentará
                cobrarlo de nuevo. Si no se logra, la suscripción se cancela y, tras un breve período de
                gracia, tu cuenta pasa al plan Gratis.
              </li>
              <li>
                <strong>Cambio de plan.</strong> Cambiar de plan inicia una nueva suscripción con su propia
                fecha de corte; la suscripción anterior se cancela cuando se activa la nueva.
              </li>
              <li>
                <strong>Reembolsos.</strong> Los cobros de períodos ya iniciados no se reembolsan, sin
                perjuicio de los derechos que la ley reconozca a los consumidores.
              </li>
              <li>
                <strong>Cambios de precio.</strong> Si modificamos el precio de un plan, te lo
                notificaremos antes de que se aplique a tu siguiente cobro.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Uso por parte de clientes</h2>
            <p>
              Un cliente puede activar una tarjeta de fidelización por negocio, asociada a su
              correo electrónico. Los sellos y premios son otorgados a discreción del negocio
              correspondiente; FideliTap actúa únicamente como la plataforma tecnológica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Uso aceptable</h2>
            <p>
              No está permitido usar la plataforma para fines fraudulentos, incluyendo la creación
              de tarjetas o cuentas falsas para obtener premios indebidamente. FideliTap puede
              suspender cuentas que incumplan esta condición.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Disponibilidad del servicio</h2>
            <p>
              Hacemos esfuerzos razonables para mantener la plataforma disponible, pero no
              garantizamos un funcionamiento ininterrumpido. No nos hacemos responsables por
              pérdidas derivadas de interrupciones del servicio fuera de nuestro control razonable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Tratamiento de datos</h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{' '}
              <Link href="/privacy" className="text-[#00C896] underline underline-offset-2">
                política de tratamiento de datos
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Contacto</h2>
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
