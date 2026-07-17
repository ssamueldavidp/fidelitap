'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { resolveStorageUrl } from '@/lib/storage-url'
import { toggleCardAction, deleteCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

interface CardDrawerProps {
  card: LoyaltyCard
  businessName: string
  customerCount: number
  redemptionCount: number
  onClose: () => void
}

export function CardDrawer({
  card,
  businessName,
  customerCount,
  redemptionCount,
  onClose,
}: CardDrawerProps) {
  const design = card.design_config as unknown as CardDesignConfig
  const shareUrl = `${APP_URL}/c/${card.slug}`

  const [isActive, setIsActive] = useState(card.is_active)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { width: 300, margin: 2, color: { dark: '#111827', light: '#ffffff' } }).then(setQrDataUrl)
  }, [shareUrl])

  function handleToggle() {
    const newValue = !isActive
    setIsActive(newValue)
    startTransition(async () => {
      const result = await toggleCardAction(card.id, newValue)
      if (result?.error) {
        setIsActive(!newValue)
        setActionError(result.error)
      }
    })
  }

  function handleCopyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCardAction(card.id)
      if (result?.error) {
        setActionError(result.error)
        setShowDeleteConfirm(false)
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-card border-l border-border flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-black text-foreground text-sm truncate">{card.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">
          {/* Mini wallet preview */}
          <WalletPreview
            businessName={businessName}
            name={card.name}
            benefitDescription={card.benefit_description}
            stampsRequired={card.stamps_required}
            stampIcon={design.stamp_icon ?? '⭐'}
            color={design.color ?? '#00C896'}
            cardStyle={design.style ?? 'clean'}
            bgMode={design.bg_mode ?? 'light'}
            bgType={design.bg_type === 'image' ? 'image' : 'solid'}
            bgImageUrl={resolveStorageUrl(design.bg_image_url)}
            logoUrl={resolveStorageUrl(design.logo_url)}
            filledStamps={3}
            qrDataUrl={qrDataUrl || null}
            size="sm"
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-2xl font-black text-foreground">{customerCount}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-2xl font-black text-foreground">{redemptionCount}</p>
              <p className="text-xs text-muted-foreground">Canjes</p>
            </div>
          </div>

          {actionError && (
            <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}

          {/* Edit button */}
          <Link
            href={`/cards/${card.id}/editar`}
            className="flex items-center justify-center gap-2 bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-2.5 hover:bg-[#00b386] transition-colors"
          >
            ✏️ Editar tarjeta
          </Link>

          {/* Toggle active */}
          <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
            <span className="text-sm text-foreground">Tarjeta activa</span>
            <button
              onClick={handleToggle}
              disabled={isPending}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${isActive ? 'bg-[#00C896]' : 'bg-muted-foreground/30'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Large QR for scanning */}
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3 bg-muted rounded-2xl p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider self-start">QR de activación</p>
              <div className="bg-white rounded-2xl p-3 shadow-lg">
                <img src={qrDataUrl} alt="QR de activación" className="w-44 h-44" />
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
                Muestra este QR a tus clientes para que activen su tarjeta
              </p>
            </div>
          )}

          {/* Share link */}
          <div className="bg-muted rounded-xl p-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Enlace para clientes</p>
            <p className="text-xs text-[#00C896] break-all">{shareUrl}</p>
            <button
              onClick={handleCopyLink}
              className="w-full text-xs font-semibold text-foreground/80 hover:text-foreground border border-border hover:border-muted-foreground rounded-lg py-1.5 transition-colors"
            >
              {copied ? '✓ Copiado' : 'Copiar enlace'}
            </button>
          </div>

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors py-2 border-t border-border"
            >
              🗑 Eliminar tarjeta
            </button>
          ) : (
            <div className="border border-red-900 bg-red-950/30 rounded-xl p-4">
              <p className="text-xs text-foreground/80 mb-3 leading-relaxed">
                {customerCount > 0
                  ? `Esta tarjeta tiene ${customerCount} clientes con sellos. Sus datos se conservarán. ¿Confirmar?`
                  : '¿Eliminar esta tarjeta? Esta acción no se puede deshacer.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-xs border border-border rounded-lg py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg py-1.5 font-semibold disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
