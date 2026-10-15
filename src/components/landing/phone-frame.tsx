import type { ReactNode } from 'react'

// Teléfono con marco metálico, botones laterales, isla dinámica y reflejo de cristal.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="lp-phone">
      <i className="lp-pbtn l" style={{ top: 112, height: 30 }} />
      <i className="lp-pbtn l" style={{ top: 168, height: 54 }} />
      <i className="lp-pbtn l" style={{ top: 234, height: 54 }} />
      <i className="lp-pbtn r" style={{ top: 190, height: 84 }} />
      <div className="lp-screen">
        <div className="lp-island" />
        {children}
        <div className="lp-home" />
        <div className="lp-glare" />
      </div>
    </div>
  )
}
