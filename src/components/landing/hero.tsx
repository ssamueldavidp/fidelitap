import Link from 'next/link'

const FEATURES = [
  { icon: '🎨', title: 'Diseño propio', desc: 'Colores, fondos e íconos' },
  { icon: '📱', title: 'Apple & Google Wallet', desc: 'Sin apps adicionales' },
  { icon: '📷', title: 'Escaneo QR', desc: 'Sello instantáneo' },
  { icon: '🔐', title: 'Anti-fraude', desc: 'Código único por tarjeta' },
]

export function Hero() {
  return (
    <section className="bg-white pt-20 pb-0">
      {/* Badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#00C896] bg-[#00C896]/8 border border-[#00C896]/20 rounded-full px-4 py-1.5 tracking-wide uppercase">
          ✦ Fidelización digital
        </span>
      </div>

      {/* Headline */}
      <h1 className="text-center text-4xl sm:text-5xl md:text-[56px] font-black text-slate-900 leading-tight tracking-tight max-w-3xl mx-auto px-6">
        Haz que tus clientes<br className="hidden sm:block" /> siempre regresen
      </h1>

      {/* Subtítulo */}
      <p className="text-center text-slate-500 text-base sm:text-lg mt-5 max-w-xl mx-auto px-6 leading-relaxed">
        Crea tarjetas de sellos digitales en minutos. Tus clientes las guardan en Apple Wallet o Google Wallet y vuelven por su premio.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 px-6">
        <Link
          href="/register"
          className="w-full sm:w-auto text-center font-bold bg-slate-900 text-white rounded-xl px-7 py-3.5 text-[15px] hover:bg-slate-700 transition-colors"
        >
          Crear mi tarjeta gratis →
        </Link>
        <Link
          href="#como-funciona"
          className="w-full sm:w-auto text-center font-semibold text-slate-600 border-2 border-slate-200 bg-white rounded-xl px-7 py-3.5 text-[15px] hover:border-slate-300 transition-colors"
        >
          Ver cómo funciona
        </Link>
      </div>

      {/* Features strip */}
      <div className="mt-16 max-w-3xl mx-auto mx-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`py-5 px-3 text-center ${
                i < FEATURES.length - 1 ? 'border-r border-slate-100 last:border-r-0' : ''
              } ${i >= 2 ? 'border-t border-slate-100 sm:border-t-0' : ''}`}
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-xs font-bold text-slate-800 mb-0.5">{f.title}</div>
              <div className="text-[11px] text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
