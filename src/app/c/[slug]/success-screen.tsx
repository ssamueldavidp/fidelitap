'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { PushOptIn } from '@/components/push/push-opt-in'
import { isPushEligible } from '@/lib/push/eligibility'

interface SuccessScreenProps {
  customerCardId: string
  walletAuthToken: string
  alreadyHadCard: boolean
  shareUrl: string
  businessPlan: string
  businessSubscriptionStatus: string
}

export function SuccessScreen({
  customerCardId,
  walletAuthToken,
  alreadyHadCard,
  shareUrl,
  businessPlan,
  businessSubscriptionStatus,
}: SuccessScreenProps) {
  const appleUrl  = `/api/wallet/apple/${customerCardId}?token=${walletAuthToken}`
  const googleUrl = `/api/wallet/google/${customerCardId}?token=${walletAuthToken}`
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [shareUrl])

  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <p className="text-4xl mb-2">🎉</p>
        <h2 className="text-xl font-black text-white">
          {alreadyHadCard ? '¡Ya tienes esta tarjeta!' : '¡Tarjeta activada!'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Agrégala a tu Wallet para acumular sellos
        </p>
      </div>

      {/* Wallet buttons */}
      <div className="flex flex-col gap-3">
        <a
          href={appleUrl}
          className="flex items-center justify-center gap-2 bg-black text-white font-semibold text-sm rounded-xl py-3 border border-slate-700 hover:border-slate-500 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Agregar a Apple Wallet
        </a>

        <a
          href={googleUrl}
          className="flex items-center justify-center gap-2 bg-white text-slate-900 font-semibold text-sm rounded-xl py-3 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Agregar a Google Wallet
        </a>
      </div>

      {isPushEligible(businessPlan, businessSubscriptionStatus) && (
        <PushOptIn customerCardId={customerCardId} walletAuthToken={walletAuthToken} />
      )}

      {/* Large QR */}
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tu código QR</p>
          <div className="bg-white rounded-2xl p-3">
            <img src={qrDataUrl} alt="QR de tu tarjeta" className="w-48 h-48" />
          </div>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Muestra este QR en cada visita para acumular sellos.<br/>
            También puedes escanearlo con la cámara de tu teléfono.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-600">
        Tu tarjeta está guardada. Agrégala a Wallet para acceso rápido.
      </p>
    </div>
  )
}
