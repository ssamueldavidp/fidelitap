import Link from 'next/link'
import { Reveal } from './reveal'

type Feature = { text: string; included?: boolean }

const PLANS: {
  key: string
  name: string
  price: string
  note: string
  cta: string
  pro?: boolean
  features: Feature[]
}[] = [
  {
    key: 'basic',
    name: 'Básico',
    price: '$49.900',
    note: 'Menos que un café',
    cta: 'Elegir Básico',
    features: [
      { text: 'Hasta 3 tarjetas de fidelización' },
      { text: 'Hasta 500 clientes activos' },
      { text: 'Apple & Google Wallet' },
      { text: 'Escaneo QR ilimitado' },
      { text: 'Cartel QR imprimible' },
      { text: 'Soporte por email' },
      { text: 'Estadísticas de retención', included: false },
      { text: 'Aparecer en Tiendas cercanas', included: false },
      { text: 'Notificaciones push a tus clientes', included: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99.900',
    note: 'Si recuperas solo 2 clientes recurrentes al mes, el plan se paga solo.',
    cta: 'Quiero el Pro →',
    pro: true,
    features: [
      { text: '10 tarjetas de fidelización' },
      { text: 'Hasta 2.000 clientes activos' },
      { text: 'Apple & Google Wallet' },
      { text: 'Escaneo QR ilimitado' },
      { text: 'Cartel QR imprimible' },
      { text: 'Estadísticas de retención' },
      { text: 'Soporte prioritario' },
      { text: 'Aparecer en Tiendas cercanas' },
      { text: 'Notificaciones push y alertas de proximidad' },
      { text: 'Diseño personalizado avanzado' },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$179.900',
    note: 'Para negocios en serio',
    cta: 'Elegir Premium',
    features: [
      { text: 'Tarjetas ilimitadas' },
      { text: 'Clientes ilimitados' },
      { text: 'Apple & Google Wallet' },
      { text: 'Escaneo QR ilimitado' },
      { text: 'Cartel QR imprimible' },
      { text: 'Estadísticas avanzadas y exportar' },
      { text: 'Soporte dedicado por WhatsApp' },
      { text: 'Todo lo de Pro, con Tiendas cercanas y push' },
      { text: 'Acceso anticipado a novedades' },
    ],
  },
]

export function PricingSection() {
  return (
    <section id="precios" className="lp-sec">
      <div className="lp-wrap">
        <Reveal className="lp-center">
          <div className="lp-kicker">Precios</div>
          <h2 className="lp-h2">Elige el plan de tu negocio</h2>
          <p className="lp-lead">Se cobra cada mes de forma automática. Cancela cuando quieras.</p>
        </Reveal>

        <Reveal>
          <div className="lp-free">
            <div>
              <h3 className="lp-free-t">Plan Gratis, para siempre</h3>
              <p className="lp-free-d">1 tarjeta, hasta 20 clientes, Apple y Google Wallet, escaneo QR.</p>
            </div>
            <Link href="/register" className="lp-btn lp-btn-outline">Empezar gratis</Link>
          </div>
        </Reveal>

        <div className="lp-plans">
          {PLANS.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.08}>
              <div className={`lp-plan lp-lift${p.pro ? ' pro' : ''}`}>
                <div>
                  <div className="lp-plan-head">
                    <h3 className="lp-plan-name">{p.name}</h3>
                    {p.pro && <span className="lp-pop">Más popular</span>}
                  </div>
                  <div className="lp-price"><b>{p.price}</b><span>/mes</span></div>
                  <p className="lp-plan-note">{p.note}</p>
                </div>
                <ul className="lp-list">
                  {p.features.map((f) => (
                    <li key={f.text} className={`lp-li${f.included === false ? ' no' : ''}`}>{f.text}</li>
                  ))}
                </ul>
                <Link href={`/register?plan=${p.key}`} className="lp-btn lp-plan-cta">{p.cta}</Link>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="lp-fine">
          Precios en pesos colombianos. Los planes pagos se renuevan automáticamente cada mes hasta que canceles desde Ajustes.
          Lee la <Link href="/terms#suscripciones">política de cancelación</Link>.
        </p>
      </div>
    </section>
  )
}
