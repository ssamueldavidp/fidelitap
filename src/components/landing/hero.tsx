import Link from 'next/link'
import { PhoneFrame } from './phone-frame'
import { WalletPass } from './wallet-pass'

export function Hero() {
  return (
    <section id="inicio" className="lp-hero">
      <div className="lp-badge lp-fu"><i />Fidelización digital</div>
      <h1 className="lp-h1 lp-fu" style={{ animationDelay: '0.1s' }}>Haz que tus clientes siempre regresen</h1>
      <p className="lp-sub lp-fu" style={{ animationDelay: '0.2s' }}>
        Crea tarjetas de sellos digitales en minutos. Tus clientes las guardan en Apple Wallet o Google Wallet y vuelven por su premio.
      </p>
      <div className="lp-cta-row lp-fu" style={{ animationDelay: '0.3s' }}>
        <Link href="/register" className="lp-btn lp-btn-primary">Crear mi tarjeta gratis</Link>
        <Link href="#como-funciona" className="lp-navlink lp-btn-link">Ver cómo funciona →</Link>
      </div>

      <div className="lp-stage">
        <div className="lp-glow" />

        <div className="lp-float-a" aria-hidden="true">
          <div className="lp-chip-light">
            <div className="lp-chip-k">Sello agregado</div>
            <div className="lp-chip-t">Café Luna</div>
            <div className="lp-chip-s">Te falta 1 sello para tu premio</div>
          </div>
        </div>
        <div className="lp-float-b" aria-hidden="true">
          <div className="lp-chip-dark">
            <div className="lp-chip-k">Premio listo</div>
            <div className="lp-chip-t">1 café gratis</div>
            <div className="lp-chip-s">Muéstralo en caja</div>
          </div>
        </div>

        <div className="lp-phone-slot">
          <div style={{ animation: 'lp-phone-in 1.1s cubic-bezier(0.2,0.8,0.2,1) 0.35s both' }}>
            <div style={{ animation: 'lp-float-y 9s ease-in-out 1.6s infinite' }}>
              <PhoneFrame>
                <div className="lp-wallet-pad">
                  <div className="lp-wallet-head">
                    <div className="lp-wallet-title" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>Wallet</div>
                    <div className="lp-plus">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2B3340" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </div>
                  </div>
                  <div className="lp-stack">
                    <div className="lp-peek" style={{ top: 0, background: '#1F4FD8' }}><b>Gimnasio Pulso</b><span>5/10</span></div>
                    <div className="lp-peek" style={{ top: 40, background: '#C2410C' }}><b>Panadería Sol</b><span>3/6</span></div>
                    <div style={{ position: 'absolute', left: 0, top: 82 }}>
                      <WalletPass color="#087A47" filled={6} mode="loop" />
                    </div>
                  </div>
                </div>
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
