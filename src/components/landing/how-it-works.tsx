'use client'
import { useState } from 'react'
import { WalletCardMockup } from '@/components/wallet-card-mockup'

const STEPS = [
  {
    mode: 'wallet' as const,
    num: 'Paso 1 — Para el negocio',
    icon: '🎨',
    title: 'Crea y personaliza tu tarjeta de sellos',
    desc: 'Diseña tu tarjeta en minutos: elige colores, el ícono de cada sello, cuántas visitas necesita el cliente y qué beneficio recibe al completarla. Preview en tiempo real mientras editas.',
    chips: ['🎨 Editor visual', '⚡ Lista en 5 min', '👁 Preview live'],
  },
  {
    mode: 'scan' as const,
    num: 'Paso 2 — Para el cliente',
    icon: '📱',
    title: 'Activa su tarjeta y la guarda en Wallet',
    desc: 'El cliente escanea el cartel del negocio, se registra en segundos con su email y con un solo tap agrega la tarjeta a Apple Wallet o Google Wallet. Sin descargar ninguna app.',
    chips: ['🍎 Apple Wallet', '🤖 Google Wallet', '⚡ Sin apps extra'],
  },
  {
    mode: 'success' as const,
    num: 'Paso 3 — Cada visita',
    icon: '🎁',
    title: 'El cliente gana un sello y acumula su premio',
    desc: 'El cliente muestra el QR de su tarjeta. El negocio lo escanea desde su panel y el sello aparece al instante en la Wallet. Al completar la tarjeta, recibe automáticamente su beneficio.',
    chips: ['📷 Escaneo QR', '⚡ Actualización live', '🎁 Premio automático'],
  },
]

export function HowItWorks() {
  const [active, setActive] = useState(0)

  return (
    <section id="como-funciona" className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-[11px] font-bold text-[#00C896] tracking-[2px] uppercase mb-2">
          Así funciona
        </p>
        <h2 className="text-center text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          ¿Cómo funciona nuestra plataforma?
        </h2>
        <p className="text-center text-slate-500 text-sm mb-14">
          Simple para el negocio, mágico para el cliente
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Steps */}
          <div className="flex flex-col gap-2">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`text-left flex items-start gap-4 p-4 rounded-2xl border-[1.5px] transition-all duration-200 ${
                  active === i
                    ? 'bg-white border-[#00C896]/40 shadow-md'
                    : 'bg-white/60 border-transparent hover:bg-white/80'
                }`}
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${
                  active === i ? 'bg-[#00C896]/10' : 'bg-slate-100'
                }`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${active === i ? 'text-[#00C896]' : 'text-slate-400'}`}>
                    {step.num}
                  </div>
                  <div className={`text-[15px] font-bold leading-snug mb-2 ${active === i ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.title}
                  </div>
                  {active === i && (
                    <>
                      <p className="text-[12.5px] text-slate-500 leading-relaxed mb-2">{step.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {step.chips.map(chip => (
                          <span key={chip} className="text-[11px] bg-slate-100 text-slate-600 font-semibold rounded-full px-2.5 py-0.5">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* iPhone mockup */}
          <div className="flex justify-center md:justify-end">
            <WalletCardMockup mode={STEPS[active].mode} />
          </div>
        </div>
      </div>
    </section>
  )
}
