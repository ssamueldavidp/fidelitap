'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { addStampAction, type StampResult } from './actions'

type ScanState = 'idle' | 'scanning' | 'success' | 'error'

type SuccessData = Exclude<StampResult, { error: string }>

export function ScannerClient() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [isPending, startTransition] = useTransition()
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null)
  const processedRef = useRef(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScan = useCallback((code: string) => {
    setScanState('scanning')
    startTransition(async () => {
      const res = await addStampAction(code)
      if ('error' in res) {
        setErrorMsg(res.error)
        setScanState('error')
        errorTimerRef.current = setTimeout(() => setScanState('idle'), 3000)
      } else {
        setSuccessData(res)
        setScanState('success')
      }
    })
  }, [startTransition])

  useEffect(() => {
    if (scanState !== 'idle') return
    processedRef.current = false

    let mounted = true

    async function startCamera() {
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      if (!mounted) return

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 240, height: 240 } },
        false
      )

      scanner.render(
        (decodedText) => {
          if (!processedRef.current) {
            processedRef.current = true
            handleScan(decodedText)
          }
        },
        () => {}
      )

      scannerRef.current = scanner
    }

    startCamera()

    return () => {
      mounted = false
      scannerRef.current?.clear().catch(() => {})
      scannerRef.current = null
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }
  }, [scanState, handleScan])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim()
    if (code && scanState === 'idle') handleScan(code)
  }

  function handleReset() {
    setSuccessData(null)
    setManualCode('')
    setScanState('idle')
  }

  if (scanState === 'success' && successData) {
    return (
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="bg-slate-900 border border-[#00C896] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-[0_0_24px_rgba(0,200,150,0.15)]">
          <div className="w-12 h-12 rounded-full bg-[#00C896]/20 flex items-center justify-center">
            <span className="text-[#00C896] text-2xl">✓</span>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Sello agregado</p>
            <p className="text-xl font-black text-white mt-1">{successData.customerName}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: successData.stampsRequired }).map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs ${
                  i < successData.currentStamps
                    ? 'bg-[#00C896] border-[#00C896] text-slate-900'
                    : 'border-slate-600 text-slate-600'
                }`}
              >
                {i < successData.currentStamps ? '✓' : ''}
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-400">
            {successData.isComplete
              ? `🎉 ¡Tarjeta completada! (${successData.timesCompleted}ª vez)`
              : `${successData.currentStamps} / ${successData.stampsRequired} sellos`}
          </p>
        </div>

        <button
          onClick={handleReset}
          className="w-full bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] transition-colors"
        >
          Escanear otro cliente
        </button>
      </div>
    )
  }

  if (scanState === 'error') {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-red-950/40 border border-red-800 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">✗</p>
          <p className="text-red-400 font-semibold">{errorMsg}</p>
          <p className="text-xs text-slate-500 mt-2">Volviendo al scanner...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      <div className="relative">
        <div
          id="qr-reader"
          className="rounded-2xl overflow-hidden bg-slate-900"
          style={{ width: '100%' }}
        />
        {scanState === 'scanning' && (
          <div className="absolute inset-0 bg-slate-950/60 rounded-2xl flex items-center justify-center">
            <p className="text-[#00C896] font-semibold text-sm">Procesando...</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-2xl p-4">
        <p className="text-xs text-slate-400 mb-3">Ingresar código manualmente</p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Código del cliente"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#00C896]"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || scanState !== 'idle' || isPending}
            className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2 hover:bg-[#00b386] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            OK
          </button>
        </form>
      </div>
    </div>
  )
}
