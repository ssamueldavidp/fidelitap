import type { CSSProperties } from 'react'

type Mode = 'still' | 'pop' | 'last' | 'loop'

export function CupIcon({ size = 22, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8.5 3.5c0 1 1 1 1 2M12.5 3.5c0 1 1 1 1 2" />
    </svg>
  )
}

// Código QR decorativo y determinista (no es un QR real).
export function qrCells(n: number): boolean[] {
  const cells: boolean[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const finder = (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3)
      const hole = (r === 1 && c === 1) || (r === 1 && c === n - 2) || (r === n - 2 && c === 1)
      cells.push(finder ? !hole : (r * 5 + c * 11 + r * c) % 7 < 3)
    }
  }
  return cells
}

const TOTAL = 8

// Tarjeta de sellos estilo Apple Wallet. `mode` controla cómo entran los sellos:
// still = fijos, pop = aparecen escalonados, last = solo el último, loop = aparecen y el siguiente se repite.
export function WalletPass({
  color = '#087A47',
  filled = 6,
  mode = 'pop',
  typing = false,
  brand = 'Café Luna',
}: {
  color?: string
  filled?: number
  mode?: Mode
  typing?: boolean
  brand?: string
}) {
  const stamps = Array.from({ length: TOTAL }, (_, i) => {
    let on = i < filled
    let animation = 'none'
    let delay = '0s'
    if (on && (mode === 'pop' || mode === 'loop')) {
      animation = 'lp-stamp-pop 0.6s cubic-bezier(0.2,0.9,0.3,1.3) both'
      delay = `${(0.4 + i * 0.12).toFixed(2)}s`
    }
    if (on && mode === 'last' && i === filled - 1) {
      animation = 'lp-stamp-pop 0.75s cubic-bezier(0.2,0.9,0.3,1.3) both'
      delay = '0.5s'
    }
    if (mode === 'loop' && i === filled) {
      animation = 'lp-stamp-loop 6s ease-in-out both infinite'
      delay = '1.2s'
      on = true
    }
    const style: CSSProperties = {
      background: on ? '#FFFFFF' : 'transparent',
      border: on ? '2px solid #FFFFFF' : '2px dashed rgba(255,255,255,0.5)',
      color: on ? color : 'rgba(255,255,255,0.4)',
      animation,
      animationDelay: delay,
    }
    return style
  })

  return (
    <div className="lp-pass" style={{ backgroundColor: color }}>
      <div className="lp-pass-shade" />
      <div className="lp-pass-sheen" />
      <div className="lp-pass-head">
        <div className="lp-pass-logo"><CupIcon stroke="#087A47" /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="lp-pass-k">Tarjeta de sellos</div>
          {typing ? (
            <div className="lp-pass-name">
              <span className="lp-pass-typing" style={{ ['--chars' as string]: `${brand.length}ch` }}>{brand}</span>
            </div>
          ) : (
            <div className="lp-pass-name">{brand}</div>
          )}
        </div>
        <div style={{ flex: 'none' }}>
          <div className="lp-pass-k" style={{ textAlign: 'right' }}>Sellos</div>
          <div className="lp-pass-count">{filled}/{TOTAL}</div>
        </div>
      </div>

      <div className="lp-pass-grid">
        {stamps.map((s, i) => (
          <div key={i} className="lp-stamp" style={s}><CupIcon /></div>
        ))}
      </div>

      <div className="lp-pass-foot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div>
            <div className="lp-pass-k">Premio</div>
            <div className="lp-pass-val">1 café gratis</div>
          </div>
          <div>
            <div className="lp-pass-k">Vence</div>
            <div className="lp-pass-val">31 dic 2026</div>
          </div>
        </div>
        <div className="lp-qr-box" aria-hidden="true">
          <div className="lp-qr">
            {qrCells(9).map((on, i) => (
              <i key={i} style={{ background: on ? '#12161C' : 'transparent' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
