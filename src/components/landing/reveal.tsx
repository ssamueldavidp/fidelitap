'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

// Aparición suave al desplazarse. Sin JS, o con "reducir movimiento", el contenido se ve normal.
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return

    el.dataset.state = 'hidden'
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.state = 'in'
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}s` } : undefined
  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={style}>
      {children}
    </div>
  )
}
