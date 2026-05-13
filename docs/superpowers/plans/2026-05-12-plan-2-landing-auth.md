# FideliTap Plan 2: Landing Page + Autenticación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la landing page aprobada (tema claro, responsive) y el flujo completo de auth para negocios: registro con nombre de negocio, login con rate limiting, OAuth callback y shell del dashboard.

**Architecture:** Landing page en Server Components (estático, cero JS innecesario). Auth via Server Actions de Next.js 14 — CSRF protegido por el framework, sin API routes. Sesiones en httpOnly cookies manejadas por Supabase SSR. Rate limiting en login con Upstash Redis (ya construido en Plan 1). Ningún token ni secret llega al cliente.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase SSR, `useFormState`/`useFormStatus` (React 18)

---

## Notas de seguridad (leer antes de implementar)

- **Server Actions únicamente para auth** — no crear API routes para login/register. Las Server Actions usan POST + verificación interna de Next.js, son CSRF-safe.
- **Nunca pasar tokens al cliente** — `createClient()` del `server.ts` y `createAdminClient()` solo se usan en archivos con `'use server'` o en Route Handlers.
- **Error genérico en login** — no revelar si el email existe o no. Siempre: "Email o contraseña incorrectos."
- **Admin client solo en register** — se usa para crear el registro `businesses` porque en ese momento puede no haber sesión todavía (si email confirmation está habilitado). Es server-only.
- **Rate limiting en login** — usar `loginRateLimit` de `src/lib/rate-limit.ts` por IP antes de llamar a Supabase.
- **Zod antes de Supabase** — validar siempre con Zod antes de cualquier llamada a la DB.

---

## Estructura de archivos que este plan crea

```
src/
  app/
    page.tsx                          # Landing page (ensambla componentes)
    (auth)/
      layout.tsx                      # Layout centrado dark para login/register
      login/
        page.tsx                      # Formulario login (Client Component)
        actions.ts                    # Server Action login + rate limit
      register/
        page.tsx                      # Formulario registro (Client Component)
        actions.ts                    # Server Action registro (crea user + business)
    auth/
      callback/
        route.ts                      # OAuth code exchange (GET)
      logout/
        route.ts                      # Logout (POST → signOut → redirect /)
    (dashboard)/
      layout.tsx                      # Shell con sidebar (placeholder para Plan 3)
      dashboard/
        page.tsx                      # Dashboard placeholder
      onboarding/
        page.tsx                      # Nombre de negocio (para usuarios OAuth)
        actions.ts                    # Crea registro businesses para OAuth users
  components/
    landing/
      navbar.tsx                      # Barra de navegación sticky (Server Component)
      hero.tsx                        # Hero + features strip (Server Component)
      how-it-works.tsx                # 3 pasos + iPhone mockup (Client Component)
      cta-section.tsx                 # CTA final + footer (Server Component)
    wallet-card-mockup.tsx            # iPhone con tarjeta Wallet (Client Component)
```

---

## Task 1: Branch y componentes shadcn adicionales

**Files:**
- No se crean archivos — solo comandos

- [ ] **Step 1: Crear branch de desarrollo**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git checkout master
git checkout -b feat/plan-2-landing-auth
```

- [ ] **Step 2: Agregar componente Separator de shadcn**

```bash
pnpm dlx shadcn@latest add separator
```

- [ ] **Step 3: Verificar build limpio**

```bash
pnpm build
```

Esperado: build exitoso, sin errores.

- [ ] **Step 4: Commit inicial**

```bash
git add -A
git commit -m "chore: branch setup and add Separator component"
```

---

## Task 2: Navbar de la landing page

**Files:**
- Create: `src/components/landing/navbar.tsx`

- [ ] **Step 1: Crear el componente Navbar**

```tsx
// src/components/landing/navbar.tsx
import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="text-xl font-black tracking-tight shrink-0">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        {/* Links — ocultos en mobile */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <Link href="#como-funciona" className="hover:text-slate-900 transition-colors">
            Cómo funciona
          </Link>
          <Link href="#precios" className="hover:text-slate-900 transition-colors">
            Precios
          </Link>
          <Link href="/register" className="hover:text-slate-900 transition-colors">
            Negocios
          </Link>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-sm font-bold bg-slate-900 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            Empezar gratis →
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript no tiene errores**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -10
```

Esperado: sin líneas de error.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/navbar.tsx
git commit -m "feat: add landing navbar with responsive CTAs"
```

---

## Task 3: Hero section + Features strip

**Files:**
- Create: `src/components/landing/hero.tsx`

- [ ] **Step 1: Crear el componente Hero**

```tsx
// src/components/landing/hero.tsx
import Link from 'next/link'

const FEATURES = [
  { icon: '🎨', title: 'Diseño propio', desc: 'Colores, fondos e íconos' },
  { icon: '📱', title: 'Apple & Google Wallet', desc: 'Sin apps adicionales' },
  { icon: '📷', title: 'Escaneo QR', desc: 'Sello instantáneo' },
  { icon: '🔐', title: 'Anti-fraude', desc: 'Código único por tarjeta' },
]

export function Hero() {
  return (
    <section className="bg-white pt-20 pb-0">
      {/* Badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#00C896] bg-[#00C896]/8 border border-[#00C896]/20 rounded-full px-4 py-1.5 tracking-wide uppercase">
          ✦ Fidelización digital
        </span>
      </div>

      {/* Headline */}
      <h1 className="text-center text-4xl sm:text-5xl md:text-[56px] font-black text-slate-900 leading-tight tracking-tight max-w-3xl mx-auto px-6">
        Haz que tus clientes<br className="hidden sm:block" /> siempre regresen
      </h1>

      {/* Subtítulo */}
      <p className="text-center text-slate-500 text-base sm:text-lg mt-5 max-w-xl mx-auto px-6 leading-relaxed">
        Crea tarjetas de sellos digitales en minutos. Tus clientes las guardan en Apple Wallet o Google Wallet y vuelven por su premio.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 px-6">
        <Link
          href="/register"
          className="w-full sm:w-auto text-center font-bold bg-slate-900 text-white rounded-xl px-7 py-3.5 text-[15px] hover:bg-slate-700 transition-colors"
        >
          Crear mi tarjeta gratis →
        </Link>
        <Link
          href="#como-funciona"
          className="w-full sm:w-auto text-center font-semibold text-slate-600 border-2 border-slate-200 bg-white rounded-xl px-7 py-3.5 text-[15px] hover:border-slate-300 transition-colors"
        >
          Ver cómo funciona
        </Link>
      </div>

      {/* Features strip */}
      <div className="mt-16 max-w-3xl mx-auto mx-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`py-5 px-3 text-center ${
                i < FEATURES.length - 1 ? 'border-r border-slate-100 last:border-r-0' : ''
              } ${i >= 2 ? 'border-t border-slate-100 sm:border-t-0' : ''}`}
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-xs font-bold text-slate-800 mb-0.5">{f.title}</div>
              <div className="text-[11px] text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/hero.tsx
git commit -m "feat: add landing hero section with features strip"
```

---

## Task 4: WalletCard mockup + sección "Cómo funciona"

**Files:**
- Create: `src/components/wallet-card-mockup.tsx`
- Create: `src/components/landing/how-it-works.tsx`

- [ ] **Step 1: Crear el iPhone/Wallet mockup reutilizable**

```tsx
// src/components/wallet-card-mockup.tsx
'use client'

interface WalletCardMockupProps {
  mode: 'wallet' | 'scan' | 'success'
}

export function WalletCardMockup({ mode }: WalletCardMockupProps) {
  return (
    <div className="relative w-[248px] bg-[#1a1a1a] rounded-[44px] p-2.5 shadow-2xl ring-1 ring-white/10 mx-auto">
      {/* Inner screen */}
      <div className="bg-black rounded-[38px] overflow-hidden relative">
        {/* Status bar */}
        <div className="relative bg-black px-5 pt-3 pb-1 flex items-center justify-between">
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[90px] h-7 bg-black rounded-[20px] z-20"
            aria-hidden
          />
          <span className="text-white text-[11px] font-semibold z-10">9:41</span>
          <div className="flex items-center gap-1 z-10">
            {/* Signal bars */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
              <rect x="0" y="6" width="3" height="6" rx="0.5"/>
              <rect x="4.5" y="4" width="3" height="8" rx="0.5"/>
              <rect x="9" y="2" width="3" height="10" rx="0.5"/>
              <rect x="13.5" y="0" width="2.5" height="12" rx="0.5"/>
            </svg>
            {/* Battery */}
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <rect x="0" y="1" width="20" height="10" rx="2.5" stroke="white" strokeWidth="1"/>
              <rect x="1" y="2" width="16" height="8" rx="1.5" fill="white"/>
              <path d="M21 4v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Screen content */}
        <div className="min-h-[420px]">
          {mode === 'wallet' && <WalletScreen />}
          {mode === 'scan' && <ScanScreen />}
          {mode === 'success' && <SuccessScreen />}
        </div>
      </div>
    </div>
  )
}

function WalletScreen() {
  return (
    <div className="bg-[#f2f2f7] min-h-[420px] p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-black text-base">Wallet</span>
        <span className="text-[#007AFF] text-sm font-medium">+ Agregar</span>
      </div>
      {/* Main card */}
      <div className="rounded-2xl overflow-hidden shadow-lg mb-2" style={{ background: 'linear-gradient(145deg, #0f172a, #1a2e4a)' }}>
        <div className="p-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-base">☕</div>
              <div>
                <div className="text-white text-[13px] font-bold">Café Luna</div>
                <div className="text-white/50 text-[10px]">Tarjeta de sellos</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-[11px] font-bold">3 / 5</div>
              <div className="text-white/40 text-[9px]">sellos</div>
            </div>
          </div>
          <div className="flex gap-1.5 mb-2.5">
            {['on','on','on','off','off'].map((s, i) => (
              <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${s === 'on' ? 'bg-[#00C896]' : 'bg-white/10 border border-white/20'}`}>
                {s === 'on' ? '☕' : ''}
              </div>
            ))}
          </div>
          <div className="bg-black/20 rounded-xl p-2.5 text-[11px]">
            <div className="text-white/40 text-[9px] uppercase tracking-wide mb-0.5">Premio</div>
            <div className="text-white font-semibold">🎁 1 café gratis al completar</div>
          </div>
        </div>
        <div className="bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-white/80 font-mono text-[10px] font-bold tracking-wider">FDL-A2X9-K7M3</div>
            <div className="text-white/30 text-[9px] mt-0.5">FIDELITAP</div>
          </div>
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 21 21">
              <rect x="0" y="0" width="7" height="7" rx="1" fill="#0f172a"/><rect x="1" y="1" width="5" height="5" rx="0.3" fill="white"/><rect x="2" y="2" width="3" height="3" fill="#0f172a"/>
              <rect x="14" y="0" width="7" height="7" rx="1" fill="#0f172a"/><rect x="15" y="1" width="5" height="5" rx="0.3" fill="white"/><rect x="16" y="2" width="3" height="3" fill="#0f172a"/>
              <rect x="0" y="14" width="7" height="7" rx="1" fill="#0f172a"/><rect x="1" y="15" width="5" height="5" rx="0.3" fill="white"/><rect x="2" y="16" width="3" height="3" fill="#0f172a"/>
              <rect x="9" y="0" width="2" height="2" fill="#0f172a"/><rect x="9" y="3" width="2" height="2" fill="#0f172a"/>
              <rect x="9" y="9" width="2" height="2" fill="#0f172a"/><rect x="12" y="9" width="2" height="2" fill="#0f172a"/>
              <rect x="14" y="9" width="2" height="4" fill="#0f172a"/><rect x="17" y="9" width="4" height="2" fill="#0f172a"/>
            </svg>
          </div>
        </div>
      </div>
      {/* Peeking cards */}
      {[{ icon: '💇', name: 'Studio Hair', stamps: '2/5' }, { icon: '🍕', name: 'Don Pizzas', stamps: '3/5' }].map(c => (
        <div key={c.name} className="rounded-xl bg-slate-700/60 px-3 py-2 flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{c.icon}</span>
            <div>
              <div className="text-white text-[12px] font-semibold">{c.name}</div>
              <div className="text-white/40 text-[10px]">{c.stamps} sellos</div>
            </div>
          </div>
          <span className="text-white/30 text-sm">›</span>
        </div>
      ))}
    </div>
  )
}

function ScanScreen() {
  return (
    <div className="bg-black min-h-[420px] flex flex-col items-center justify-center gap-4 p-5">
      <div className="text-center">
        <div className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Café Luna</div>
        <div className="text-white text-[15px] font-bold">Mi tarjeta de sellos</div>
      </div>
      <div className="relative w-[140px] h-[140px] border border-white/10 rounded-xl flex items-center justify-center">
        <div className="absolute top-[-2px] left-[-2px] w-5 h-5 border-t-[3px] border-l-[3px] border-[#00C896] rounded-tl" />
        <div className="absolute top-[-2px] right-[-2px] w-5 h-5 border-t-[3px] border-r-[3px] border-[#00C896] rounded-tr" />
        <div className="absolute bottom-[-2px] left-[-2px] w-5 h-5 border-b-[3px] border-l-[3px] border-[#00C896] rounded-bl" />
        <div className="absolute bottom-[-2px] right-[-2px] w-5 h-5 border-b-[3px] border-r-[3px] border-[#00C896] rounded-br" />
        <svg width="80" height="80" viewBox="0 0 21 21">
          <rect x="0" y="0" width="7" height="7" rx="1" fill="white"/><rect x="1" y="1" width="5" height="5" rx="0.3" fill="#000"/><rect x="2" y="2" width="3" height="3" fill="white"/>
          <rect x="14" y="0" width="7" height="7" rx="1" fill="white"/><rect x="15" y="1" width="5" height="5" rx="0.3" fill="#000"/><rect x="16" y="2" width="3" height="3" fill="white"/>
          <rect x="0" y="14" width="7" height="7" rx="1" fill="white"/><rect x="1" y="15" width="5" height="5" rx="0.3" fill="#000"/><rect x="2" y="16" width="3" height="3" fill="white"/>
          <rect x="9" y="9" width="5" height="2" fill="white"/><rect x="15" y="9" width="6" height="2" fill="white"/>
          <rect x="9" y="12" width="3" height="4" fill="white"/><rect x="13" y="14" width="8" height="7" fill="white"/>
        </svg>
      </div>
      <div className="bg-white/5 rounded-xl px-5 py-2 text-center">
        <div className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Código único</div>
        <div className="text-white font-mono text-[13px] font-bold tracking-widest">FDL-A2X9-K7M3</div>
      </div>
      <div className="text-white/25 text-[10px] text-center leading-relaxed">
        Muestra este QR al negocio<br />para recibir tu sello de visita
      </div>
    </div>
  )
}

function SuccessScreen() {
  return (
    <div className="bg-[#111] min-h-[420px] flex flex-col items-center justify-center gap-4 p-5">
      <div className="w-16 h-16 bg-[#00C896] rounded-full flex items-center justify-center text-3xl shadow-[0_0_0_12px_rgba(0,200,150,0.12)]">
        ✓
      </div>
      <div className="text-white text-[18px] font-black tracking-tight">¡Sello registrado!</div>
      <div className="bg-white/5 rounded-xl p-4 w-full text-center">
        <div className="text-white/30 text-[10px] tracking-widest uppercase mb-3">CAFÉ LUNA · MARÍA GONZÁLEZ</div>
        <div className="flex gap-1.5 justify-center mb-3">
          {[true, true, true, true, false].map((filled, i) => (
            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${filled ? (i === 3 ? 'bg-[#00C896] shadow-[0_0_12px_rgba(0,200,150,0.7)]' : 'bg-[#00C896]') : 'bg-white/10'}`}>
              {filled ? '☕' : ''}
            </div>
          ))}
        </div>
        <div className="text-[#00C896] text-[15px] font-black">4 / 5 sellos</div>
        <div className="text-white/30 text-[11px] mt-1">¡Un sello más y ganas tu café gratis! 🎉</div>
      </div>
      <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
        <span className="text-[#00C896]">✓</span>
        Wallet actualizada automáticamente
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear el componente HowItWorks**

```tsx
// src/components/landing/how-it-works.tsx
'use client'
import { useState } from 'react'
import { WalletCardMockup } from '@/components/wallet-card-mockup'

const STEPS = [
  {
    mode: 'wallet' as const,
    num: 'Paso 1 — Para el negocio',
    icon: '🎨',
    title: 'Crea y personaliza tu tarjeta de sellos',
    desc: 'Diseña tu tarjeta en minutos: elige colores, el ícono de cada sello, cuántas visitas necesita el cliente y qué beneficio recibe al completarla. Preview en tiempo real mientras editas.',
    chips: ['🎨 Editor visual', '⚡ Lista en 5 min', '👁 Preview live'],
  },
  {
    mode: 'scan' as const,
    num: 'Paso 2 — Para el cliente',
    icon: '📱',
    title: 'Activa su tarjeta y la guarda en Wallet',
    desc: 'El cliente escanea el cartel del negocio, se registra en segundos con su email y con un solo tap agrega la tarjeta a Apple Wallet o Google Wallet. Sin descargar ninguna app.',
    chips: ['🍎 Apple Wallet', '🤖 Google Wallet', '⚡ Sin apps extra'],
  },
  {
    mode: 'success' as const,
    num: 'Paso 3 — Cada visita',
    icon: '🎁',
    title: 'El cliente gana un sello y acumula su premio',
    desc: 'El cliente muestra el QR de su tarjeta. El negocio lo escanea desde su panel y el sello aparece al instante en la Wallet. Al completar la tarjeta, recibe automáticamente su beneficio.',
    chips: ['📷 Escaneo QR', '⚡ Actualización live', '🎁 Premio automático'],
  },
]

export function HowItWorks() {
  const [active, setActive] = useState(0)

  return (
    <section id="como-funciona" className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-[11px] font-bold text-[#00C896] tracking-[2px] uppercase mb-2">
          Así funciona
        </p>
        <h2 className="text-center text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          ¿Cómo funciona nuestra plataforma?
        </h2>
        <p className="text-center text-slate-500 text-sm mb-14">
          Simple para el negocio, mágico para el cliente
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Steps */}
          <div className="flex flex-col gap-2">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`text-left flex items-start gap-4 p-4 rounded-2xl border-[1.5px] transition-all duration-200 ${
                  active === i
                    ? 'bg-white border-[#00C896]/40 shadow-md'
                    : 'bg-white/60 border-transparent hover:bg-white/80'
                }`}
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${
                  active === i ? 'bg-[#00C896]/10' : 'bg-slate-100'
                }`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${active === i ? 'text-[#00C896]' : 'text-slate-400'}`}>
                    {step.num}
                  </div>
                  <div className={`text-[15px] font-bold leading-snug mb-2 ${active === i ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.title}
                  </div>
                  {active === i && (
                    <>
                      <p className="text-[12.5px] text-slate-500 leading-relaxed mb-2">{step.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {step.chips.map(chip => (
                          <span key={chip} className="text-[11px] bg-slate-100 text-slate-600 font-semibold rounded-full px-2.5 py-0.5">
                            {chip}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* iPhone mockup */}
          <div className="flex justify-center md:justify-end">
            <WalletCardMockup mode={STEPS[active].mode} />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wallet-card-mockup.tsx src/components/landing/how-it-works.tsx
git commit -m "feat: add WalletCard mockup and HowItWorks interactive section"
```

---

## Task 5: CTA final + Footer + ensamblar page.tsx

**Files:**
- Create: `src/components/landing/cta-section.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Crear CTA section**

```tsx
// src/components/landing/cta-section.tsx
import Link from 'next/link'

export function CtaSection() {
  return (
    <>
      {/* CTA */}
      <section id="precios" className="bg-white py-20 px-6 border-t border-slate-100 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          ¿Listo para fidelizar a tus clientes?
        </h2>
        <p className="text-slate-500 text-[15px] mb-8">
          Empieza gratis hoy. Sin tarjeta de crédito.
        </p>
        <Link
          href="/register"
          className="inline-block font-bold bg-slate-900 text-white rounded-xl px-9 py-4 text-[15px] hover:bg-slate-700 transition-colors"
        >
          Crear mi tarjeta gratis →
        </Link>
        <div className="mt-6 flex gap-6 justify-center flex-wrap text-xs text-slate-400">
          <span>✓ Sin contrato</span>
          <span>✓ Cancela cuando quieras</span>
          <span>✓ Soporte en español</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-black tracking-tight text-slate-900">
            fideli<span className="text-[#00C896]">tap</span>
          </span>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="#como-funciona" className="hover:text-slate-600 transition-colors">Cómo funciona</Link>
            <Link href="/login" className="hover:text-slate-600 transition-colors">Iniciar sesión</Link>
            <Link href="/register" className="hover:text-slate-600 transition-colors">Registro</Link>
          </div>
          <p className="text-xs text-slate-400">© 2026 FideliTap. Hecho en Colombia 🇨🇴</p>
        </div>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: Ensamblar `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CtaSection } from '@/components/landing/cta-section'

export default function HomePage() {
  return (
    <div className="bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <CtaSection />
    </div>
  )
}
```

- [ ] **Step 3: Verificar build y que la página no tiene errores de TypeScript**

```bash
pnpm build
```

Esperado: build exitoso, sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/cta-section.tsx src/app/page.tsx
git commit -m "feat: complete landing page with hero, how-it-works, CTA and footer"
```

---

## Task 6: Auth layout + Login page + Login action

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: Crear el layout del grupo auth**

```tsx
// src/app/(auth)/layout.tsx
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <Link href="/" className="text-2xl font-black tracking-tight mb-10">
        fideli<span className="text-[#00C896]">tap</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-slate-600">
        © 2026 FideliTap · Hecho en Colombia 🇨🇴
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Crear la Server Action de login**

```typescript
// src/app/(auth)/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es requerida'),
})

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  // 1. Rate limiting por IP
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'

  const { success } = await loginRateLimit.limit(ip)
  if (!success) {
    return { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
  }

  // 2. Validar inputs con Zod
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  // 3. Autenticar con Supabase (nunca revelar si el email existe)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  // 4. Redirect — sesión en httpOnly cookie, nunca en cliente
  redirect('/dashboard')
}
```

- [ ] **Step 3: Crear la página de login**

```tsx
// src/app/(auth)/login/page.tsx
'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null)

  return (
    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
      <h1 className="text-2xl font-black text-white mb-1">Bienvenido de vuelta</h1>
      <p className="text-slate-500 text-sm mb-7">Ingresa a tu panel de negocio</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@negocio.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Contraseña
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {state?.error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-[#00C896] font-semibold hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verificar build**

```bash
pnpm build
```

Esperado: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add auth layout, login page and rate-limited login action"
```

---

## Task 7: Register page + Register action

**Files:**
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/register/actions.ts`

- [ ] **Step 1: Crear la Server Action de registro**

La acción crea el usuario en Supabase Auth y luego el registro `businesses` usando el admin client. El admin client es server-only — el service role key NUNCA llega al navegador.

```typescript
// src/app/(auth)/register/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const registerSchema = z.object({
  businessName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'Máximo 128 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
})

export async function registerAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  // 1. Validar con Zod antes de tocar Supabase
  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  // 2. Crear usuario en Supabase Auth
  const supabase = await createClient()
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return { error: 'Este email ya está registrado. Intenta iniciar sesión.' }
    }
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  if (!data.user) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  // 3. Crear registro del negocio con admin client (server-only)
  // Se usa admin porque en entornos con email confirmation,
  // el usuario aún no tiene sesión activa en este punto.
  const admin = createAdminClient()
  const { error: bizError } = await admin.from('businesses').insert({
    owner_id: data.user.id,
    name: parsed.data.businessName,
    email: parsed.data.email,
  })

  if (bizError) {
    // Limpiar el usuario auth si falla la creación del negocio
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  // 4. Redirigir — si hay sesión activa, el middleware lleva al dashboard
  redirect('/dashboard')
}
```

- [ ] **Step 2: Crear la página de registro**

```tsx
// src/app/(auth)/register/page.tsx
'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { registerAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
    </button>
  )
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, null)

  return (
    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
      <h1 className="text-2xl font-black text-white mb-1">Crea tu cuenta</h1>
      <p className="text-slate-500 text-sm mb-7">Empieza gratis, sin tarjeta de crédito</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="businessName" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Nombre de tu negocio
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            autoComplete="organization"
            required
            placeholder="Café Luna, Studio Hair..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@negocio.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
          />
        </div>

        {state?.error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <SubmitButton />

        <p className="text-center text-xs text-slate-600 leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/terms" className="text-slate-400 hover:underline">Términos de servicio</Link>
          {' '}y{' '}
          <Link href="/privacy" className="text-slate-400 hover:underline">Política de privacidad</Link>.
        </p>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#00C896] font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
pnpm build
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/register/
git commit -m "feat: add register page and action with business creation"
```

---

## Task 8: Auth utility routes + actualizar middleware

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/logout/route.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Crear route de callback OAuth**

```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirigir solo a rutas internas — nunca a URLs externas
  const safeNext = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
```

- [ ] **Step 2: Crear route de logout**

```typescript
// src/app/auth/logout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url))
}
```

- [ ] **Step 3: Actualizar middleware para agregar `/onboarding` a rutas protegidas**

En `src/middleware.ts`, la línea con `PROTECTED_BUSINESS_ROUTES` actualmente es:

```typescript
const PROTECTED_BUSINESS_ROUTES = [
  '/dashboard',
  '/cards',
  '/scanner',
  '/customers',
  '/settings',
  '/poster',
]
```

Reemplazar con:

```typescript
const PROTECTED_BUSINESS_ROUTES = [
  '/dashboard',
  '/cards',
  '/scanner',
  '/customers',
  '/settings',
  '/poster',
  '/onboarding',
]
```

- [ ] **Step 4: Verificar build**

```bash
pnpm build
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/ src/middleware.ts
git commit -m "feat: add OAuth callback route, logout route and update middleware"
```

---

## Task 9: Dashboard shell layout + placeholder dashboard

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Crear el layout del dashboard con sidebar**

Este layout incluye verificación de negocio — si el usuario autenticado no tiene un negocio asociado, redirige a `/onboarding`.

```tsx
// src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/cards', label: 'Mis tarjetas', icon: '◉' },
  { href: '/customers', label: 'Clientes', icon: '◎' },
  { href: '/scanner', label: 'Escanear', icon: '⌻' },
  { href: '/poster', label: 'Plantilla', icon: '▤' },
  { href: '/settings', label: 'Ajustes', icon: '⚙' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar que el usuario tiene negocio registrado
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col py-6">
        <Link href="/dashboard" className="px-6 pb-8 text-xl font-black tracking-tight">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Plan badge */}
        <div className="px-3 mt-4">
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Plan actual</p>
            <p className="text-sm font-bold text-white capitalize mb-2">{business.plan}</p>
            <Link
              href="/settings#plan"
              className="block text-center text-xs font-bold bg-[#00C896] text-slate-900 rounded-lg py-1.5 hover:bg-[#00b386] transition-colors"
            >
              Actualizar plan →
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Crear placeholder del dashboard**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('owner_id', user!.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-1">
        Hola, {business?.name ?? 'bienvenido'} 👋
      </h1>
      <p className="text-slate-500 text-sm">
        Plan 3 construirá el dashboard completo con métricas y tabla de clientes.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg">
        {['Clientes activos', 'Sellos hoy', 'Canjes totales', 'Retención'].map(metric => (
          <div key={metric} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-xs font-medium mb-2">{metric}</p>
            <p className="text-3xl font-black text-white">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar build final**

```bash
pnpm build
```

Esperado: Build exitoso, 0 errores TypeScript, 0 errores ESLint.

- [ ] **Step 4: Commit final**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat: add dashboard shell layout with sidebar and business verification"
```

---

## Task 10: Onboarding + verificación final + push PR

**Files:**
- Create: `src/app/(dashboard)/onboarding/page.tsx`
- Create: `src/app/(dashboard)/onboarding/actions.ts`

- [ ] **Step 1: Crear la Server Action de onboarding**

Esta acción es para usuarios que se autenticaron via OAuth y aún no tienen negocio.

```typescript
// src/app/(dashboard)/onboarding/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const onboardingSchema = z.object({
  businessName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
})

export async function onboardingAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const parsed = onboardingSchema.safeParse({
    businessName: formData.get('businessName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar que no tiene negocio ya (idempotencia)
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (existing) redirect('/dashboard')

  const admin = createAdminClient()
  const { error } = await admin.from('businesses').insert({
    owner_id: user.id,
    name: parsed.data.businessName,
    email: user.email!,
  })

  if (error) {
    return { error: 'Error al guardar el negocio. Intenta de nuevo.' }
  }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Crear la página de onboarding**

```tsx
// src/app/(dashboard)/onboarding/page.tsx
'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { onboardingAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00C896] hover:bg-[#00b386] disabled:opacity-60 text-slate-900 font-bold rounded-xl py-3 text-sm transition-colors"
    >
      {pending ? 'Guardando...' : 'Continuar al dashboard →'}
    </button>
  )
}

export default function OnboardingPage() {
  const [state, formAction] = useFormState(onboardingAction, null)

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-2xl font-black mb-2">
            fideli<span className="text-[#00C896]">tap</span>
          </div>
          <h1 className="text-xl font-black text-white mb-2">¿Cómo se llama tu negocio?</h1>
          <p className="text-slate-500 text-sm">Este nombre aparecerá en tus tarjetas de fidelización.</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label htmlFor="businessName" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Nombre del negocio
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                autoFocus
                required
                placeholder="Café Luna, Studio Hair..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00C896] transition-colors"
              />
            </div>

            {state?.error && (
              <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build final limpio**

```bash
pnpm build
```

Esperado: Build exitoso. 0 TypeScript errors. 0 ESLint errors.

- [ ] **Step 4: Commit final**

```bash
git add src/app/\(dashboard\)/onboarding/
git commit -m "feat: add onboarding page for OAuth users without a business record"
```

- [ ] **Step 5: Push y PR**

```bash
git push -u origin feat/plan-2-landing-auth
```

---

## Self-Review

**Spec coverage:**
- ✅ Landing page con hero, features strip, "cómo funciona" (3 pasos), CTA final — diseño aprobado `landing-v5.html`
- ✅ Navbar con logo, links, CTAs de login/register
- ✅ iPhone mockup con Apple Wallet card (3 estados: wallet, scan, success)
- ✅ Footer con copyright Colombia 🇨🇴
- ✅ Registro de business owner con email + password + nombre de negocio
- ✅ Login con email + password + rate limiting (5 intentos / 15 min)
- ✅ Error genérico en login (no revela si email existe)
- ✅ Auth callback para OAuth (redirige solo a rutas internas)
- ✅ Logout via POST (no GET — previene CSRF logout)
- ✅ Dashboard shell con sidebar + verificación de negocio
- ✅ Onboarding para usuarios OAuth sin negocio
- ✅ Middleware actualizado con `/onboarding` protegida
- ✅ Admin client solo en server actions (service role nunca al cliente)
- ✅ Zod validation antes de cualquier llamada a Supabase
- ✅ httpOnly cookies via Supabase SSR (nunca localStorage)
- ✅ Cleanup del usuario auth si falla la creación del negocio en register

**Placeholders:** Ninguno — todo el código es completo.

**Consistencia de tipos:**
- `loginAction` retorna `Promise<{ error: string } | null>` — consistente con `useFormState` signature
- `registerAction` retorna `Promise<{ error: string } | null>` — idem
- `onboardingAction` retorna `Promise<{ error: string } | null>` — idem
- Todas las actions usan `_prevState` como primer argumento (patrón `useFormState`)
