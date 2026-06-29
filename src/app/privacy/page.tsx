import Link from 'next/link'

export const metadata = {
  title: 'Política de tratamiento de datos — FideliTap',
  description: 'Política de tratamiento de datos personales de FideliTap, conforme a la Ley 1581 de 2012.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-16 px-6">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-xl font-black tracking-tight block mb-12">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <h1 className="text-3xl font-black mb-2">Política de tratamiento de datos personales</h1>
        <p className="text-slate-500 text-sm mb-10">
          Última actualización: [fecha]. Este documento es un borrador inicial y debe ser revisado
          por un asesor legal antes de considerarse definitivo o vinculante.
        </p>

        <div className="flex flex-col gap-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Responsable del tratamiento</h2>
            <p>
              [Razón social / nombre del negocio], identificado con NIT [NIT], es responsable del
              tratamiento de los datos personales recolectados a través de la plataforma FideliTap.
              Canal de contacto: [correo de contacto].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Datos que recolectamos</h2>
            <p>
              Al activar una tarjeta de fidelización recolectamos: nombre, correo electrónico y,
              opcionalmente, número de teléfono. También registramos el historial de sellos y
              canjes asociado a tu tarjeta para poder prestarte el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Finalidad del tratamiento</h2>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li>Activar y administrar tu tarjeta de fidelización digital.</li>
              <li>Registrar tus sellos y notificarte sobre tu progreso y premios.</li>
              <li>Enviarte el pase a Apple Wallet / Google Wallet y mantenerlo actualizado.</li>
              <li>
                Si lo autorizaste expresamente, enviarte comunicaciones y promociones del negocio
                por correo electrónico o notificaciones push.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Derechos del titular (ARCO)</h2>
            <p>
              Conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, tienes derecho a
              conocer, actualizar, rectificar y suprimir tus datos personales, así como a revocar
              el consentimiento otorgado. Para ejercer estos derechos, escríbenos a
              [correo de contacto] indicando tu nombre y el negocio donde activaste tu tarjeta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Seguridad de la información</h2>
            <p>
              Tus datos se almacenan en infraestructura con controles de acceso y cifrado en
              tránsito. No compartimos tus datos personales con terceros distintos al negocio con
              el que activaste tu tarjeta, salvo obligación legal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Vigencia</h2>
            <p>
              Esta política rige a partir de su publicación y permanecerá vigente mientras se
              preste el servicio. Conservaremos tus datos mientras tu tarjeta esté activa o
              mientras sea necesario para las finalidades aquí descritas.
            </p>
          </section>
        </div>

        <div className="border border-slate-800 rounded-xl p-6 text-center mt-12">
          <p className="text-xs text-slate-600">© 2026 FideliTap · fidelitap.co</p>
        </div>
      </div>
    </div>
  )
}
