'use client'

import { useState, useTransition, useCallback } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { savePosterSettingsAction } from './actions'

interface Card {
  id: string
  slug: string
  name: string
  stamps_required: number
  poster_reward_text: string | null
}

interface Business {
  poster_bg_color: string
  poster_bg_image_url: string | null
}

interface PosterEditorProps {
  cards: Card[]
  business: Business
  defaultCardId: string
}

const input = 'w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors'

export function PosterEditor({ cards, business, defaultCardId }: PosterEditorProps) {
  const [cardId,      setCardId]      = useState(defaultCardId)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical')
  const [bgType,      setBgType]      = useState<'color' | 'photo'>(
    business.poster_bg_image_url ? 'photo' : 'color'
  )
  const [bgColor,     setBgColor]     = useState(business.poster_bg_color ?? '#0B0B0B')
  const [rewardText,  setRewardText]  = useState(
    cards.find(c => c.id === defaultCardId)?.poster_reward_text ?? ''
  )
  // Stable initial value so server and client render the same query string on first paint;
  // Date.now() is only used for later cache-busting refreshes (post-mount), never SSR.
  const [previewKey,     setPreviewKey]     = useState(0)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [saved,          setSaved]          = useState(false)
  const [saveError,      setSaveError]      = useState('')
  const [downloadError,  setDownloadError]  = useState('')
  const [isPending,      startTransition]   = useTransition()
  const [isDownloading,  setIsDownloading]  = useState(false)

  const previewUrl = `/api/poster/${cardId}?format=png&orientation=${orientation}&ts=${previewKey}`

  function handleCardChange(id: string) {
    setCardId(id)
    const c = cards.find(x => x.id === id)
    setRewardText(c?.poster_reward_text ?? '')
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false); setSaveError('')
    const fd = new FormData(e.currentTarget)
    fd.set('cardId', cardId)
    fd.set('bgType', bgType)
    fd.set('bgColor', bgColor)
    fd.set('rewardText', rewardText)

    startTransition(async () => {
      const res = await savePosterSettingsAction(fd)
      if (res.error) { setSaveError(res.error) }
      else { setSaved(true); setPreviewKey(Date.now()) }
    })
  }

  const handleDownload = useCallback(async (format: 'png' | 'pdf') => {
    setDownloadError(''); setIsDownloading(true)
    try {
      const res = await fetch(`/api/poster/${cardId}?format=${format}&orientation=${orientation}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setDownloadError(j.error ?? 'Error al descargar'); return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `plantilla-fidelitap.${format}`; a.click()
      URL.revokeObjectURL(url)
    } catch { setDownloadError('Error al descargar') }
    finally  { setIsDownloading(false) }
  }, [cardId, orientation])

  return (
    <div className="flex flex-col xl:flex-row gap-8">

      {/* ── LEFT: Editor ── */}
      <form onSubmit={handleSave} className="flex flex-col gap-5 w-full xl:w-80 shrink-0">

        {/* Card selector */}
        {cards.length > 1 && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block font-medium uppercase tracking-wide">Tarjeta</label>
            <select value={cardId} onChange={e => handleCardChange(e.target.value)} className={input}>
              {cards.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.stamps_required} sellos)</option>
              ))}
            </select>
          </div>
        )}

        {/* Orientation */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block font-medium uppercase tracking-wide">Orientación</label>
          <div className="flex gap-2">
            {(['vertical', 'horizontal'] as const).map(o => (
              <button key={o} type="button" onClick={() => setOrientation(o)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  orientation === o
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:border-foreground/30'
                }`}>
                {o === 'vertical' ? '↕ Vertical' : '↔ Horizontal'}
              </button>
            ))}
          </div>
        </div>

        {/* Reward text */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block font-medium uppercase tracking-wide">
            Premio al completar sellos
          </label>
          <textarea
            value={rewardText}
            onChange={e => setRewardText(e.target.value)}
            rows={3}
            maxLength={120}
            placeholder="Ej: Café gratis al completar tus 10 sellos"
            className={`${input} resize-none`}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{rewardText.length}/120</p>
        </div>

        {/* Background */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block font-medium uppercase tracking-wide">Fondo</label>
          <div className="flex gap-2 mb-3">
            {(['color', 'photo'] as const).map(t => (
              <button key={t} type="button" onClick={() => setBgType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  bgType === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:border-foreground/30'
                }`}>
                {t === 'color' ? '🎨 Color' : '🖼 Foto'}
              </button>
            ))}
          </div>

          {bgType === 'color' ? (
            <div className="flex items-center gap-3">
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent" />
              <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)}
                placeholder="#0B0B0B" className={`${input} w-32`} />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <input type="file" name="bgImage" accept="image/png,image/jpeg"
                className="text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-slate-700" />
              {business.poster_bg_image_url && (
                <p className="text-[10px] text-muted-foreground">Ya tienes foto guardada. Sube una nueva para reemplazarla.</p>
              )}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <button type="submit" disabled={isPending}
            className="w-full bg-primary text-primary-foreground font-bold text-sm rounded-xl py-3 hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {isPending ? 'Guardando...' : '💾 Guardar y actualizar vista previa'}
          </button>
          {saved     && <p className="text-primary text-xs text-center">✓ Ajustes guardados</p>}
          {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
        </div>

        {/* Download */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Guarda primero para actualizar la plantilla, luego descárgala.
          </p>
          <button type="button" disabled={isDownloading} onClick={() => handleDownload('png')}
            className="flex items-center justify-center gap-2 w-full bg-muted border border-primary text-primary font-bold text-sm rounded-xl py-3 hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors">
            <Download size={15} />
            {isDownloading ? 'Descargando...' : 'Descargar PNG'}
          </button>
          <button type="button" disabled={isDownloading} onClick={() => handleDownload('pdf')}
            className="flex items-center justify-center gap-2 w-full border border-border text-muted-foreground font-semibold text-sm rounded-xl py-2.5 hover:border-foreground/30 disabled:opacity-40 transition-colors">
            <Download size={14} />
            {isDownloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
          {downloadError && <p className="text-red-400 text-xs mt-1">{downloadError}</p>}
        </div>
      </form>

      {/* ── RIGHT: Live Preview ── */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Vista previa</p>
          <button type="button" onClick={() => setPreviewKey(Date.now())}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={11} />
            Actualizar
          </button>
        </div>

        <div className={`relative bg-card border border-border rounded-2xl overflow-hidden ${
          orientation === 'vertical' ? 'aspect-[794/1123]' : 'aspect-[1123/794]'
        }`}>
          {previewLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted-foreground">Generando plantilla...</p>
              </div>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={previewKey}
            src={previewUrl}
            alt="Vista previa de la plantilla"
            className="w-full h-full object-contain"
            // SSR can serve this <img> already loaded from cache before hydration attaches
            // onLoad, so the event never fires — check `complete` as soon as the node mounts.
            ref={(el) => { if (el?.complete) setPreviewLoading(false) }}
            onLoad={() => setPreviewLoading(false)}
            onError={() => setPreviewLoading(false)}
            style={{ display: previewLoading ? 'none' : 'block' }}
          />
        </div>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          La vista previa usa los ajustes guardados. Guarda primero para ver cambios.
        </p>
      </div>
    </div>
  )
}
