'use client'

import { useState } from 'react'

/* eslint-disable @next/next/no-img-element */

const APPLE_BADGE = '/wallet/add-to-apple-wallet.svg'
const GOOGLE_BADGE = '/wallet/add-to-google-wallet.svg'

/**
 * Botones para agregar la tarjeta al Wallet.
 * - Google: botón oficial de Google (SVG sin modificar, versión es-419).
 * - Apple: insignia oficial de Apple en `public/wallet/add-to-apple-wallet.svg` (Apple la entrega
 *   bajo su licencia de arte de marketing). Mientras no esté el archivo, se muestra un botón provisional.
 */
export function WalletButtons({ appleUrl, googleUrl }: { appleUrl: string; googleUrl: string }) {
  const [appleMissing, setAppleMissing] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3">
      <a href={appleUrl} aria-label="Agregar a Apple Wallet" className="block">
        {appleMissing ? (
          <span className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-black px-8 text-sm font-semibold text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Agregar a Apple Wallet
          </span>
        ) : (
          <img
            src={APPLE_BADGE}
            alt="Agregar a Apple Wallet"
            className="h-[50px] w-auto"
            onError={() => setAppleMissing(true)}
            ref={(el) => {
              // Si el archivo falló antes de que React hidratara, onError no se dispara.
              if (el && el.complete && el.naturalWidth === 0) setAppleMissing(true)
            }}
          />
        )}
      </a>

      <a href={googleUrl} aria-label="Agregar a Google Wallet" className="block">
        <img src={GOOGLE_BADGE} alt="Agregar a Google Wallet" width={378} height={50} className="h-[50px] w-auto" />
      </a>
    </div>
  )
}
