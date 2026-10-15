import Image from 'next/image'
import Link from 'next/link'

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#precios', label: 'Precios' },
  { href: '/tiendas', label: 'Tiendas' },
  { href: '/register', label: 'Negocios' },
]

export function Navbar() {
  return (
    <nav className="lp-nav" aria-label="Principal">
      <div className="lp-nav-in">
        <Link href="/" className="lp-logo" aria-label="Fidelitap, inicio">
          <Image src="/fidelitap-logo.png" alt="Fidelitap" width={106} height={46} priority />
        </Link>

        <div className="lp-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="lp-navlink">{l.label}</Link>
          ))}
        </div>

        <div className="lp-actions">
          <Link href="/login" className="lp-signin lp-navlink">Iniciar sesión</Link>
          <Link href="/register" className="lp-btn lp-cta-sm">Empezar gratis</Link>

          {/* Menú móvil sin JavaScript */}
          <details className="lp-menu">
            <summary aria-label="Abrir menú">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12161C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="lp-menu-panel">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href}>{l.label}</Link>
              ))}
              <Link href="/login">Iniciar sesión</Link>
            </div>
          </details>
        </div>
      </div>
    </nav>
  )
}
