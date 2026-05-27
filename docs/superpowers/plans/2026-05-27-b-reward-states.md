# FideliTap v2 — B: Card Completion Reward States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the immediate stamp-reset on card completion with a two-step claim flow: merchant sees a celebration overlay, taps "Reclamar premio", and only then are stamps reset. The `customer_cards.status` column (added in Plan A1) drives the state machine.

**Architecture:** The `add_stamp` DB function (updated in Plan A1) now returns `status: 'ready_to_claim'` instead of resetting. A new `claimRewardAction` server action calls the `claim_reward` DB function to reset. The scanner client UI adds a full-screen celebration overlay when `isComplete: true`, with "Reclamar premio" and "Escanear otro" buttons.

**Tech Stack:** Next.js 14 Server Actions, React, Tailwind CSS, Supabase (service client)

**Prerequisite:** Plan A1 must be applied (needs `customer_cards.status` column and updated `add_stamp` + `claim_reward` DB functions).

---

## File Map

- Modify: `src/app/(dashboard)/scanner/actions.ts`
- Modify: `src/app/(dashboard)/scanner/scanner-client.tsx`

---

### Task 1: Update StampResult type and addStampAction

**Files:**
- Modify: `src/app/(dashboard)/scanner/actions.ts`

The current `add_stamp` DB function returns `{ current_stamps, is_complete, times_completed }`. After the Plan A1 migration it returns `{ current_stamps, is_complete, times_completed, status }`. The action must return `status` to the client so the UI knows whether to show the celebration overlay.

- [ ] **Step 1: Update `StampResult` type and `addStampAction`**

Replace the entire `actions.ts` file with:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendApnsPush } from '@/lib/wallet/apns'
import { updateGoogleWalletStamps } from '@/lib/wallet/google'
import { sendCardComplete } from '@/lib/email/send-card-complete'

export type CardStatus = 'active' | 'ready_to_claim' | 'claimed'

export type StampResult =
  | { error: string }
  | {
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
      status: CardStatus
    }

export type ClaimResult =
  | { error: string }
  | { timesCompleted: number; status: CardStatus }

export async function addStampAction(uniqueCode: string): Promise<StampResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const serviceClient = createServiceClient()

  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      loyalty_cards ( id, stamps_required, business_id ),
      customers ( name, email )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()

  if (!ccRaw) return { error: 'Código QR inválido' }

  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string; email: string | null } | null
  }

  const card = cc.loyalty_cards
  if (!card || card.business_id !== business.id) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  // Cooldown check
  if (business.stamp_cooldown_seconds > 0) {
    const { data: lastStamp } = await serviceClient
      .from('stamp_events')
      .select('created_at')
      .eq('customer_card_id', cc.id)
      .eq('type', 'stamp')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastStamp) {
      const secondsSinceLast = (Date.now() - new Date(lastStamp.created_at).getTime()) / 1000
      if (secondsSinceLast < business.stamp_cooldown_seconds) {
        const waitMinutes = Math.ceil((business.stamp_cooldown_seconds - secondsSinceLast) / 60)
        return { error: `Espera ${waitMinutes} min antes del próximo sello` }
      }
    }
  }

  const { data: stampResult, error: rpcError } = await serviceClient.rpc('add_stamp', {
    p_card_id: cc.id,
  })

  if (rpcError || !stampResult) return { error: 'Error al agregar sello' }

  const result = stampResult as {
    current_stamps?: number
    is_complete?: boolean
    times_completed?: number
    status?: string
  }

  if (
    result.current_stamps === undefined ||
    result.is_complete === undefined ||
    result.times_completed === undefined
  ) {
    return { error: 'Error al agregar sello' }
  }

  const currentStamps = result.current_stamps
  const isComplete = result.is_complete
  const timesCompleted = result.times_completed
  const status = (result.status ?? 'active') as CardStatus

  // Record stamp event
  await serviceClient.from('stamp_events').insert({
    customer_card_id: cc.id,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'stamp',
  })

  let pushTokens: string[] = []
  if (cc.wallet_pass_serial) {
    const { data: registrations } = await serviceClient
      .from('device_registrations')
      .select('push_token')
      .eq('serial_number', cc.wallet_pass_serial)
    pushTokens = registrations?.map((r) => r.push_token) ?? []
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const customerEmail = cc.customers?.email
  void Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
    isComplete && customerEmail
      ? sendCardComplete({
          to: customerEmail,
          customerName: cc.customers?.name ?? 'Cliente',
          businessName: business.name,
          appleWalletUrl: `${appUrl}/api/wallet/apple/${cc.id}`,
          googleWalletUrl: `${appUrl}/api/wallet/google/${cc.id}`,
        })
      : Promise.resolve(),
  ])

  return {
    customerName: cc.customers?.name ?? 'Cliente',
    currentStamps,
    stampsRequired: card.stamps_required,
    isComplete,
    timesCompleted,
    status,
  }
}

export async function claimRewardAction(customerCardId: string): Promise<ClaimResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const serviceClient = createServiceClient()

  // Verify the card belongs to this business
  const { data: cc } = await serviceClient
    .from('customer_cards')
    .select('id, loyalty_cards(business_id)')
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc) return { error: 'Tarjeta no encontrada' }

  const lcRaw = cc.loyalty_cards as unknown as { business_id: string } | null
  if (!lcRaw || lcRaw.business_id !== business.id) {
    return { error: 'No autorizado' }
  }

  const { data: claimResult, error: rpcError } = await serviceClient.rpc('claim_reward', {
    p_card_id: customerCardId,
  })

  if (rpcError || !claimResult) {
    return { error: 'Error al reclamar el premio' }
  }

  const result = claimResult as { times_completed?: number; status?: string }

  // Record reward_claimed event
  await serviceClient.from('stamp_events').insert({
    customer_card_id: customerCardId,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'reward_claimed',
  })

  return {
    timesCompleted: result.times_completed ?? 0,
    status: (result.status ?? 'active') as CardStatus,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/scanner/actions.ts
git commit -m "feat(scanner): update addStampAction for status; add claimRewardAction"
```

---

### Task 2: Update ScannerClient with celebration overlay

**Files:**
- Modify: `src/app/(dashboard)/scanner/scanner-client.tsx`

The current `scanner-client.tsx` shows a simple success card. Now it needs:
1. A `SuccessData` type that includes `status` field
2. When `isComplete: true` → show full-screen celebration overlay with "Reclamar premio" + "Escanear otro" buttons
3. "Reclamar premio" calls `claimRewardAction`, shows confirmation, then allows scanning again
4. "Escanear otro" skips claiming (doesn't reset stamps) and goes back to idle
5. Confetti animation (CSS-only keyframes)

- [ ] **Step 1: Read the current scanner-client.tsx fully first**

Read the file at `src/app/(dashboard)/scanner/scanner-client.tsx` to understand the current complete structure before modifying.

- [ ] **Step 2: Replace `scanner-client.tsx` with the updated version**

```typescript
'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ScanLine, Camera, CameraOff, CheckCircle2, AlertCircle, RefreshCw, Keyboard, Gift, ArrowRight } from 'lucide-react'
import { addStampAction, claimRewardAction, type StampResult, type ClaimResult } from './actions'

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'scanning' | 'success' | 'error'
type SuccessData = Exclude<StampResult, { error: string }>

const QR_ELEMENT_ID = 'qr-video-container'

// CSS-only confetti: renders 12 colored dots that animate outward
function Confetti() {
  const colors = ['#00C896', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const color = colors[i % colors.length]
        const angle = (i / 24) * 360
        const delay = (i * 0.05).toFixed(2)
        const distance = 80 + Math.random() * 60
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
  const [claimDone, setClaimDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [isPending, startTransition] = useTransition()
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        setCameraState('denied')
      } else {
        setErrorMsg('No se pudo iniciar la cámara')
        setCameraState('error')
      }
    }
  }, [processCode])

  const resetScanner = useCallback(() => {
    scannerRef.current?.stop().catch(() => {})
    scannerRef.current = null
    processedRef.current = false
    setSuccessData(null)
    setClaimDone(false)
    setErrorMsg('')
    setManualCode('')
    setShowManual(false)
    setCameraState('idle')
  }, [])

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {})
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  const handleClaim = () => {
    if (!successData) return
    // We need the customerCardId — but addStampAction returns the stamp result, not the card ID.
    // The card ID is embedded in the QR code (unique_code) but we only have successData here.
    // We store the customerCardId in successData: extend the SuccessData type.
    // NOTE: actions.ts must be updated to include customerCardId in StampResult.
    // For now we reference it as successData.customerCardId
    const ccId = (successData as SuccessData & { customerCardId?: string }).customerCardId
    if (!ccId) return

    startClaimTransition(async () => {
      const res: ClaimResult = await claimRewardAction(ccId)
      if ('error' in res) {
        setErrorMsg(res.error)
      } else {
        setClaimDone(true)
      }
    })
  }

  // ---- RENDER STATES ----

  if (cameraState === 'success' && successData) {
    if (successData.isComplete && !claimDone) {
      // Full-screen celebration overlay
      return (
        <div className="relative flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-6">
          <Confetti />
          <div className="text-6xl mb-2">🎉</div>
          <div>
            <h2 className="text-2xl font-black text-foreground mb-1">
              ¡Tarjeta completada!
            </h2>
            <p className="text-muted-foreground text-sm">
              {successData.customerName} tiene derecho a su premio
            </p>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-2xl px-6 py-4 w-full max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <Gift size={16} className="text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wide">Premio</span>
            </div>
            <p className="text-foreground font-semibold text-sm">
              {/* Prize description is on the loyalty_card, not returned here. 
                  Show a generic message. Plan C can add prizeDescription to StampResult if needed. */}
              Recompensa según la tarjeta de fidelización
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isClaiming ? 'Registrando...' : '✓ Reclamar premio'}
            </button>
            <button
              type="button"
              onClick={resetScanner}
              className="w-full border border-border text-muted-foreground font-medium py-3 rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight size={16} />
              Escanear otro
            </button>
          </div>
          {errorMsg && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 w-full max-w-xs">
              {errorMsg}
            </p>
          )}
        </div>
      )
    }

    if (successData.isComplete && claimDone) {
      // Prize confirmed
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground mb-1">Premio registrado ✓</h2>
            <p className="text-muted-foreground text-sm">
              Entrega el premio a {successData.customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={resetScanner}
            className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Escanear otro
          </button>
        </div>
      )
    }

    // Normal success (stamp added, not complete)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground mb-1">
            ¡Sello agregado!
          </h2>
          <p className="text-muted-foreground text-sm">
            {successData.customerName} — {successData.currentStamps} / {successData.stampsRequired} sellos
          </p>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: successData.stampsRequired }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < successData.currentStamps ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={resetScanner}
          className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
        >
          Escanear otro
        </button>
      </div>
    )
  }

  if (cameraState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-950/50 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <p className="text-foreground font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={resetScanner}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} /> Intentar de nuevo
        </button>
      </div>
    )
  }

  if (cameraState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <CameraOff size={32} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-foreground font-semibold">Permiso de cámara denegado</p>
          <p className="text-muted-foreground text-sm mt-1">
            Habilita el permiso en la configuración de tu navegador
          </p>
        </div>
        <ManualEntry onSubmit={processCode} isPending={isPending} />
      </div>
    )
  }

  // idle / requesting / active / scanning
  return (
    <div className="flex flex-col gap-6">
      {/* QR viewport container — html5-qrcode renders into this div */}
      <div className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden bg-black">
        <div id={QR_ELEMENT_ID} className="w-full h-full" />

        {/* Corner brackets shown when camera is active */}
        {(cameraState === 'active' || cameraState === 'scanning') && (
          <>
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
          </>
        )}

        {/* Idle state overlay */}
        {cameraState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card/80 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera size={32} className="text-primary" />
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="bg-primary text-primary-foreground font-bold py-2.5 px-6 rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              Activar cámara
            </button>
          </div>
        )}

        {/* Requesting permission */}
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Solicitando permiso...</p>
            </div>
          </div>
        )}

        {/* Scanning (processing) */}
        {cameraState === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Procesando...</p>
            </div>
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="flex flex-col items-center gap-2">
        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Keyboard size={13} /> Ingresar código manual
          </button>
        ) : (
          <ManualEntry onSubmit={processCode} isPending={isPending} />
        )}
      </div>
    </div>
  )
}

function ManualEntry({
  onSubmit,
  isPending,
}: {
  onSubmit: (code: string) => void
  isPending: boolean
}) {
  const [code, setCode] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) onSubmit(code.trim())
      }}
      className="flex gap-2 w-full max-w-xs"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Código del cliente"
        className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={isPending || !code.trim()}
        className="bg-primary text-primary-foreground font-bold py-2 px-3 rounded-lg text-sm disabled:opacity-50 transition-colors"
      >
        OK
      </button>
    </form>
  )
}
```

**Note:** The `handleClaim` function references `successData.customerCardId`. You must also update `StampResult` in `actions.ts` to include `customerCardId: string` in the success branch, and populate it in `addStampAction`. Specifically:

In `actions.ts`, add `customerCardId: string` to the non-error return of `StampResult`:
```typescript
export type StampResult =
  | { error: string }
  | {
      customerCardId: string  // ADD THIS
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
      status: CardStatus
    }
```

And in `addStampAction`, return `customerCardId: cc.id` in the final return object.

- [ ] **Step 3: Add confetti animation CSS to `src/app/globals.css`**

Open `src/app/globals.css` and add this at the very end:

```css
/* Confetti dot animation for reward celebration */
@keyframes confetti-fly {
  0%   { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
  80%  { opacity: 0.8; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0.5); opacity: 0; }
}

.confetti-dot {
  animation: confetti-fly 0.8s ease-out forwards;
}
```

- [ ] **Step 4: Update actions.ts to include customerCardId in StampResult**

In `src/app/(dashboard)/scanner/actions.ts`, make two edits:

**Edit 1** — Add `customerCardId: string` to the StampResult success union:
```typescript
export type StampResult =
  | { error: string }
  | {
      customerCardId: string
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
      status: CardStatus
    }
```

**Edit 2** — Add `customerCardId: cc.id` to the final return in `addStampAction`:
```typescript
  return {
    customerCardId: cc.id,
    customerName: cc.customers?.name ?? 'Cliente',
    currentStamps,
    stampsRequired: card.stamps_required,
    isComplete,
    timesCompleted,
    status,
  }
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in scanner files.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/scanner/scanner-client.tsx \
        src/app/(dashboard)/scanner/actions.ts \
        src/app/globals.css
git commit -m "feat(scanner): celebration overlay + claim reward flow"
```

---

### Task 3: Smoke-test the reward flow

- [ ] **Step 1: Start dev server**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npm run dev
```

- [ ] **Step 2: Manual test using a local test account**

1. Log in as a business owner
2. Open Scanner
3. Activate camera or use manual entry with a customer's unique code
4. Add stamps until the card is complete (stamps_required times)
5. Verify: celebration overlay appears with 🎉, confetti dots, "Reclamar premio" button
6. Tap "Reclamar premio" → verify "Premio registrado ✓" screen
7. Tap "Escanear otro" → verify back to idle/camera state
8. Re-scan same code → verify stamps reset to 0 (status = 'active' again)

- [ ] **Step 3: Verify DB state after claim**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT id, current_stamps, status, times_completed FROM customer_cards LIMIT 5;"
```

Expected: claimed card shows `current_stamps = 0`, `status = 'active'`, `times_completed` incremented.
