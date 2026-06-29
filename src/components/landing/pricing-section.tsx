'use client'

import { useState } from 'react'
import Link from 'next/link'

type Billing = 'monthly' | 'annual'

const ANNUAL_FACTOR = 10 / 12 // 2 months free

function formatCOP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

interface PlanFeature {
  text: string
  included: boolean
}

interface PaidPlan {
  key: string
  name: string
  monthlyPrice: number
  perDayCopy: string
  features: PlanFeature[]
  cta: string
  ctaStyle: 'outline' | 'filled'
  highlight: boolean
  roiHint?: string
}

const PAID_PLANS: PaidPlan[] = [
  {
    key: 'basic',
    name: 'Básico',
    monthlyPrice: 49900,
    perDayCopy: 'menos que un café',
    cta: 'Elegir Básico',
    ctaStyle: 'outline',
    highlight: false,
    features: [
      { text: 'Hasta 3 tarjetas de fidelización', included: true },
      { text: 'Hasta 500 clientes activos', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Soporte por email', included: true },
      { text: 'Estadísticas de retención', included: false },
      { text: 'Soporte prioritario', included: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 99900,
    perDayCopy: 'el costo de perder un cliente',
    cta: 'Quiero el Pro →',
    ctaStyle: 'filled',
    highlight: true,
    roiHint: 'Si recuperas solo 2 clientes recurrentes al mes, el plan se paga solo.',
    features: [
      { text: '10 tarjetas de fidelización', included: true },
      { text: 'Hasta 2.000 clientes activos', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Estadísticas de retención', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'Diseño personalizado avanzado', included: true },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    monthlyPrice: 179900,
    perDayCopy: 'para negocios en serio',
    cta: 'Elegir Premium',
    ctaStyle: 'outline',
    highlight: false,
    features: [
      { text: 'Tarjetas ilimitadas', included: true },
      { text: 'Clientes ilimitados', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Estadísticas avanzadas + exportar', included: true },
      { text: 'Soporte dedicado (WhatsApp)', included: true },
      { text: 'Acceso anticipado a novedades', included: true },
    ],
  },
]

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const isAnnual = billing === 'annual'

  function price(monthlyPrice: number) {
    return formatCOP(isAnnual ? monthlyPrice * ANNUAL_FACTOR : monthlyPrice)
  }

  function perDay(monthlyPrice: number) {
    const daily = (isAnnual ? monthlyPrice * ANNUAL_FACTOR : monthlyPrice) / 30
    return formatCOP(daily)
  }

  function saving(monthlyPrice: number) {
    return formatCOP(monthlyPrice * 2)
  }

  return (
    <section id="precios" className="bg-slate-50 py-20 px-6 border-t border-slate-100">
      <div className="max-w-5xl mx-auto">

        {/* Launch banner */}
        <div className="bg-slate-900 rounded-2xl px-5 py-3.5 flex items-center gap-3 mb-8">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C896] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00C896]" />
          </span>
          <p className="text-sm text-slate-400 flex-1">
            <span className="text-white font-semibold">Precio de lanzamiento</span>
            {' '}— Primeros 100 negocios en Colombia
          </p>
          <span className="text-[10px] font-bold text-[#00C896] border border-[#00C896]/30 bg-[#00C896]/10 rounded-full px-3 py-1 whitespace-nowrap">
            🇨🇴 Oferta fundadores
          </span>
        </div>

        {/* Section header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Planes y precios
          </h2>
          <p className="text-slate-500 text-[15px]">Sin contrato. Cancela cuando quieras.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBilling('monthly')}
            className={`text-sm font-semibold transition-colors ${billing === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-11 h-6 bg-[#00C896] rounded-full"
            aria-label="Cambiar facturación"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isAnnual ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`text-sm font-semibold transition-colors ${billing === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            Anual
          </button>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-0.5">
            2 meses gratis
          </span>
        </div>

        {/* Free plan banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-6 mb-4">
          <div className="flex-1">
            <p className="font-black text-slate-900 text-base mb-0.5">Plan Gratis — para siempre</p>
            <p className="text-slate-500 text-sm mb-3">Empieza sin riesgo. Sin tarjeta de crédito.</p>
            <div className="flex flex-wrap gap-4">
              {['1 tarjeta de sellos', 'Hasta 20 clientes', 'Apple & Google Wallet', 'Escaneo QR', 'Panel de gestión'].map(f => (
                <span key={f} className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-[#00C896] font-bold">✓</span> {f}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-slate-900">$0</p>
            <p className="text-xs text-slate-400 mb-2">sin límite de tiempo</p>
            <Link
              href="/register"
              className="text-sm font-bold text-[#00C896] hover:text-[#00b386] transition-colors"
            >
              Empezar gratis →
            </Link>
          </div>
        </div>

        {/* Paid plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PAID_PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl p-5 flex flex-col border ${
                plan.highlight
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00C896] text-slate-900 text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap tracking-wide">
                  ★ MÁS POPULAR
                </div>
              )}

              {/* Price block */}
              <p className={`text-sm font-black mb-1.5 ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                {plan.name}
              </p>
              <div className="flex items-end gap-2 mb-0.5">
                <span className={`text-3xl font-black leading-none ${plan.highlight ? 'text-[#00C896]' : 'text-slate-900'}`}>
                  {price(plan.monthlyPrice)}
                </span>
                {isAnnual && (
                  <span className="text-sm text-slate-400 line-through mb-0.5">
                    {formatCOP(plan.monthlyPrice)}
                  </span>
                )}
              </div>
              <p className="text-[11px] mb-1 text-slate-400">
                /mes · facturación {isAnnual ? 'anual' : 'mensual'}
              </p>
              <p className="text-[11px] font-semibold text-[#00C896] mb-1">
                ≈ {perDay(plan.monthlyPrice)}/día — {plan.perDayCopy}
              </p>
              {isAnnual && (
                <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-100 rounded-md px-2 py-0.5 w-fit mb-3">
                  Ahorras {saving(plan.monthlyPrice)}/año
                </span>
              )}

              <div className={`border-t my-4 ${plan.highlight ? 'border-white/10' : 'border-slate-100'}`} />

              {/* ROI hint (Pro only) */}
              {plan.roiHint && (
                <div className="bg-[#00C896]/10 border border-[#00C896]/20 rounded-xl p-3 text-[11px] text-emerald-700 leading-relaxed mb-4">
                  💡 {plan.roiHint}
                </div>
              )}

              {/* Features */}
              <ul className="flex flex-col gap-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-start gap-2 text-xs leading-snug ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className={`text-sm font-bold shrink-0 ${f.included ? 'text-[#00C896]' : 'text-slate-300'}`}>
                      {f.included ? '✓' : '✕'}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={`/register?plan=${plan.key}`}
                className={`block text-center text-sm font-bold py-2.5 rounded-xl transition-colors mt-auto ${
                  plan.ctaStyle === 'filled'
                    ? 'bg-[#00C896] text-slate-900 hover:bg-[#00b386]'
                    : plan.highlight
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          ✓ Sin contrato · Cancela cuando quieras · Todos los planes incluyen actualizaciones de Wallet automáticas
        </p>
      </div>
    </section>
  )
}
