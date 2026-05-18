'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { createCardAction, updateCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

const CARD_COLORS = ['#00C896', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9']
const CARD_EMOJIS = ['☕', '🍕', '🌮', '🍔', '🎂', '✂️', '🛍️', '💈', '🍦', '🥐', '🍣', '🎯', '💪', '📚', '🌸', '🎵', '🍷', '🧁', '🏋️', '🎨', '🐾', '🧘', '🚀', '⭐']

interface CardEditorProps {
  card?: LoyaltyCard
  businessName: string
}

export function CardEditor({ card, businessName }: CardEditorProps) {
  const isEdit = !!card
  const existingDesign = card?.design_config as CardDesignConfig | undefined

  const [name, setName] = useState(card?.name ?? '')
  const [benefitDescription, setBenefitDescription] = useState(card?.benefit_description ?? '')
  const [stampsRequired, setStampsRequired] = useState(card?.stamps_required ?? 8)
  const [stampIcon, setStampIcon] = useState(existingDesign?.stamp_icon ?? '☕')
  const [color, setColor] = useState(existingDesign?.color ?? '#00C896')
  const [bgType, setBgType] = useState<'solid' | 'image'>(
    existingDesign?.bg_type === 'image' ? 'image' : 'solid'
  )
  const [bgImageFile, setBgImageFile] = useState<File | null>(null)
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(
    existingDesign?.bg_image_url ?? null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (bgImagePreview && bgImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(bgImagePreview)
      }
    }
  }, [bgImagePreview])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgImageFile(file)
    setBgImagePreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    if (isEdit) fd.append('id', card.id)
    fd.append('name', name)
    fd.append('benefit_description', benefitDescription)
    fd.append('stamps_required', String(stampsRequired))
    fd.append('stamp_icon', stampIcon)
    fd.append('bg_type', bgType)
    fd.append('color', color)
    if (bgImageFile) fd.append('bg_image', bgImageFile)

    startTransition(async () => {
      const result = isEdit
        ? await updateCardAction(fd)
        : await createCardAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center gap-4">
        <Link href="/cards" className="text-slate-400 hover:text-white text-sm transition-colors">
          ← Mis tarjetas
        </Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-lg font-black">{isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-10 p-8 max-w-4xl">
        {/* Form column */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Información */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Información</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre de la tarjeta</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Café mensual"
                  maxLength={50}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Premio al completar</label>
                <input
                  value={benefitDescription}
                  onChange={e => setBenefitDescription(e.target.value)}
                  placeholder="Ej: 1 café gratis"
                  maxLength={100}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Sellos requeridos: <span className="text-white font-bold">{stampsRequired}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={stampsRequired}
                  onChange={e => setStampsRequired(Number(e.target.value))}
                  className="w-full accent-[#00C896]"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>2</span><span>20</span>
                </div>
              </div>
            </div>
          </section>

          {/* Diseño */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Diseño</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Ícono</label>
                <div className="flex flex-wrap gap-2">
                  {CARD_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStampIcon(emoji)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors ${
                        stampIcon === emoji
                          ? 'border-[#00C896] bg-slate-800'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Fondo</label>
                <div className="flex gap-2 mb-3">
                  {(['solid', 'image'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBgType(type)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        bgType === type
                          ? 'border-[#00C896] text-[#00C896] bg-slate-900'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {type === 'solid' ? 'Color' : 'Foto'}
                    </button>
                  ))}
                </div>

                {bgType === 'solid' && (
                  <div className="flex gap-3">
                    {CARD_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                        style={{
                          background: c,
                          outline: color === c ? `3px solid white` : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                )}

                {bgType === 'image' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    {bgImagePreview ? (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-700 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bgImagePreview} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity"
                        >
                          Cambiar foto
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors"
                      >
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">Subir foto (max 2MB)</span>
                      </button>
                    )}
                    <p className="text-xs text-slate-600 mt-1">JPG, PNG o WebP</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
          </button>
        </div>

        {/* Preview column */}
        <div className="w-64 shrink-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Preview Wallet</p>
          <WalletPreview
            businessName={businessName}
            name={name}
            benefitDescription={benefitDescription}
            stampsRequired={stampsRequired}
            stampIcon={stampIcon}
            color={color}
            bgType={bgType}
            bgImageUrl={bgImagePreview}
            filledStamps={3}
          />
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Así verán la tarjeta tus clientes en Apple Wallet y Google Wallet.
          </p>
        </div>
      </form>
    </div>
  )
}
