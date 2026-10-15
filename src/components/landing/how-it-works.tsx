'use client'

import { useEffect, useState } from 'react'
import { PhoneFrame } from './phone-frame'
import { WalletPass, qrCells } from './wallet-pass'
import { Reveal } from './reveal'

const PALETTE = ['#087A47', '#1F4FD8', '#C2410C', '#12161C']

const STEPS = [
  {
    num: 'Paso 1 — Para el negocio',
    title: 'Crea y personaliza tu tarjeta de sellos',
    desc: 'Diseña tu tarjeta en minutos: elige colores, el ícono de cada sello, cuántas visitas necesita el cliente y qué beneficio recibe al completarla. Vista previa en tiempo real mientras editas.',
    chips: ['Editor visual', 'Lista en 5 min', 'Vista previa en vivo'],
  },
  {
    num: 'Paso 2 — Para el cliente',
    title: 'Activa su tarjeta y la guarda en Wallet',
    desc: 'El cliente escanea el cartel del negocio, se registra en segundos con su email y con un solo toque agrega la tarjeta a Apple Wallet o Google Wallet. Sin descargar ninguna app.',
    chips: ['Apple Wallet', 'Google Wallet', 'Sin apps extra'],
  },
  {
    num: 'Paso 3 — Cada visita',
    title: 'El cliente gana un sello y acumula su premio',
    desc: 'El cliente muestra el QR de su tarjeta. El negocio lo escanea desde su panel y el sello aparece al instante en la Wallet. Al completar la tarjeta, recibe automáticamente su beneficio.',
    chips: ['Escaneo QR', 'Actualización en vivo', 'Premio automático'],
  },
]

const CONFETTI = [
  { c: '#5BE0A3', dx: 26, dy: -34, d: 0.55 },
  { c: '#F5B83D', dx: 38, dy: 4, d: 0.6 },
  { c: '#FFFFFF', dx: -2, dy: -42, d: 0.65 },
  { c: '#1F4FD8', dx: 30, dy: 28, d: 0.7 },
  { c: '#5BE0A3', dx: -30, dy: -26, d: 0.75 },
]

const CORNERS = [
  { left: 40, top: 40, borderLeftWidth: 3, borderTopWidth: 3, borderRadius: '8px 0 0 0' },
  { right: 40, top: 40, borderRightWidth: 3, borderTopWidth: 3, borderRadius: '0 8px 0 0' },
  { left: 40, bottom: 40, borderLeftWidth: 3, borderBottomWidth: 3, borderRadius: '0 0 0 8px' },
  { right: 40, bottom: 40, borderRightWidth: 3, borderBottomWidth: 3, borderRadius: '0 0 8px 0' },
]

export function HowItWorks() {
  const [step, setStep] = useState(0)
  const [color, setColor] = useState(0)
  const [auto, setAuto] = useState(true)

  // Cambia el color de la tarjeta y avanza los pasos solo hasta que el usuario elige uno.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let age = 0
    const id = window.setInterval(() => {
      if (document.hidden) return
      age += 1
      setColor((c) => (c + 1) % PALETTE.length)
      if (auto && age >= 4) {
        age = 0
        setStep((s) => (s + 1) % STEPS.length)
      }
    }, 1800)
    return () => window.clearInterval(id)
  }, [auto])

  const pick = (i: number) => {
    setAuto(false)
    setStep(i)
  }

  return (
    <section id="como-funciona" className="lp-sec">
      <div className="lp-wrap">
        <Reveal className="lp-center">
          <div className="lp-kicker">Así funciona</div>
          <h2 className="lp-h2">¿Cómo funciona nuestra plataforma?</h2>
          <p className="lp-lead">Simple para el negocio, mágico para el cliente</p>
        </Reveal>

        <div className="lp-how">
          <div className="lp-steps">
            {STEPS.map((s, i) => {
              const on = i === step
              return (
                <button key={s.num} type="button" className="lp-step" aria-current={on} onClick={() => pick(i)}>
                  <div className="lp-step-row">
                    <div className="lp-step-n">{i + 1}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="lp-step-k">{s.num}</div>
                      <div className="lp-step-t">{s.title}</div>
                      {on && (
                        <>
                          <p className="lp-step-d">{s.desc}</p>
                          <div className="lp-chips">{s.chips.map((c) => <span key={c}>{c}</span>)}</div>
                          {auto && <div className="lp-timer"><i /></div>}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="lp-phonecell" aria-hidden="true">
            <div className="lp-pscale">
              <PhoneFrame>
                {step === 0 && (
                  <div className="lp-hw-pad">
                    <div className="lp-hw-top">
                      <span style={{ color: '#596273' }}>Cancelar</span>
                      <b>Nueva tarjeta</b>
                      <b style={{ color: '#087A47' }}>Listo</b>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <WalletPass color={PALETTE[color]} filled={3} mode="still" typing brand="Mi cafetería" />
                    </div>
                    <div className="lp-hw-label">Color</div>
                    <div className="lp-swatches">
                      {PALETTE.map((c, i) => (
                        <div key={c} className="lp-swatch" style={{ background: c, boxShadow: i === color ? `0 0 0 3px #F2F3F7, 0 0 0 5px ${c}` : '0 0 0 0 transparent' }} />
                      ))}
                    </div>
                    <div className="lp-row-card"><b>Sellos para el premio</b><span style={{ padding: '4px 12px', borderRadius: 999, background: '#EAF7F0', color: '#07643A', fontWeight: 700 }}>8</span></div>
                  </div>
                )}

                {step === 1 && (
                  <>
                    <div className="lp-hw-pad">
                      <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Activa tu tarjeta</div>
                      <div className="lp-scan">
                        <div className="lp-scan-qr">
                          <div>{qrCells(11).map((on, i) => <i key={i} style={{ display: 'block', background: on ? '#12161C' : 'transparent' }} />)}</div>
                        </div>
                        {CORNERS.map((c, i) => <div key={i} className="lp-corner" style={c} />)}
                        <div className="lp-scan-line" />
                      </div>
                      <div style={{ marginTop: 12, textAlign: 'center', fontSize: 14, color: '#596273' }}>Apunta al QR del cartel</div>
                    </div>
                    <div className="lp-sheet">
                      <div style={{ width: 40, height: 4, margin: '0 auto 12px', borderRadius: 4, background: '#D5DAE2' }} />
                      <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 18, fontWeight: 700 }}>Tarjeta lista</div>
                      <div style={{ marginTop: 2, fontSize: 13, color: '#596273' }}>Café Luna, 8 sellos = 1 café gratis</div>
                      <div className="lp-sheet-btn dark">Agregar a Apple Wallet</div>
                      <div className="lp-sheet-btn">Agregar a Google Wallet</div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <div className="lp-wallet-pad">
                    <div style={{ position: 'relative', animation: 'lp-fade-up 0.5s ease both' }}>
                      <WalletPass color="#087A47" filled={7} mode="last" />
                      {CONFETTI.map((c, i) => (
                        <div key={i} className="lp-confetti" style={{ background: c.c, ['--dx' as string]: `${c.dx}px`, ['--dy' as string]: `${c.dy}px`, animation: `lp-confetti 1s ease-out ${c.d}s both` }} />
                      ))}
                    </div>
                    <div className="lp-ok">
                      <div className="lp-ok-dot">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m5 12.5 4.5 4.5L19 7.5" strokeDasharray="30" style={{ animation: 'lp-draw-check 0.6s ease 1.2s both' }} />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>Sello agregado</div>
                        <div className="lp-ok-bar"><i style={{ ['--from' as string]: '62%', ['--to' as string]: '87%' }} /></div>
                      </div>
                      <div style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: '#087A47' }}>7/8</div>
                    </div>
                    <div className="lp-prize">
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5BE0A3', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Al completar</div>
                      <div style={{ marginTop: 2, fontFamily: 'var(--font-outfit), sans-serif', fontSize: 18, fontWeight: 600 }}>1 café gratis, automático</div>
                    </div>
                  </div>
                )}
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
