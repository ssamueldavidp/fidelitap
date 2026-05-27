# FideliTap UI/UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire FideliTap platform visually: design system, dark/light mode, dashboard, QR scanner, wallet preview, and mobile responsiveness.

**Architecture:** Six independent subsystems executed in order. Each builds on the previous. The design token system (Subsystem 1) must go first as all others depend on it.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (darkMode: 'class'), next-themes (already installed), Radix UI primitives, lucide-react (already installed), Inter font.

**Brand:** Primary color `#00C896`, dark bg `slate-950`, accent on teal. CSS variables already set up in `globals.css` and `tailwind.config.ts`.

---

## Subsystem 1: Design System + Dark/Light Mode

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/ui/theme-toggle.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

### Task 1: Update CSS variables and add ThemeProvider

- [ ] **Step 1: Update globals.css with FideliTap design tokens**

Replace the `:root` and `.dark` blocks in `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light mode */
    --background: 210 20% 98%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 161 100% 39%;
    --primary-foreground: 0 0% 0%;
    --secondary: 210 20% 96%;
    --secondary-foreground: 222 47% 20%;
    --muted: 210 20% 94%;
    --muted-foreground: 215 16% 47%;
    --accent: 161 60% 94%;
    --accent-foreground: 161 80% 25%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 161 100% 39%;
    --radius: 0.75rem;
    --sidebar: 222 47% 11%;
    --sidebar-foreground: 210 20% 98%;
  }

  .dark {
    /* Dark mode — FideliTap default */
    --background: 222 47% 4%;
    --foreground: 210 20% 96%;
    --card: 222 47% 7%;
    --card-foreground: 210 20% 96%;
    --popover: 222 47% 7%;
    --popover-foreground: 210 20% 96%;
    --primary: 161 100% 39%;
    --primary-foreground: 0 0% 0%;
    --secondary: 217 33% 14%;
    --secondary-foreground: 210 20% 80%;
    --muted: 217 33% 14%;
    --muted-foreground: 215 20% 55%;
    --accent: 161 60% 10%;
    --accent-foreground: 161 80% 60%;
    --destructive: 0 63% 50%;
    --destructive-foreground: 210 20% 96%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 161 100% 39%;
    --sidebar: 222 47% 5%;
    --sidebar-foreground: 210 20% 90%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Update root layout to add ThemeProvider**

Overwrite `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FideliTap — Fidelización digital para tu negocio',
  description:
    'Crea tarjetas de sellos digitales para tu negocio. Tus clientes las guardan en Apple o Google Wallet.',
  keywords: ['fidelización', 'tarjetas de sellos', 'loyalty', 'negocio', 'Colombia'],
  authors: [{ name: 'FideliTap' }],
  openGraph: {
    title: 'FideliTap',
    description: 'Fidelización digital para tu negocio',
    type: 'website',
    locale: 'es_CO',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create ThemeToggle component**

Create `src/components/ui/theme-toggle.tsx`:

```tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-8 h-8" />

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Cambiar tema"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
```

- [ ] **Step 4: Verify the app still compiles**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing ones).

- [ ] **Step 5: Commit**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git add src/app/globals.css src/app/layout.tsx src/components/ui/theme-toggle.tsx
git commit -m "feat: design system tokens + dark/light ThemeProvider"
```

---

## Subsystem 2: Dashboard Layout Redesign (Sidebar + Header)

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/dashboard/sidebar-nav.tsx`
- Create: `src/components/dashboard/top-bar.tsx`
- Create: `src/components/dashboard/mobile-nav.tsx`

### Task 2: Redesign sidebar and add responsive mobile navigation

Context: Current sidebar uses emoji icons, no active state, no mobile support. `lucide-react` is installed. The layout must work on mobile (hamburger → drawer) and desktop (fixed sidebar).

- [ ] **Step 1: Create SidebarNav component**

Create `src/components/dashboard/sidebar-nav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CreditCard,
  Users,
  ScanLine,
  Image,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cards', label: 'Mis tarjetas', icon: CreditCard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/scanner', label: 'Escanear', icon: ScanLine },
  { href: '/poster', label: 'Plantilla', icon: Image },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 flex flex-col gap-0.5 px-3 py-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon size={16} className={isActive ? 'text-primary' : ''} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Create MobileNav component (hamburger + drawer)**

Create `src/components/dashboard/mobile-nav.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { SidebarNav } from './sidebar-nav'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { PlanUsage } from './plan-usage'

interface MobileNavProps {
  businessId: string
  plan: string
  businessName: string
}

export function MobileNav({ businessId, plan, businessName }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card">
        <Link href="/dashboard" className="text-lg font-black tracking-tight">
          fideli<span className="text-primary">tap</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-[hsl(var(--sidebar))] z-50 flex flex-col transform transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/30">
          <Link
            href="/dashboard"
            className="text-xl font-black tracking-tight text-[hsl(var(--sidebar-foreground))]"
            onClick={() => setOpen(false)}
          >
            fideli<span className="text-primary">tap</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>

        <div className="border-t border-border/30">
          <PlanUsage businessId={businessId} plan={plan} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create TopBar component**

Create `src/components/dashboard/top-bar.tsx`:

```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface TopBarProps {
  businessName: string
}

export function TopBar({ businessName }: TopBarProps) {
  return (
    <div className="hidden md:flex h-14 border-b border-border items-center justify-between px-6 shrink-0">
      <p className="text-sm text-muted-foreground font-medium">{businessName}</p>
      <ThemeToggle />
    </div>
  )
}
```

- [ ] **Step 4: Update PlanUsage for theme compatibility**

In `src/components/dashboard/plan-usage.tsx`, replace hardcoded slate/color classes:

- `bg-slate-800` → `bg-muted`
- `border-slate-700` → `border-border`
- `text-slate-500` → `text-muted-foreground`
- `text-white` → `text-foreground`
- `text-slate-400` → `text-muted-foreground`
- `bg-slate-700` → `bg-muted`
- Keep `bg-[#00C896]` and `text-slate-900` on the upgrade button (brand color)

- [ ] **Step 5: Rewrite dashboard layout**

Overwrite `src/app/(dashboard)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanUsage } from '@/components/dashboard/plan-usage'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileNav } from '@/components/dashboard/mobile-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar))]">
        <Link
          href="/dashboard"
          className="px-6 h-14 flex items-center text-xl font-black tracking-tight border-b border-border/30 text-[hsl(var(--sidebar-foreground))]"
        >
          fideli<span className="text-primary">tap</span>
        </Link>

        <SidebarNav />

        <div className="border-t border-border/30">
          <PlanUsage businessId={business.id} plan={business.plan} />
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav (includes hamburger) */}
        <MobileNav
          businessId={business.id}
          plan={business.plan}
          businessName={business.name}
        />
        {/* Desktop top bar */}
        <TopBar businessName={business.name} />
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/ src/app/(dashboard)/layout.tsx
git commit -m "feat: redesign dashboard sidebar with Lucide icons, active states, mobile drawer"
```

---

## Subsystem 3: Dashboard Page Visual Redesign

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

### Task 3: Premium metrics cards on dashboard

Context: Current dashboard shows 4 flat metric cards. Goal: Make them visually rich with icons, color accents, and better typography. This is a Server Component — no client interactivity needed.

- [ ] **Step 1: Rewrite dashboard/page.tsx**

Overwrite `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Users, Stamp, Gift, TrendingUp } from 'lucide-react'

const METRIC_CONFIG = [
  {
    key: 'activos' as const,
    label: 'Clientes activos',
    icon: Users,
    format: (v: number) => String(v),
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    description: 'Total acumulado',
  },
  {
    key: 'sellos_hoy' as const,
    label: 'Sellos hoy',
    icon: Stamp,
    format: (v: number) => String(v),
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Últimas 24 horas',
  },
  {
    key: 'canjes_totales' as const,
    label: 'Canjes totales',
    icon: Gift,
    format: (v: number) => String(v),
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    description: 'Premios entregados',
  },
  {
    key: 'retencion_pct' as const,
    label: 'Retención 30d',
    icon: TrendingUp,
    format: (v: number) => `${v}%`,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    description: 'Clientes recurrentes',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: metricsRaw } = await serviceClient.rpc('get_business_metrics', {
    p_business_id: business.id,
  })

  const m = metricsRaw as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    retencion_pct: number
  } | null

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-foreground">
          Hola, {business.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{today}</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, format, color, bg, description }) => {
          const value = m ? format(m[key]) : null
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <p className="text-3xl font-black text-foreground mt-0.5">
                  {value ?? '—'}
                </p>
                <p className="text-muted-foreground text-xs mt-1">{description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Acciones rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/scanner"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Escanear QR
          </a>
          <a
            href="/cards/nueva"
            className="inline-flex items-center gap-2 bg-muted text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-muted/80 transition-colors"
          >
            Nueva tarjeta
          </a>
          <a
            href="/customers"
            className="inline-flex items-center gap-2 bg-muted text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-muted/80 transition-colors"
          >
            Ver clientes
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: premium metrics cards with icons and quick actions on dashboard"
```

---

## Subsystem 4: QR Scanner Complete Redesign

**Files:**
- Modify: `src/app/(dashboard)/scanner/scanner-client.tsx`
- Modify: `src/app/(dashboard)/scanner/page.tsx`

### Task 4: QR Scanner with clear camera permission states

Context: `html5-qrcode` is used. Currently it auto-starts on idle state with no "activate camera" button visible. Use `Html5Qrcode` (low-level API, not `Html5QrcodeScanner`) for full UI control. Show explicit states: idle→requesting→active/denied. Android Chrome requires user gesture to start camera.

- [ ] **Step 1: Rewrite scanner-client.tsx**

Overwrite `src/app/(dashboard)/scanner/scanner-client.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ScanLine, Camera, CameraOff, CheckCircle2, AlertCircle, RefreshCw, Keyboard } from 'lucide-react'
import { addStampAction, type StampResult } from './actions'

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'scanning' | 'success' | 'error'
type SuccessData = Exclude<StampResult, { error: string }>

const QR_ELEMENT_ID = 'qr-video-container'

export function ScannerClient() {
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [isPending, startTransition] = useTransition()

  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const processedRef = useRef(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processCode = useCallback((code: string) => {
    if (processedRef.current) return
    processedRef.current = true
    setCameraState('scanning')

    // Stop camera
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

  // Stop camera on unmount
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
    setManualCode('')
    processedRef.current = false
    setCameraState('idle')
  }

  // ─── SUCCESS ─────────────────────────────────────────────────────────────
  if (cameraState === 'success' && successData) {
    return (
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
        <div className="bg-card border border-primary/30 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg shadow-primary/10">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Sello agregado</p>
            <p className="text-2xl font-black text-foreground mt-1">{successData.customerName}</p>
            {successData.isComplete && (
              <p className="text-sm text-primary font-semibold mt-1">
                🎉 ¡Tarjeta completada! (#{successData.timesCompleted})
              </p>
            )}
          </div>

          {/* Stamp progress */}
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
      <div className="w-full max-w-sm mx-auto">
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
      {/* Camera viewfinder area */}
      <div className="relative bg-card border border-border rounded-2xl overflow-hidden aspect-square">
        {/* Hidden video container (html5-qrcode mounts here) */}
        <div id={QR_ELEMENT_ID} className="w-full h-full" />

        {/* Idle overlay — shown until camera is active */}
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

        {/* Active scanning frame overlay */}
        {cameraState === 'active' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Corner markers */}
            <div className="relative w-48 h-48">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
              {/* Scan line animation */}
              <div className="absolute inset-x-0 h-0.5 bg-primary/70 animate-bounce top-1/2 shadow-lg shadow-primary/50" />
            </div>
          </div>
        )}
      </div>

      {/* Active state: stop button */}
      {cameraState === 'active' && (
        <p className="text-center text-sm text-muted-foreground">
          Apunta al código QR de la tarjeta del cliente
        </p>
      )}

      {/* Manual entry toggle */}
      <button
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
```

- [ ] **Step 2: Update scanner page to remove inline header (now in layout)**

Overwrite `src/app/(dashboard)/scanner/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScannerClient } from './scanner-client'

export default async function ScannerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Escanear código QR</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Activa la cámara y escanea la tarjeta del cliente para agregar un sello.
        </p>
      </div>
      <ScannerClient />
    </div>
  )
}
```

- [ ] **Step 3: Verify the scanner still has access to `addStampAction`**

Check that `src/app/(dashboard)/scanner/actions.ts` still exists and exports `addStampAction` and `StampResult`.

```bash
grep -n "export" /Users/samuelrodriguez/development/fidelitap/src/app/\(dashboard\)/scanner/actions.ts | head -5
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/scanner/
git commit -m "feat: QR scanner redesign — explicit camera states, Activar cámara button, scan overlay"
```

---

## Subsystem 5: Wallet Card Preview Redesign

**Files:**
- Modify: `src/components/cards/wallet-preview.tsx`

### Task 5: Premium wallet card preview component

Context: `WalletPreview` is shown in the card editor and cards grid. Make it look like a real physical loyalty card — premium, gradient background, proper stamp visualization.

- [ ] **Step 1: Rewrite wallet-preview.tsx**

Overwrite `src/components/cards/wallet-preview.tsx`:

```tsx
import React from 'react'

interface WalletPreviewProps {
  businessName: string
  name: string
  benefitDescription: string
  stampsRequired: number
  stampIcon: string
  color: string
  bgType: 'solid' | 'image'
  bgImageUrl?: string | null
  filledStamps?: number
  size?: 'sm' | 'md'
}

export function WalletPreview({
  businessName,
  name,
  benefitDescription,
  stampsRequired,
  stampIcon,
  color,
  bgType,
  bgImageUrl,
  filledStamps = 3,
  size = 'md',
}: WalletPreviewProps) {
  const isSm = size === 'sm'
  const filled = Math.min(filledStamps, stampsRequired)
  const pct = stampsRequired > 0 ? (filled / stampsRequired) * 100 : 0

  const cardStyle: React.CSSProperties =
    bgType === 'image' && bgImageUrl
      ? {
          backgroundImage: `linear-gradient(145deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          background: `linear-gradient(145deg, #0d1117 0%, #0f172a 50%, color-mix(in srgb, ${color} 12%, #0f172a) 100%)`,
        }

  return (
    <div
      className={`relative overflow-hidden ${isSm ? 'rounded-xl p-3' : 'rounded-2xl p-5'}`}
      style={{
        ...cardStyle,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}30, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* Subtle shine line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />

      {/* Header */}
      <div className={`flex items-start justify-between ${isSm ? 'mb-2' : 'mb-4'}`}>
        <div className="min-w-0">
          <p className={`text-white/50 font-medium truncate ${isSm ? 'text-[9px]' : 'text-[11px]'}`}>
            {businessName}
          </p>
          <p className={`font-black text-white truncate leading-tight ${isSm ? 'text-sm mt-0.5' : 'text-xl mt-0.5'}`}>
            {stampIcon} {name || 'Nombre de la tarjeta'}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-full flex items-center justify-center font-bold text-white ${
            isSm ? 'w-6 h-6 text-[9px] ml-1' : 'w-9 h-9 text-xs ml-2'
          }`}
          style={{ background: color }}
        >
          {filled}/{stampsRequired}
        </div>
      </div>

      {/* Stamps */}
      <div className={`${isSm ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex flex-wrap ${isSm ? 'gap-1' : 'gap-1.5'}`}>
          {Array.from({ length: stampsRequired }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full flex items-center justify-center font-bold transition-all ${
                isSm ? 'w-5 h-5 text-[8px]' : 'w-8 h-8 text-sm'
              }`}
              style={
                i < filled
                  ? { background: color, boxShadow: `0 0 8px ${color}60` }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }
              }
            >
              {i < filled ? (isSm ? '·' : stampIcon) : ''}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {!isSm && (
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        )}
      </div>

      {/* Benefit */}
      <div
        className={`rounded-xl ${isSm ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className={`text-white/40 uppercase tracking-widest ${isSm ? 'text-[7px] mb-0.5' : 'text-[9px] mb-1'}`}>
          Premio
        </p>
        <p className={`text-white font-semibold truncate ${isSm ? 'text-[9px]' : 'text-xs'}`}>
          🎁 {benefitDescription || 'Premio al completar'}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/wallet-preview.tsx
git commit -m "feat: premium wallet card preview with gradient, glow stamps, progress bar"
```

---

## Subsystem 6: Auth Pages Theme Compatibility

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

### Task 6: Make auth pages respect dark/light mode

Context: Auth pages likely have hardcoded dark colors. They need to use CSS variables so they look correct in both modes.

- [ ] **Step 1: Read current auth page files**

```bash
cat /Users/samuelrodriguez/development/fidelitap/src/app/\(auth\)/login/page.tsx
```

```bash
cat /Users/samuelrodriguez/development/fidelitap/src/app/\(auth\)/register/page.tsx
```

- [ ] **Step 2: Replace hardcoded slate colors with CSS variable equivalents**

For both pages, make these replacements:
- `bg-slate-950` or `bg-[#020617]` → `bg-background`
- `bg-slate-900` → `bg-card`
- `border-slate-800` → `border-border`
- `text-slate-100` or `text-white` (body text) → `text-foreground`
- `text-slate-400` or `text-slate-500` → `text-muted-foreground`
- `bg-slate-800` (inputs) → `bg-muted`
- Keep `text-[#00C896]` and `bg-[#00C896]` (brand accent, always teal)

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/
git commit -m "feat: auth pages use CSS variables for dark/light mode compatibility"
```

---

## Final: Push to GitHub

- [ ] **Push all commits**

```bash
cd /Users/samuelrodriguez/development/fidelitap && git push origin master
```

Expected: All 6 commits pushed successfully.
