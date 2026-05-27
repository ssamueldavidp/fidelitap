'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ScanLine, Camera, CameraOff, CheckCircle2, AlertCircle, RefreshCw, Keyboard } from 'lucide-react'
import { addStampAction, claimRewardAction, type StampResult, type ClaimResult } from './actions'

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'scanning' | 'success' | 'error'
type SuccessData = Exclude<StampResult, { error: string }>

const QR_ELEMENT_ID = 'qr-video-container'

function Confetti() {
  const colors = ['#00C896', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const color = colors[i % colors.length]
        const angle = (i / 24) * 360
        const delay = (i * 0.05).toFixed(2)
        const distance = 80 + (i % 3) * 20
        return (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full confetti-dot"
            style={{
              backgroundColor: color,
              '--angle': `${angle}deg`,
              '--distance': `${distance}px`,
              animationDelay: `${delay}s`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
  )
}

export function ScannerClient() {
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [claimDone, setClaimDone] = useState(false)
  const [isClaiming, startClaimTransition] = useTransition()

  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const processedRef = useRef(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processCode = useCallback((code: string) => {
    if (processedRef.current) return
    processedRef.current = true
    setCameraState('scanning')

    scannerRef.current?.stop().catch(() => {})

    startTransition(async () => {
      const res = await addStampAction(code)
      if ('error' in res) {
        setErrorMsg(res.error)
        setCameraState('error')
        errorTimerRef.current = setTimeout(() => {
          processedRef.current = false
          setCameraState('idle')
        }, 3500)
      } else {
        setSuccessData(res)
        setClaimDone(false)
        setCameraState('success')
      }
    })
  }, [startTransition])

  const startCamera = useCallback(async () => {
    setCameraState('requesting')
    processedRef.current = false

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(QR_ELEMENT_ID)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => processCode(decodedText),
        () => {}
      )
      setCameraState('active')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setCameraState('denied')
      } else {
        setErrorMsg('No se pudo acceder a la cámara')
        setCameraState('denied')
      }
    }
  }, [processCode])

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {})
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim()
    if (code) processCode(code)
  }

  function handleReset() {
    setSuccessData(null)
    setClaimDone(false)
    setManualCode('')
    processedRef.current = false
    setCameraState('idle')
  }

  function handleClaim() {
    if (!successData) return
    startClaimTransition(async () => {
      const res: ClaimResult = await claimRewardAction(successData.customerCardId)
      if (!('error' in res)) {
        setClaimDone(true)
      }
    })
  }

  // ─── SUCCESS ─────────────────────────────────────────────────────────────
  if (cameraState === 'success' && successData) {
    // Celebration overlay: card is complete and prize not yet claimed
    if (successData.isComplete && !claimDone) {
      return (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
          <div className="relative bg-card border border-primary/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg shadow-primary/10 overflow-hidden">
            <Confetti />
            <div className="relative z-10 w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-3xl">🎉</span>
            </div>
            <div className="relative z-10 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">¡Tarjeta completada!</p>
              <p className="text-2xl font-black text-foreground mt-1">{successData.customerName}</p>
              <p className="text-sm text-primary font-semibold mt-1">
                Completada {successData.timesCompleted} {successData.timesCompleted === 1 ? 'vez' : 'veces'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="relative z-10 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isClaiming ? 'Registrando...' : 'Reclamar premio'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="relative z-10 w-full flex items-center justify-center gap-2 bg-muted text-foreground font-semibold py-3 rounded-xl hover:bg-muted/80 transition-colors text-sm"
            >
              <RefreshCw size={16} />
              Escanear otro
            </button>
          </div>
        </div>
      )
    }

    // Prize claimed confirmation
    if (successData.isComplete && claimDone) {
      return (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
          <div className="bg-card border border-primary/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg shadow-primary/10">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-foreground">Premio registrado ✓</p>
              <p className="text-sm text-muted-foreground mt-1">{successData.customerName}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={16} />
              Escanear otro
            </button>
          </div>
        </div>
      )
    }

    // Normal stamp (card not yet complete)
    return (
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
        <div className="bg-card border border-primary/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg shadow-primary/10">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Sello agregado</p>
            <p className="text-2xl font-black text-foreground mt-1">{successData.customerName}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 w-full">
            {Array.from({ length: successData.stampsRequired }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < successData.currentStamps
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {i < successData.currentStamps ? '✓' : ''}
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {successData.currentStamps} / {successData.stampsRequired} sellos
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={16} />
            Escanear otro
          </button>
        </div>
      </div>
    )
  }

  // ─── DENIED ──────────────────────────────────────────────────────────────
  if (cameraState === 'denied') {
    return (
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <CameraOff size={28} className="text-destructive" />
          </div>
          <div>
            <p className="font-bold text-foreground">Permiso denegado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Activa el permiso de cámara en la configuración de tu navegador, luego recarga la página.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-muted text-foreground font-semibold py-3 rounded-xl hover:bg-muted/80 transition-colors"
          >
            Recargar página
          </button>
        </div>
        <ManualEntry
          manualCode={manualCode}
          setManualCode={setManualCode}
          onSubmit={handleManualSubmit}
          isPending={isPending}
        />
      </div>
    )
  }

  // ─── SCANNING / PROCESSING ────────────────────────────────────────────────
  if (cameraState === 'scanning') {
    return (
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center animate-pulse">
          <ScanLine size={28} className="text-primary" />
        </div>
        <p className="text-foreground font-semibold">Procesando código...</p>
      </div>
    )
  }

  // ─── ERROR ───────────────────────────────────────────────────────────────
  if (cameraState === 'error') {
    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle size={28} className="text-destructive" />
          </div>
          <div>
            <p className="font-bold text-foreground">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <p className="text-xs text-muted-foreground">Volviendo en un momento...</p>
        </div>
      </div>
    )
  }

  // ─── IDLE + ACTIVE ────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      <div className="relative bg-card border border-border rounded-2xl overflow-hidden aspect-square">
        <div id={QR_ELEMENT_ID} className="w-full h-full" />

        {(cameraState === 'idle' || cameraState === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-card">
            {cameraState === 'requesting' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Camera size={32} className="text-primary" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Solicitando permiso...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
                <div className="text-center px-6">
                  <p className="font-bold text-foreground">Escanear código QR</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Activa la cámara para escanear la tarjeta del cliente
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  <Camera size={18} />
                  Activar cámara
                </button>
              </>
            )}
          </div>
        )}

        {cameraState === 'active' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-48 h-48">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
              <div className="absolute inset-x-0 h-0.5 bg-primary/70 animate-bounce top-1/2 shadow-lg shadow-primary/50" />
            </div>
          </div>
        )}
      </div>

      {cameraState === 'active' && (
        <p className="text-center text-sm text-muted-foreground">
          Apunta al código QR de la tarjeta del cliente
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowManual(!showManual)}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Keyboard size={14} />
        {showManual ? 'Ocultar entrada manual' : 'Ingresar código manualmente'}
      </button>

      {showManual && (
        <ManualEntry
          manualCode={manualCode}
          setManualCode={setManualCode}
          onSubmit={handleManualSubmit}
          isPending={isPending}
        />
      )}
    </div>
  )
}

function ManualEntry({
  manualCode,
  setManualCode,
  onSubmit,
  isPending,
}: {
  manualCode: string
  setManualCode: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="text"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="Código del cliente"
        className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!manualCode.trim() || isPending}
        className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        Agregar
      </button>
    </form>
  )
}
