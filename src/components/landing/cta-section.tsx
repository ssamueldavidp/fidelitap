import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from './reveal'

export function CtaSection() {
  return (
    <>
      <section className="lp-sec" id="negocios">
        <Reveal>
          <div className="lp-cta">
            <h2>¿Listo para fidelizar a tus clientes?</h2>
            <p>Empieza gratis hoy.</p>
            <Link href="/register" className="lp-btn lp-btn-primary">Crear mi tarjeta gratis</Link>
            <div className="lp-checks">
              <span>✓ Sin contrato</span>
              <span>✓ Cancela cuando quieras</span>
              <span>✓ Soporte en español</span>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-in">
          <Image src="/fidelitap-logo.png" alt="Fidelitap" width={101} height={44} />
          <nav className="lp-foot-links" aria-label="Pie de página">
            <Link href="#como-funciona">Cómo funciona</Link>
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/register">Registro</Link>
            <Link href="/privacy">Privacidad</Link>
            <Link href="/terms">Términos</Link>
          </nav>
          <p className="lp-foot-copy">© 2026 FideliTap. Hecho en Colombia.</p>
        </div>
      </footer>
    </>
  )
}
