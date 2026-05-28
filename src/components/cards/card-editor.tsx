'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { createCardAction, updateCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard, CardDesignConfig } from '@/types/database'
import type { CardStyle } from '@/components/cards/wallet-preview'

const PALETTE = [
  '#1d4ed8', '#0f766e', '#7c3aed', '#dc2626',
  '#d97706', '#16a34a', '#db2777', '#0ea5e9',
  '#111827', '#f97316', '#be185d', '#059669',
]

const EMOJIS = [
  '☕','🍕','🌮','🍔','🎂','✂️','🛍️','💈','🍦','🥐',
  '🍣','🎯','💪','📚','🌸','🎵','🍷','🧁','🏋️','🎨',
  '🐾','🧘','🚀','⭐','🍫','🥗','🎮','🏥','🐕','🌿',
]

const STYLES: { key: CardStyle; label: string; desc: string }[] = [
  { key: 'clean',     label: 'Clean',     desc: 'Loyalz · Minimal' },
  { key: 'modern',    label: 'Modern',    desc: 'Apple · Revolut' },
  { key: 'luxury',    label: 'Luxury',    desc: 'Amex · VIP' },
  { key: 'editorial', label: 'Editorial', desc: 'Boarding pass' },
  { key: 'minimal',   label: 'Minimal',   desc: 'Notion · Linear' },
]

interface CardEditorProps {
  card?: LoyaltyCard
  businessName: string
}

export function CardEditor({ card, businessName }: CardEditorProps) {
  const isEdit = !!card
  const existingDesign = card?.design_config as CardDesignConfig | undefined

  const [name,            setName]          = useState(card?.name ?? '')
  const [benefit,         setBenefit]       = useState(card?.benefit_description ?? '')
  const [stampsRequired,  setStampsRequired]= useState(card?.stamps_required ?? 8)
  const [stampIcon,       setStampIcon]     = useState(existingDesign?.stamp_icon ?? '☕')
  const [color,           setColor]         = useState(existingDesign?.color ?? '#1d4ed8')
  const [cardStyle,       setCardStyle]     = useState<CardStyle>(existingDesign?.style ?? 'clean')
  const [bgMode,          setBgMode]        = useState<'light' | 'dark'>(existingDesign?.bg_mode ?? 'light')
  const [bgType,          setBgType]        = useState<'solid' | 'image'>(existingDesign?.bg_type === 'image' ? 'image' : 'solid')
  const [bgImageFile,     setBgImageFile]   = useState<File | null>(null)
  const [bgImagePreview,  setBgImagePreview]= useState<string | null>(existingDesign?.bg_image_url ?? null)
  const [logoFile,        setLogoFile]      = useState<File | null>(null)
  const [logoPreview,     setLogoPreview]   = useState<string | null>(existingDesign?.logo_url ?? null)
  const [error,           setError]         = useState<string | null>(null)
  const [isPending,       startTransition]  = useTransition()
  const bgInputRef   = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (bgImagePreview?.startsWith('blob:'))  URL.revokeObjectURL(bgImagePreview)
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
    }
  }, [bgImagePreview, logoPreview])

  function handleBgImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgImageFile(file)
    setBgImagePreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    if (isEdit) fd.append('id', card.id)
    fd.append('name',               name)
    fd.append('benefit_description',benefit)
    fd.append('stamps_required',    String(stampsRequired))
    fd.append('stamp_icon',         stampIcon)
    fd.append('bg_type',            bgType)
    fd.append('color',              color)
    fd.append('style',              cardStyle)
    fd.append('bg_mode',            bgMode)
    if (bgImageFile) fd.append('bg_image', bgImageFile)
    if (logoFile)    fd.append('logo',     logoFile)

    startTransition(async () => {
      const result = isEdit ? await updateCardAction(fd) : await createCardAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex h-screen bg-[#080810] text-white overflow-hidden">

      {/* LEFT SIDEBAR */}
      <div className="w-80 shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <Link href="/cards" className="text-white/40 hover:text-white transition-colors text-sm">←</Link>
          <h1 className="font-bold text-sm text-white">{isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1>
        </div>

        <form id="card-form" onSubmit={handleSubmit} className="flex-1 flex flex-col gap-0">

          {/* Información */}
          <SidebarSection label="Información">
            <Field label="Nombre de la tarjeta">
              <EditorInput value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Café de la casa" maxLength={50} />
            </Field>
            <Field label="Premio al completar">
              <EditorInput value={benefit} onChange={e => setBenefit(e.target.value)} placeholder="Ej: 1 café gratis" maxLength={100} />
            </Field>
            <Field label={`Sellos requeridos: ${stampsRequired}`}>
              <input
                type="range" min={2} max={20} value={stampsRequired}
                onChange={e => setStampsRequired(Number(e.target.value))}
                className="w-full accent-[#00C896]"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>2</span><span>20</span></div>
            </Field>
          </SidebarSection>

          {/* Estilo */}
          <SidebarSection label="Estilo de tarjeta">
            <div className="flex flex-col gap-2">
              {STYLES.map(s => (
                <motion.button
                  key={s.key}
                  type="button"
                  onClick={() => setCardStyle(s.key)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    cardStyle === s.key
                      ? 'border-[#00C896] bg-[#00C896]/8'
                      : 'border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex-shrink-0"
                    style={{ background: cardStyle === s.key ? '#00C896' : 'rgba(255,255,255,0.05)' }}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${cardStyle === s.key ? 'text-white' : 'text-white/60'}`}>{s.label}</p>
                    <p className="text-[10px] text-white/30">{s.desc}</p>
                  </div>
                  {cardStyle === s.key && <span className="ml-auto text-[#00C896] text-sm">✓</span>}
                </motion.button>
              ))}
            </div>
          </SidebarSection>

          {/* Marca */}
          <SidebarSection label="Marca">
            <Field label="Color de marca">
              <div className="grid grid-cols-6 gap-2 mb-2">
                {PALETTE.map(c => (
                  <motion.button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-8 h-8 rounded-full relative"
                    style={{ background: c }}
                  >
                    {color === c && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-black">✓</span>
                    )}
                  </motion.button>
                ))}
              </div>
              <input
                type="text"
                value={color}
                onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value) }}
                placeholder="#1d4ed8"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#00C896]"
              />
            </Field>

            <Field label="Ícono del sello">
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setStampIcon(emoji)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border transition-colors ${
                      stampIcon === emoji
                        ? 'border-[#00C896] bg-white/10'
                        : 'border-white/[0.07] hover:border-white/20'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Logo del negocio (opcional)">
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} className="hidden" />
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="text-xs text-white/50 hover:text-white transition-colors">Cambiar</button>
                    <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null) }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Quitar</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-14 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/30 hover:border-white/25 hover:text-white/50 transition-colors text-sm"
                >
                  <span>📷</span> Subir logo (max 2MB)
                </button>
              )}
            </Field>
          </SidebarSection>

          {/* Fondo */}
          <SidebarSection label="Fondo">
            {cardStyle === 'clean' && (
              <Field label="Modo">
                <div className="flex gap-2">
                  {(['light', 'dark'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBgMode(m)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        bgMode === m ? 'border-[#00C896] text-[#00C896]' : 'border-white/10 text-white/40 hover:border-white/20'
                      }`}
                    >
                      {m === 'light' ? '☀️ Claro' : '🌙 Oscuro'}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Foto de fondo (opcional)">
              <div className="flex gap-2 mb-2">
                {(['solid', 'image'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBgType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      bgType === t ? 'border-[#00C896] text-[#00C896]' : 'border-white/10 text-white/40 hover:border-white/20'
                    }`}
                  >
                    {t === 'solid' ? 'Color' : 'Foto'}
                  </button>
                ))}
              </div>
              {bgType === 'image' && (
                <>
                  <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBgImageChange} className="hidden" />
                  {bgImagePreview ? (
                    <div className="relative h-20 rounded-lg overflow-hidden border border-white/10 group cursor-pointer" onClick={() => bgInputRef.current?.click()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bgImagePreview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">Cambiar foto</div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bgInputRef.current?.click()}
                      className="w-full h-20 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-1 text-white/30 hover:border-white/25 transition-colors"
                    >
                      <span className="text-xl">📷</span>
                      <span className="text-xs">Subir foto de fondo</span>
                    </button>
                  )}
                </>
              )}
            </Field>
          </SidebarSection>

          {/* Submit */}
          <div className="px-5 py-4 border-t border-white/[0.06] mt-auto shrink-0">
            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}
            <button
              type="submit"
              form="card-form"
              disabled={isPending}
              className="w-full bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT: LIVE PREVIEW */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto bg-[#060609]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-6">Vista previa</p>
        <motion.div
          key={cardStyle}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ width: 300 }}
        >
          <WalletPreview
            businessName={businessName}
            name={name}
            benefitDescription={benefit}
            stampsRequired={stampsRequired}
            stampIcon={stampIcon}
            color={color}
            cardStyle={cardStyle}
            bgMode={bgMode}
            bgType={bgType}
            bgImageUrl={bgImagePreview}
            logoUrl={logoPreview}
            filledStamps={Math.floor(stampsRequired / 2)}
            size="md"
          />
        </motion.div>
        <p className="text-[10px] text-white/20 mt-5 text-center leading-relaxed">
          Así verán la tarjeta tus clientes.<br/>
          El QR real se muestra cuando el cliente activa la tarjeta.
        </p>
      </div>
    </div>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/[0.06] px-5 py-4">
      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">{label}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function EditorInput({ value, onChange, placeholder, maxLength }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#00C896] transition-colors"
    />
  )
}
