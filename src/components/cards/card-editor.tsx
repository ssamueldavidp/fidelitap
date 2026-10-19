'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Camera, Check, Trash2, Plus, Sun, Moon, Sparkles, Gift, CalendarDays, Palette, Image as ImageIcon, Layers } from 'lucide-react'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { createCardAction, updateCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard, CardDesignConfig } from '@/types/database'
import type { CardStyle } from '@/components/cards/wallet-preview'
import { resolveStorageUrl } from '@/lib/storage-url'

const REWARD_COLORS = ['#00C896', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

interface RewardRow {
  stamps_required: number
  reward_label: string
  color: string
}

const PALETTE = [
  '#0A9F5B', '#FF6B3D', '#6D4AE8', '#2563EB',
  '#F59E0B', '#0F766E', '#DB2777', '#0EA5E9',
  '#DC2626', '#111827', '#16A34A', '#7C3AED',
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
  existingRewards?: { stamps_required: number; reward_label: string; color: string }[]
  businessName: string
}

export function CardEditor({ card, existingRewards, businessName }: CardEditorProps) {
  const isEdit = !!card
  const existingDesign = card?.design_config as CardDesignConfig | undefined

  const [name,            setName]          = useState(card?.name ?? '')
  const [benefit,         setBenefit]       = useState(card?.benefit_description ?? '')
  const [stampsRequired,  setStampsRequired]= useState(card?.stamps_required ?? 8)
  const [pushThreshold,   setPushThreshold] = useState(card?.push_notify_threshold ?? 1)
  const [stampIcon,       setStampIcon]     = useState(existingDesign?.stamp_icon ?? '☕')
  const [color,           setColor]         = useState(existingDesign?.color ?? '#0A9F5B')
  const [cardStyle,       setCardStyle]     = useState<CardStyle>(existingDesign?.style ?? 'clean')
  const [bgMode,          setBgMode]        = useState<'light' | 'dark'>(existingDesign?.bg_mode ?? 'light')
  const [bgType,          setBgType]        = useState<'solid' | 'image'>(existingDesign?.bg_type === 'image' ? 'image' : 'solid')
  const [bgImageFile,     setBgImageFile]   = useState<File | null>(null)
  const [bgImagePreview,  setBgImagePreview]= useState<string | null>(resolveStorageUrl(existingDesign?.bg_image_url) ?? null)
  const [logoFile,        setLogoFile]      = useState<File | null>(null)
  const [logoPreview,     setLogoPreview]   = useState<string | null>(resolveStorageUrl(existingDesign?.logo_url) ?? null)
  const [multiRewards,    setMultiRewards]  = useState(existingDesign?.multi_rewards ?? false)
  const [rewards,         setRewards]       = useState<RewardRow[]>(
    existingRewards && existingRewards.length > 0
      ? existingRewards.map(r => ({ stamps_required: r.stamps_required, reward_label: r.reward_label, color: r.color }))
      : [{ stamps_required: 5, reward_label: '', color: REWARD_COLORS[0] }]
  )
  const [hasExpiry,       setHasExpiry]     = useState(!!card?.expires_at)
  const [expiresAt,       setExpiresAt]     = useState(card?.expires_at ? card.expires_at.slice(0, 10) : '')
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
    fd.append('push_notify_threshold', String(pushThreshold))
    fd.append('stamp_icon',         stampIcon)
    fd.append('bg_type',            bgType)
    fd.append('color',              color)
    fd.append('style',              cardStyle)
    fd.append('bg_mode',            bgMode)
    fd.append('multi_rewards',      String(multiRewards))
    if (multiRewards) fd.append('rewards_json', JSON.stringify(rewards))
    if (hasExpiry && expiresAt) fd.append('expires_at', new Date(expiresAt).toISOString())
    if (bgImageFile) fd.append('bg_image', bgImageFile)
    if (logoFile)    fd.append('logo',     logoFile)

    startTransition(async () => {
      const result = isEdit ? await updateCardAction(fd) : await createCardAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-background text-foreground md:h-[calc(100vh-84px)] md:min-h-0 md:flex-row md:overflow-hidden">

      {/* IZQUIERDA: formulario */}
      <div className="flex min-h-0 w-full shrink-0 flex-col md:w-[480px] md:border-r md:border-border">
        <div className="flex items-center gap-3 px-5 pb-3 pt-5 md:px-6">
          <Link
            href="/cards"
            aria-label="Volver a Mis tarjetas"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-none tracking-tight">{isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Mira el resultado en vivo mientras la diseñas.</p>
          </div>
        </div>

        <form id="card-form" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-2 md:px-6">

            {/* Información */}
            <EditorSection icon={Sparkles} tone="primary" title="Información">
              <Field label="Nombre de la tarjeta">
                <EditorInput value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Café de la casa" maxLength={50} />
              </Field>
              <Field label="Premio al completar">
                <EditorInput value={benefit} onChange={e => setBenefit(e.target.value)} placeholder="Ej: 1 café gratis" maxLength={100} />
              </Field>
              <Field label="Sellos requeridos" value={String(stampsRequired)}>
                <input
                  type="range" min={2} max={20} value={stampsRequired}
                  onChange={e => setStampsRequired(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>2</span><span>20</span></div>
              </Field>
              <Field label="Avisar por push cuando falte" value={`${pushThreshold} sello${pushThreshold === 1 ? '' : 's'}`}>
                <input
                  type="range" min={1} max={5} value={pushThreshold}
                  onChange={e => setPushThreshold(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>1</span><span>5</span></div>
                <p className="mt-1.5 text-xs text-muted-foreground">Solo aplica si tu plan incluye notificaciones push (Pro/Premium).</p>
              </Field>
            </EditorSection>

            {/* Premios y vigencia */}
            <EditorSection icon={Gift} tone="sun" title="Premios y vigencia">
              <ToggleRow
                title="Multi-nivel de premios"
                subtitle="Recompensas en distintos puntos del camino"
                checked={multiRewards}
                onChange={setMultiRewards}
              />
              {multiRewards && (
                <div className="flex flex-col gap-2">
                  {rewards.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-2xl border border-border bg-muted px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={r.stamps_required}
                        onChange={e => setRewards(prev => prev.map((row, idx) => idx === i ? { ...row, stamps_required: Number(e.target.value) } : row))}
                        aria-label={`Sellos del nivel ${i + 1}`}
                        className="h-9 w-16 rounded-xl border border-border bg-card text-center text-sm font-bold text-foreground focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        value={r.reward_label}
                        onChange={e => setRewards(prev => prev.map((row, idx) => idx === i ? { ...row, reward_label: e.target.value } : row))}
                        placeholder={`Premio nivel ${i + 1}`}
                        maxLength={100}
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {rewards.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Quitar nivel ${i + 1}`}
                          onClick={() => setRewards(prev => prev.filter((_, idx) => idx !== i))}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-destructive"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  {rewards.length < 20 && (
                    <button
                      type="button"
                      onClick={() => setRewards(prev => [...prev, {
                        stamps_required: (prev[prev.length - 1]?.stamps_required ?? 0) + 5,
                        reward_label: '',
                        color: REWARD_COLORS[prev.length % REWARD_COLORS.length],
                      }])}
                      className="flex items-center gap-1.5 self-start rounded-full bg-accent px-3.5 py-2 text-sm font-bold text-accent-foreground"
                    >
                      <Plus size={15} /> Agregar nivel
                    </button>
                  )}
                </div>
              )}

              <ToggleRow
                title="Vigencia"
                subtitle={hasExpiry && expiresAt ? `Vence el ${expiresAt}` : 'Sin fecha de vencimiento'}
                checked={hasExpiry}
                onChange={v => { setHasExpiry(v); if (!v) setExpiresAt('') }}
                icon={CalendarDays}
              />
              {hasExpiry && (
                <input
                  type="date"
                  value={expiresAt}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-muted px-4 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              )}
            </EditorSection>

            {/* Estilo */}
            <EditorSection icon={Layers} tone="lilac" title="Estilo de tarjeta">
              <div className="grid grid-cols-2 gap-3">
                {STYLES.map((st, idx) => {
                  const active = cardStyle === st.key
                  const spanFull = STYLES.length % 2 === 1 && idx === STYLES.length - 1
                  return (
                    <motion.button
                      key={st.key}
                      type="button"
                      onClick={() => setCardStyle(st.key)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      aria-pressed={active}
                      className={`relative flex flex-col gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-colors ${spanFull ? 'col-span-2' : ''} ${
                        active ? 'border-primary bg-accent' : 'border-border bg-card hover:border-foreground/20'
                      }`}
                    >
                      <StyleThumb styleKey={st.key} color={color} />
                      <div className="px-1 pb-0.5">
                        <p className="text-sm font-bold">{st.label}</p>
                        <p className="text-[11px] text-muted-foreground">{st.desc}</p>
                      </div>
                      {active && (
                        <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </EditorSection>

            {/* Marca */}
            <EditorSection icon={Palette} tone="coral" title="Marca">
              <Field label="Color de marca">
                <div className="mb-3 grid grid-cols-6 gap-2.5">
                  {PALETTE.map(c => (
                    <motion.button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={`Color ${c}`}
                      aria-pressed={color === c}
                      className={`relative aspect-square w-full rounded-full ring-offset-2 ring-offset-card transition-shadow ${color === c ? 'ring-2 ring-foreground' : ''}`}
                      style={{ background: c }}
                    >
                      {color === c && <Check size={16} strokeWidth={3} className="absolute inset-0 m-auto text-white" />}
                    </motion.button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-12 w-12 shrink-0 rounded-2xl border border-border" style={{ background: color }} />
                  <input
                    type="text"
                    value={color}
                    onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(e.target.value) }}
                    placeholder="#0A9F5B"
                    aria-label="Color en hexadecimal"
                    className="h-12 w-full rounded-2xl border border-border bg-muted px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </Field>

              <Field label="Ícono del sello">
                <div className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-6">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStampIcon(emoji)}
                      aria-label={`Ícono ${emoji}`}
                      aria-pressed={stampIcon === emoji}
                      className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-xl transition-colors ${
                        stampIcon === emoji ? 'border-primary bg-accent' : 'border-transparent bg-muted hover:border-foreground/15'
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
                  <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="logo" className="h-14 w-14 rounded-xl border border-border object-cover" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-bold">Cambiar</button>
                      <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null) }} className="rounded-full px-3.5 py-1.5 text-sm font-bold text-destructive">Quitar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Camera size={18} /> Subir logo (máx. 2 MB)
                  </button>
                )}
              </Field>
            </EditorSection>

            {/* Fondo */}
            <EditorSection icon={ImageIcon} tone="sky" title="Fondo">
              {cardStyle === 'clean' && (
                <Field label="Modo">
                  <Segmented
                    value={bgMode}
                    onChange={setBgMode}
                    options={[
                      { value: 'light', label: 'Claro', icon: Sun },
                      { value: 'dark', label: 'Oscuro', icon: Moon },
                    ]}
                  />
                </Field>
              )}

              <Field label="Fondo de la tarjeta">
                <Segmented
                  value={bgType}
                  onChange={setBgType}
                  options={[
                    { value: 'solid', label: 'Color' },
                    { value: 'image', label: 'Foto' },
                  ]}
                />
                {bgType === 'image' && (
                  <div className="mt-3">
                    <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBgImageChange} className="hidden" />
                    {bgImagePreview ? (
                      <div className="group relative h-28 cursor-pointer overflow-hidden rounded-2xl border border-border" onClick={() => bgInputRef.current?.click()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bgImagePreview} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">Cambiar foto</div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bgInputRef.current?.click()}
                        className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <Camera size={22} />
                        <span className="text-sm font-semibold">Subir foto de fondo</span>
                      </button>
                    )}
                  </div>
                )}
              </Field>
            </EditorSection>
          </div>

          {/* Guardar */}
          <div className="shrink-0 border-t border-border bg-card/90 px-5 py-4 backdrop-blur md:px-6">
            {error && (
              <p className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              form="card-form"
              disabled={isPending}
              className="h-[52px] w-full rounded-full bg-gradient-to-br from-[#0A9F5B] to-[#087A47] text-[15px] font-extrabold text-white shadow-[0_12px_26px_rgba(10,159,91,0.4)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
            </button>
          </div>
        </form>
      </div>

      {/* DERECHA: vista previa en vivo */}
      <div className="relative flex min-h-[520px] flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-accent via-background to-accent/60 p-8 md:min-h-0">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary/[0.07]" />
        <span className="relative mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground shadow-card">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Vista previa en vivo
        </span>
        <motion.div
          key={cardStyle}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="relative"
          style={{ width: 320, maxWidth: '100%' }}
        >
          <div className="absolute inset-x-6 -bottom-6 h-16 rounded-full bg-black/25 blur-2xl" />
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
        <p className="relative mt-9 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          Así verán la tarjeta tus clientes en Apple y Google Wallet. El QR real aparece cuando activan la tarjeta.
        </p>
      </div>
    </div>
  )
}

type Tone = 'primary' | 'sun' | 'lilac' | 'coral' | 'sky'
const TONE_CLASS: Record<Tone, string> = {
  primary: 'bg-accent text-accent-foreground',
  sun: 'bg-tone-sun-soft text-tone-sun',
  lilac: 'bg-tone-lilac-soft text-tone-lilac',
  coral: 'bg-tone-coral-soft text-tone-coral',
  sky: 'bg-tone-sky-soft text-tone-sky',
}

function EditorSection({ icon: Icon, tone, title, children }: {
  icon: LucideIcon
  tone: Tone
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${TONE_CLASS[tone]}`}>
          <Icon size={20} />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground/80">{label}</label>
        {value && <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-extrabold text-accent-foreground">{value}</span>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
}) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1" role="group">
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition-colors ${
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.icon && <o.icon size={16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleRow({ title, subtitle, checked, onChange, icon: Icon }: {
  title: string
  subtitle: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: LucideIcon
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3">
      {Icon && <Icon size={18} />}
      <div className="flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-foreground/20'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
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
      className="h-12 w-full rounded-2xl border border-border bg-muted px-4 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}

/** Miniatura ilustrativa de cada estilo, teñida con el color de marca elegido. */
function StyleThumb({ styleKey, color }: { styleKey: CardStyle; color: string }) {
  const dots = (on: string, off: string) => (
    <div className="mt-auto flex gap-1.5">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className="h-3.5 w-3.5 rounded-full" style={{ background: i < 2 ? on : off }} />
      ))}
    </div>
  )
  const base = 'relative flex h-[84px] flex-col overflow-hidden rounded-xl p-3'
  switch (styleKey) {
    case 'modern':
      return (
        <div className={base} style={{ background: `linear-gradient(135deg, #12161C, ${color}66)` }}>
          <span className="h-1.5 w-10 rounded-full bg-white/70" />
          {dots(color, 'rgba(255,255,255,0.18)')}
        </div>
      )
    case 'luxury':
      return (
        <div className={base} style={{ background: '#0B0B0B', boxShadow: 'inset 0 0 0 1px #C9A22755' }}>
          <span className="h-1.5 w-10 rounded-full" style={{ background: '#C9A227' }} />
          {dots('#C9A227', 'rgba(201,162,39,0.2)')}
        </div>
      )
    case 'editorial':
      return (
        <div className={base} style={{ background: '#F2ECE0' }}>
          <span className="h-1.5 w-10 rounded-full" style={{ background: color }} />
          <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card" />
          {dots(color, 'rgba(0,0,0,0.12)')}
        </div>
      )
    case 'minimal':
      return (
        <div className={`${base} border border-black/10`} style={{ background: '#FFFFFF' }}>
          <span className="h-1.5 w-10 rounded-full bg-black/70" />
          {dots(color, 'rgba(0,0,0,0.1)')}
        </div>
      )
    default:
      return (
        <div className={base} style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
          <span className="h-1.5 w-10 rounded-full bg-white/80" />
          {dots('#FFFFFF', 'rgba(255,255,255,0.3)')}
        </div>
      )
  }
}
