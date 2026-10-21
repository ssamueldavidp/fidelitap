'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { PushOptIn } from '@/components/push/push-opt-in'
import { isPushEligible } from '@/lib/push/eligibility'
import { WalletButtons } from '@/components/wallet/wallet-buttons'

interface SuccessScreenProps {
  customerCardId: string
  walletAuthToken: string
  alreadyHadCard: boolean
  uniqueCode: string
  businessPlan: string
  businessSubscriptionStatus: string
}

export function SuccessScreen({
  customerCardId,
  walletAuthToken,
  alreadyHadCard,
  uniqueCode,
  businessPlan,
  businessSubscriptionStatus,
}: SuccessScreenProps) {
  const appleUrl  = `/api/wallet/apple/${customerCardId}?token=${walletAuthToken}`
  const googleUrl = `/api/wallet/google/${customerCardId}?token=${walletAuthToken}`
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    // Must match what the scanner passes to addStampAction — the card's
    // unique_code, not a URL. (Was encoding the business's public /c/[slug]
    // activation link, which the scanner's exact unique_code lookup would
    // never match — every "scan this at the register" attempt would fail.)
    QRCode.toDataURL(uniqueCode, {
      width: 240,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [uniqueCode])

  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <p className="text-4xl mb-2">🎉</p>
        <h2 className="text-xl font-black text-foreground">
          {alreadyHadCard ? '¡Ya tienes esta tarjeta!' : '¡Tarjeta activada!'}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Agrégala a tu Wallet para acumular sellos
        </p>
      </div>

      {/* Wallet buttons */}
      <WalletButtons appleUrl={appleUrl} googleUrl={googleUrl} />

      {isPushEligible(businessPlan, businessSubscriptionStatus) && (
        <PushOptIn customerCardId={customerCardId} walletAuthToken={walletAuthToken} />
      )}

      {/* Large QR */}
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu código QR</p>
          <div className="bg-white rounded-2xl p-3">
            <img src={qrDataUrl} alt="Código QR para escanear y acumular sellos en esta tarjeta" className="w-48 h-48" />
          </div>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Muestra este QR en cada visita para acumular sellos.<br/>
            También puedes escanearlo con la cámara de tu teléfono.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground/60">
        Tu tarjeta está guardada. Agrégala a Wallet para acceso rápido.
      </p>
    </div>
  )
}
