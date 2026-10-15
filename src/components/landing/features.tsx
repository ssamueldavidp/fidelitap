import { Reveal } from './reveal'

const stroke = { fill: 'none', stroke: '#087A47', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const FEATURES = [
  {
    title: 'Diseño propio',
    desc: 'Colores, fondos e íconos',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.4-1.1-.3-.4-.4-.7-.4-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2Z" />
        <circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15.5" cy="7.5" r="1" />
      </svg>
    ),
  },
  {
    title: 'Apple & Google Wallet',
    desc: 'Sin apps adicionales',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" />
      </svg>
    ),
  },
  {
    title: 'Escaneo QR',
    desc: 'Sello instantáneo',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" />
      </svg>
    ),
  },
  {
    title: 'Anti-fraude',
    desc: 'Código único por tarjeta',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" {...stroke} aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
]

export function Features() {
  return (
    <section className="lp-feat-sec">
      <div className="lp-feat">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="lp-feat-card lp-lift">
              {f.icon}
              <h3 className="lp-feat-t">{f.title}</h3>
              <p className="lp-feat-d">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
