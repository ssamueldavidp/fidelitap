'use client'

import { useState, useTransition, useRef } from 'react'
import { savePosterSettingsAction } from './actions'

interface Card {
  id: string
  slug: string
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

export function PosterEditor({ cards, business, defaultCardId }: PosterEditorProps) {
  const [cardId, setCardId] = useState(defaultCardId)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical')
  const [bgType, setBgType] = useState<'color' | 'photo'>(
    business.poster_bg_image_url ? 'photo' : 'color'
  )
  const [bgColor, setBgColor] = useState(business.poster_bg_color)
  const [rewardText, setRewardText] = useState(
    cards.find((c) => c.id === defaultCardId)?.poster_reward_text ?? ''
  )
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleCardChange(id: string) {
    setCardId(id)
    const card = cards.find((c) => c.id === id)
    setRewardText(card?.poster_reward_text ?? '')
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setSaveError('')
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('cardId', cardId)
    formData.set('bgType', bgType)
    formData.set('bgColor', bgColor)
    formData.set('rewardText', rewardText)

    startTransition(async () => {
      const res = await savePosterSettingsAction(formData)
      if (res.error) {
        setSaveError(res.error)
      } else {
        setSaved(true)
      }
    })
  }

  async function handleDownload(format: 'png' | 'pdf') {
    setDownloadError('')
    setIsDownloading(true)
    try {
      const url = `/api/poster/${cardId}?format=${format}&orientation=${orientation}`
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setDownloadError(json.error ?? 'Error al descargar')
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `cartel.${format}`
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch {
      setDownloadError('Error al descargar')
    } finally {
      setIsDownloading(false)
    }
  }

  const inputClass =
    'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C896]'
  const btnClass =
    'bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00b386] disabled:opacity-40 transition-colors'

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-lg">
      {/* Card selector */}
      {cards.length > 1 && (
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Tarjeta</label>
          <select
            value={cardId}
            onChange={(e) => handleCardChange(e.target.value)}
            className={inputClass}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug} ({c.stamps_required} sellos)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Orientation */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Orientación</label>
        <div className="flex gap-2">
          {(['vertical', 'horizontal'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientation(o)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                orientation === o
                  ? 'bg-[#00C896] text-slate-900 border-[#00C896]'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {o === 'vertical' ? 'Vertical' : 'Horizontal'}
            </button>
          ))}
        </div>
      </div>

      {/* Reward text */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Texto de recompensa</label>
        <textarea
          value={rewardText}
          onChange={(e) => setRewardText(e.target.value)}
          rows={2}
          placeholder="Ej: Café gratis al completar tus 10 sellos"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Background */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Fondo</label>
        <div className="flex gap-2 mb-3">
          {(['color', 'photo'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBgType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                bgType === t
                  ? 'bg-[#00C896] text-slate-900 border-[#00C896]'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {t === 'color' ? 'Color' : 'Foto'}
            </button>
          ))}
        </div>

        {bgType === 'color' ? (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-slate-700 bg-transparent"
            />
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#0B0B0B"
              className={`${inputClass} w-36`}
            />
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              name="bgImage"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
            />
            {business.poster_bg_image_url && (
              <p className="text-xs text-slate-500 mt-1">Ya tienes una foto guardada. Sube una nueva para reemplazarla.</p>
            )}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className={`${btnClass} self-start`}>
          {isPending ? 'Guardando...' : 'Guardar ajustes'}
        </button>
        {saved && <p className="text-[#00C896] text-sm">✓ Ajustes guardados</p>}
        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
      </div>

      {/* Download */}
      <div>
        <p className="text-xs text-slate-400 mb-3">
          Guarda los ajustes antes de descargar. El cartel usa los datos guardados.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('png')}
            className="border border-[#00C896] text-[#00C896] font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00C896] hover:text-slate-900 disabled:opacity-40 transition-colors"
          >
            {isDownloading ? 'Descargando...' : 'Descargar PNG'}
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('pdf')}
            className="border border-slate-600 text-slate-300 font-bold text-sm rounded-lg px-4 py-2.5 hover:border-slate-400 disabled:opacity-40 transition-colors"
          >
            Descargar PDF
          </button>
        </div>
        {downloadError && <p className="text-red-400 text-sm mt-2">{downloadError}</p>}
      </div>
    </form>
  )
}
