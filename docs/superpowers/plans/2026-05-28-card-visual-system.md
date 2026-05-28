# Card Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el sistema de tarjetas de Fidelitap con 5 estilos premium (Clean, Modern, Luxury, Editorial, Minimal), reward banner, logo del negocio, y editor mejorado con sidebar + live preview.

**Architecture:** `WalletPreview` es el único renderer de tarjetas (reemplaza el componente actual), parametrizado por un objeto `CardDesignConfig` que incluye el nuevo campo `style`. El editor pasa a sidebar+preview. `CardWidget` y `CardDrawer` usan el mismo renderer. El layout anatomía es fijo (nombre→stamps→reward→stats→QR→Fidelitap); solo el tratamiento visual cambia por estilo.

**Tech Stack:** Next.js 14, TailwindCSS, Framer Motion (nuevo), Supabase Storage, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-28-card-visual-system-design.md`

---

## File Map

| File | Acción |
|------|--------|
| `src/types/database.ts` | Modify — add `style`, `bg_mode`, `logo_url` to `CardDesignConfig` |
| `src/components/cards/wallet-preview.tsx` | **Full rewrite** — unified 5-style renderer |
| `src/components/cards/card-editor.tsx` | **Full rewrite** — sidebar + style picker + logo upload + Framer Motion |
| `src/components/cards/card-widget.tsx` | Modify — use new WalletPreview props + framer-motion hover |
| `src/components/cards/card-drawer.tsx` | Modify — use new WalletPreview props |
| `src/app/(dashboard)/cards/actions.ts` | Modify — add `style`, `bg_mode`, `logo_url` to form + design_config |
| `package.json` | Add `framer-motion` |

---

### Task 1: Install framer-motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /path/to/fidelitap && pnpm add framer-motion
```

Expected output: `+ framer-motion X.X.X` in dependencies

- [ ] **Step 2: Verify it resolves**

```bash
node -e "require('framer-motion'); console.log('ok')" 2>/dev/null || npx tsc --noEmit 2>&1 | grep framer || echo "ok"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add framer-motion"
```

---

### Task 2: Update CardDesignConfig type

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Update the interface**

Find the `CardDesignConfig` interface (currently around line 23 of `src/types/database.ts`) and replace it:

```typescript
export interface CardDesignConfig {
  color: string
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string
  bg_image_url: string | null
  stamp_icon: string
  font: 'default' | 'rounded' | 'mono'
  // v2 fields
  style: 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'
  bg_mode: 'light' | 'dark'
  logo_url: string | null
}

export type CardStyle = CardDesignConfig['style']
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: existing errors from callers that don't pass `style`/`bg_mode`/`logo_url` yet — those will be fixed in later tasks. The interface itself compiles.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add style, bg_mode, logo_url to CardDesignConfig"
```

---

### Task 3: Rewrite WalletPreview — unified 5-style renderer

**Files:**
- Rewrite: `src/components/cards/wallet-preview.tsx`

This is the central card renderer used by editor, widget, drawer, and the customer-facing page. It must handle all 5 styles from a single component.

- [ ] **Step 1: Write the new component**

Replace the entire content of `src/components/cards/wallet-preview.tsx` with:

```tsx
// src/components/cards/wallet-preview.tsx
import React from 'react'

export type CardStyle = 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'

export interface WalletPreviewProps {
  businessName: string
  name: string
  benefitDescription: string
  stampsRequired: number
  stampIcon: string
  color: string
  cardStyle?: CardStyle
  bgMode?: 'light' | 'dark'
  bgType?: 'solid' | 'image'
  bgImageUrl?: string | null
  logoUrl?: string | null
  filledStamps?: number
  qrDataUrl?: string | null
  size?: 'sm' | 'md'
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r},${g},${b}`
}

function QRPlaceholder({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg">
      <rect width="37" height="37" fill="white"/>
      <rect x="1" y="1" width="11" height="11" rx="2" fill="#111"/>
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#111"/>
      <rect x="25" y="1" width="11" height="11" rx="2" fill="#111"/>
      <rect x="26" y="2" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="27" y="3" width="7" height="7" rx="1" fill="#111"/>
      <rect x="1" y="25" width="11" height="11" rx="2" fill="#111"/>
      <rect x="2" y="26" width="9" height="9" rx="1.5" fill="white"/>
      <rect x="3" y="27" width="7" height="7" rx="1" fill="#111"/>
      <rect x="14" y="1" width="2" height="2" fill="#111"/><rect x="17" y="1" width="2" height="2" fill="#111"/><rect x="20" y="1" width="2" height="2" fill="#111"/>
      <rect x="14" y="4" width="2" height="2" fill="#111"/><rect x="20" y="4" width="2" height="2" fill="#111"/>
      <rect x="14" y="7" width="2" height="2" fill="#111"/><rect x="17" y="7" width="2" height="2" fill="#111"/>
      <rect x="1" y="14" width="2" height="2" fill="#111"/><rect x="4" y="14" width="2" height="2" fill="#111"/><rect x="7" y="14" width="2" height="2" fill="#111"/>
      <rect x="14" y="14" width="2" height="2" fill="#111"/><rect x="17" y="14" width="2" height="2" fill="#111"/><rect x="20" y="14" width="2" height="2" fill="#111"/>
      <rect x="26" y="14" width="2" height="2" fill="#111"/><rect x="29" y="14" width="2" height="2" fill="#111"/><rect x="32" y="14" width="2" height="2" fill="#111"/>
      <rect x="1" y="17" width="2" height="2" fill="#111"/><rect x="7" y="17" width="2" height="2" fill="#111"/>
      <rect x="14" y="17" width="2" height="2" fill="#111"/><rect x="20" y="17" width="2" height="2" fill="#111"/><rect x="26" y="17" width="2" height="2" fill="#111"/>
      <rect x="1" y="20" width="2" height="2" fill="#111"/><rect x="4" y="20" width="2" height="2" fill="#111"/><rect x="10" y="20" width="2" height="2" fill="#111"/>
      <rect x="17" y="20" width="2" height="2" fill="#111"/><rect x="23" y="20" width="2" height="2" fill="#111"/><rect x="29" y="20" width="2" height="2" fill="#111"/>
      <rect x="14" y="23" width="2" height="2" fill="#111"/><rect x="20" y="23" width="2" height="2" fill="#111"/>
      <rect x="17" y="26" width="2" height="2" fill="#111"/><rect x="23" y="26" width="2" height="2" fill="#111"/>
      <rect x="14" y="29" width="2" height="2" fill="#111"/><rect x="20" y="29" width="2" height="2" fill="#111"/>
      <rect x="17" y="32" width="2" height="2" fill="#111"/><rect x="26" y="32" width="2" height="2" fill="#111"/>
    </svg>
  )
}

interface StyleVisuals {
  nameColor: string
  subtleColor: string
  verySubtleColor: string
  logoBg: string
  logoBorder: string
  stampFilledBg: string
  stampFilledShadow: string
  stampEmptyBg: string
  stampEmptyBorder: string
  rewardBannerBg: string
  rewardBannerBorder: string
  rewardLabelColor: string
  rewardValueColor: string
  statLabelColor: string
  statValueColor: string
  footerBg: string
  footerBorder: string
  poweredByColor: string
  stampShape: 'circle' | 'square'
}

function getVisuals(style: CardStyle, color: string, bgMode: 'light' | 'dark'): StyleVisuals {
  const rgb = hexToRgb(color)
  const light = style === 'clean' && bgMode === 'light'
  const minimal = style === 'minimal'
  const isLight = light || minimal
  const luxury = style === 'luxury'
  const accentColor = luxury ? '#c9a227' : color

  return {
    nameColor:          isLight ? color : (luxury ? '#e8e8e8' : '#fff'),
    subtleColor:        isLight ? '#999' : 'rgba(255,255,255,0.35)',
    verySubtleColor:    isLight ? '#bbb' : 'rgba(255,255,255,0.22)',
    logoBg:             isLight ? color : `rgba(${rgb},0.18)`,
    logoBorder:         isLight ? 'none' : `1.5px solid rgba(${rgb},0.3)`,
    stampFilledBg:      luxury ? 'linear-gradient(135deg,#c9a227,#f0c940)' : color,
    stampFilledShadow:  luxury ? '0 4px 14px rgba(201,162,39,0.45)' : `0 4px 16px rgba(${rgb},0.4)`,
    stampEmptyBg:       isLight ? '#f0f0f0' : 'transparent',
    stampEmptyBorder:   isLight ? '1.5px solid #e0e0e0' : `2px dashed rgba(${rgb},0.25)`,
    rewardBannerBg:     isLight ? '#f0f0f0' : `rgba(${rgb},0.08)`,
    rewardBannerBorder: isLight ? '1.5px solid #e8e8e8' : `1.5px solid rgba(${rgb},0.16)`,
    rewardLabelColor:   accentColor,
    rewardValueColor:   isLight ? '#222' : '#e2e8f0',
    statLabelColor:     accentColor,
    statValueColor:     isLight ? '#1a1a1a' : '#e2e8f0',
    footerBg:           isLight ? '#ede8de' : (luxury ? '#060606' : 'rgba(0,0,0,0.22)'),
    footerBorder:       isLight ? 'rgba(0,0,0,0.07)' : (luxury ? 'rgba(201,162,39,0.1)' : 'rgba(255,255,255,0.06)'),
    poweredByColor:     isLight ? '#aaa' : 'rgba(255,255,255,0.32)',
    stampShape:         style === 'editorial' ? 'square' : 'circle',
  }
}

interface CardShell {
  wrapperStyle: React.CSSProperties
  shadow: string
  overlays: React.ReactNode
  separatorBg: string
}

function getCardShell(
  style: CardStyle,
  color: string,
  bgMode: 'light' | 'dark',
  bgType: string,
  bgImageUrl?: string | null,
): CardShell {
  const rgb = hexToRgb(color)

  if (bgType === 'image' && bgImageUrl) {
    return {
      wrapperStyle: {
        backgroundImage: `linear-gradient(145deg, rgba(0,0,0,0.82), rgba(0,0,0,0.55)), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      shadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
      overlays: null,
      separatorBg: '#111',
    }
  }

  switch (style) {
    case 'clean': {
      const isLight = bgMode === 'light'
      return {
        wrapperStyle: { background: isLight ? '#F5F0E8' : '#111' },
        shadow: isLight
          ? '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)'
          : '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        overlays: null,
        separatorBg: isLight ? '#F5F0E8' : '#111',
      }
    }

    case 'modern':
      return {
        wrapperStyle: { background: 'linear-gradient(145deg,#080e17 0%,#0d1520 55%,#060f18 100%)' },
        shadow: `0 24px 64px rgba(${rgb},0.12), 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)`,
        overlays: (
          <>
            <div style={{ position:'absolute',top:'-80px',right:'-80px',width:'260px',height:'260px',borderRadius:'50%',background:`radial-gradient(circle,rgba(${rgb},0.14) 0%,transparent 68%)`,pointerEvents:'none' }} />
            <div style={{ position:'absolute',bottom:'-60px',left:'-40px',width:'180px',height:'180px',borderRadius:'50%',background:'radial-gradient(circle,rgba(14,165,233,0.08) 0%,transparent 70%)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',pointerEvents:'none' }} />
          </>
        ),
        separatorBg: '#080e17',
      }

    case 'luxury':
      return {
        wrapperStyle: { background: '#0a0a0a' },
        shadow: '0 24px 64px rgba(201,162,39,0.1), 0 8px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,162,39,0.06)',
        overlays: (
          <>
            <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 32px,rgba(255,255,255,0.012) 32px,rgba(255,255,255,0.012) 33px)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',top:'-40px',right:'-30px',width:'160px',height:'160px',borderRadius:'50%',background:'radial-gradient(circle,rgba(201,162,39,0.12) 0%,transparent 65%)',pointerEvents:'none' }} />
          </>
        ),
        separatorBg: '#0a0a0a',
      }

    case 'editorial':
      return {
        wrapperStyle: { background: 'linear-gradient(160deg,#1a0038 0%,#0d0d22 40%,#001a38 100%)' },
        shadow: '0 24px 64px rgba(99,102,241,0.15), 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
        overlays: (
          <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at 75% 20%,rgba(99,102,241,0.22) 0%,transparent 55%),radial-gradient(ellipse at 20% 80%,rgba(236,72,153,0.16) 0%,transparent 50%)',pointerEvents:'none' }} />
        ),
        separatorBg: '#0d0d22',
      }

    case 'minimal':
      return {
        wrapperStyle: { background: '#f8f8f8' },
        shadow: '0 16px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        overlays: (
          <div style={{ position:'absolute',top:0,left:0,right:0,height:'3px',background:color,pointerEvents:'none' }} />
        ),
        separatorBg: '#f8f8f8',
      }
  }
}

export function WalletPreview({
  businessName,
  name,
  benefitDescription,
  stampsRequired,
  stampIcon,
  color,
  cardStyle = 'clean',
  bgMode = 'light',
  bgType = 'solid',
  bgImageUrl,
  logoUrl,
  filledStamps = 3,
  qrDataUrl,
  size = 'md',
}: WalletPreviewProps) {
  const isSm = size === 'sm'
  const filled   = Math.min(filledStamps, stampsRequired)
  const remaining = Math.max(stampsRequired - filled, 0)

  const shell = getCardShell(cardStyle, color, bgMode, bgType, bgImageUrl)
  const vis   = getVisuals(cardStyle, color, bgMode)

  const isLight = cardStyle === 'clean' && bgMode === 'light'
  const isMinimal = cardStyle === 'minimal'
  const lightBg = isLight || isMinimal

  return (
    <div
      className={`relative overflow-hidden font-sans select-none ${isSm ? 'rounded-xl' : 'rounded-2xl'}`}
      style={{ ...shell.wrapperStyle, boxShadow: shell.shadow }}
    >
      {shell.overlays}

      {/* ── TOP: Business name + logo ── */}
      <div
        className={`relative z-10 flex justify-between items-start ${isSm ? 'px-3 pt-4 pb-2' : 'px-6 pt-6 pb-4'}`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <p
            className={`font-black uppercase leading-tight tracking-tight ${isSm ? 'text-xl' : 'text-3xl'}`}
            style={{ color: vis.nameColor, letterSpacing: '-0.02em' }}
          >
            {businessName || 'Mi Negocio'}
          </p>
          <p
            className={`font-medium mt-0.5 truncate ${isSm ? 'text-[10px]' : 'text-sm'}`}
            style={{ color: vis.subtleColor }}
          >
            {name || 'Tarjeta de fidelización'}
          </p>
        </div>
        <div
          className={`flex-shrink-0 flex items-center justify-center overflow-hidden ${isSm ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'}`}
          style={{ background: vis.logoBg, border: vis.logoBorder }}
        >
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            : <span className={isSm ? 'text-xl' : 'text-3xl'}>{stampIcon}</span>
          }
        </div>
      </div>

      {/* ── STAMPS GRID ── */}
      <div className={`relative z-10 ${isSm ? 'px-3 pb-2' : 'px-6 pb-4'}`}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: stampsRequired }).map((_, i) => {
            const active = i < filled
            const isSquare = vis.stampShape === 'square'
            return (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center ${isSm ? 'text-[10px]' : 'text-xl'} ${isSquare ? 'rounded-lg' : 'rounded-full'}`}
                style={
                  active
                    ? { background: vis.stampFilledBg, boxShadow: vis.stampFilledShadow }
                    : { background: vis.stampEmptyBg, border: vis.stampEmptyBorder, opacity: 0.45, filter: 'grayscale(1)' }
                }
              >
                {active ? stampIcon : (isSm ? '' : stampIcon)}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── REWARD BANNER ── */}
      {!isSm && (
        <div
          className="relative z-10 mx-6 mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: vis.rewardBannerBg, border: vis.rewardBannerBorder }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: color }}
          >
            🎁
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: vis.rewardLabelColor }}>
              Premio al completar
            </p>
            <p className="text-sm font-bold mt-0.5 truncate" style={{ color: vis.rewardValueColor }}>
              {benefitDescription || 'Premio especial'}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xl font-black leading-none" style={{ color: vis.rewardLabelColor }}>{filled}</p>
            <p className="text-[10px]" style={{ color: vis.subtleColor }}>de {stampsRequired}</p>
          </div>
        </div>
      )}

      {/* ── STATS ROW ── */}
      {!isSm && (
        <div className="relative z-10 grid grid-cols-2 gap-4 px-6 pb-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: vis.statLabelColor }}>
              Hasta próx premio
            </p>
            <p className="text-2xl font-black leading-none" style={{ color: vis.statValueColor }}>
              {remaining}{' '}
              <span className="text-sm font-semibold" style={{ color: vis.subtleColor }}>sellos</span>
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: vis.statLabelColor }}>
              Premios disponibles
            </p>
            <p className="text-2xl font-black leading-none" style={{ color: vis.statValueColor }}>
              0{' '}
              <span className="text-sm font-semibold" style={{ color: vis.subtleColor }}>premios</span>
            </p>
          </div>
        </div>
      )}

      {/* ── EDITORIAL SEPARATOR (boarding pass effect) ── */}
      {cardStyle === 'editorial' && !isSm && (
        <div className="relative z-10" style={{ height: '1px', borderTop: '1.5px dashed rgba(255,255,255,0.12)', margin: '0 0' }}>
          <div style={{ position:'absolute',top:'-8px',left:'-8px',width:'16px',height:'16px',borderRadius:'50%',background:shell.separatorBg }} />
          <div style={{ position:'absolute',top:'-8px',right:'-8px',width:'16px',height:'16px',borderRadius:'50%',background:shell.separatorBg }} />
        </div>
      )}

      {/* ── QR + FIDELITAP FOOTER ── */}
      <div
        className={`relative z-10 flex items-center justify-between ${isSm ? 'px-3 py-2.5' : 'px-6 py-5'}`}
        style={{ background: vis.footerBg, borderTop: `1px solid ${vis.footerBorder}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`bg-white flex items-center justify-center rounded-xl overflow-hidden ${isSm ? 'w-10 h-10 p-1' : 'w-16 h-16 p-2'}`}
            style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
          >
            {qrDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qrDataUrl} alt="QR" className="w-full h-full" />
              : <QRPlaceholder size={isSm ? 32 : 52} />
            }
          </div>
          {!isSm && (
            <div>
              <p className="text-[9px] font-mono tracking-widest" style={{ color: vis.subtleColor }}>
                FDL·A2X9·K7M3
              </p>
              <p className="text-[8px] mt-0.5" style={{ color: vis.verySubtleColor }}>
                Escanea en cada visita
              </p>
            </div>
          )}
        </div>
        <div className="text-right">
          {!isSm && (
            <p className="text-[8px] uppercase tracking-wider" style={{ color: vis.verySubtleColor }}>
              Powered by
            </p>
          )}
          <p className={`font-black ${isSm ? 'text-[9px]' : 'text-xs'}`} style={{ color: vis.poweredByColor }}>
            Fideli<span style={{ color: '#00C896' }}>tap</span>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "wallet-preview" | head -10
```

Expected: no errors from `wallet-preview.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/wallet-preview.tsx
git commit -m "feat(cards): rewrite WalletPreview — 5 styles, reward banner, QR footer, logo"
```

---

### Task 4: Update card actions — add style, bg_mode, logo_url

**Files:**
- Modify: `src/app/(dashboard)/cards/actions.ts`

The actions need to: (a) accept `style`, `bg_mode`, `logo_url` from the form, (b) upload logo to Supabase Storage bucket `card-logos`, (c) persist all fields in `design_config`.

- [ ] **Step 1: Create the `card-logos` bucket in Supabase**

Run in the Supabase dashboard (or via SQL Editor):

```sql
-- Run in Supabase SQL Editor → New query
insert into storage.buckets (id, name, public)
values ('card-logos', 'card-logos', true)
on conflict (id) do nothing;

-- RLS: allow authenticated uploads to their own folder
create policy "authenticated users upload card logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-logos');

create policy "public read card logos" on storage.objects
  for select to public
  using (bucket_id = 'card-logos');
```

- [ ] **Step 2: Update the form schema in `src/app/(dashboard)/cards/actions.ts`**

Find the `cardFormSchema` const and replace it:

```typescript
const cardFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres').trim(),
  benefit_description: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').trim(),
  stamps_required: z.coerce.number().int().min(2, 'Mínimo 2 sellos').max(20, 'Máximo 20 sellos'),
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  style: z.enum(['clean', 'modern', 'luxury', 'editorial', 'minimal']).default('clean'),
  bg_mode: z.enum(['light', 'dark']).default('light'),
})
```

- [ ] **Step 3: Add `uploadLogo` helper after `uploadImage`**

After the existing `uploadImage` function, add:

```typescript
async function uploadLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  file: File
): Promise<string | { error: string }> {
  if (file.size > 2 * 1024 * 1024) return { error: 'El logo no puede superar 2MB' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('card-logos')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return { error: 'Error subiendo logo. Intenta de nuevo.' }
  const { data: { publicUrl } } = supabase.storage
    .from('card-logos')
    .getPublicUrl(path)
  return publicUrl
}
```

- [ ] **Step 4: Update `createCardAction` — parse new fields + handle logo**

Find the section inside `createCardAction` where `parsed` is destructured and `design_config` is built. Replace from `const { name, ...` down to the `design_config` object:

```typescript
  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color, style, bg_mode } = parsed.data

  let bgImageUrl: string | null = null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  let logoUrl: string | null = null
  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    const result = await uploadLogo(supabase, business.id, logoFile)
    if (typeof result !== 'string') return result
    logoUrl = result
  }

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
    style,
    bg_mode,
    logo_url: logoUrl,
  }
```

- [ ] **Step 5: Update `updateCardAction` — same new fields + preserve logo**

Find the section inside `updateCardAction` where `parsed` is destructured. Replace from `const { name, ...` down to the `design_config` object:

```typescript
  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color, style, bg_mode } = parsed.data
  const existingConfig = card.design_config as Record<string, unknown>

  let bgImageUrl = bg_type === 'image'
    ? (existingConfig.bg_image_url as string | null) ?? null
    : null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  // Preserve existing logo unless a new one is uploaded
  let logoUrl = (existingConfig.logo_url as string | null) ?? null
  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    const result = await uploadLogo(supabase, business.id, logoFile)
    if (typeof result !== 'string') return result
    logoUrl = result
  }
  // Allow explicit logo removal
  if (formData.get('remove_logo') === 'true') logoUrl = null

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
    style,
    bg_mode,
    logo_url: logoUrl,
  }
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/cards/actions.ts"
git commit -m "feat(cards): add style, bg_mode, logo_url to card actions"
```

---

### Task 5: Rewrite card-editor.tsx — sidebar + style picker + logo upload

**Files:**
- Rewrite: `src/components/cards/card-editor.tsx`

New layout: fixed 320px left sidebar with sections (Información, Estilo, Marca, Fondo) + right live preview area with card at ~300px. Style picker shows 5 mini thumbnail buttons. Framer Motion on style/color transitions.

- [ ] **Step 1: Write the new editor**

Replace the entire content of `src/components/cards/card-editor.tsx`:

```tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { createCardAction, updateCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard, CardDesignConfig, CardStyle } from '@/types/database'

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

  const [name,               setName]             = useState(card?.name ?? '')
  const [benefit,            setBenefit]           = useState(card?.benefit_description ?? '')
  const [stampsRequired,     setStampsRequired]    = useState(card?.stamps_required ?? 8)
  const [stampIcon,          setStampIcon]         = useState(existingDesign?.stamp_icon ?? '☕')
  const [color,              setColor]             = useState(existingDesign?.color ?? '#1d4ed8')
  const [cardStyle,          setCardStyle]         = useState<CardStyle>(existingDesign?.style ?? 'clean')
  const [bgMode,             setBgMode]            = useState<'light' | 'dark'>(existingDesign?.bg_mode ?? 'light')
  const [bgType,             setBgType]            = useState<'solid' | 'image'>(existingDesign?.bg_type === 'image' ? 'image' : 'solid')
  const [bgImageFile,        setBgImageFile]       = useState<File | null>(null)
  const [bgImagePreview,     setBgImagePreview]    = useState<string | null>(existingDesign?.bg_image_url ?? null)
  const [logoFile,           setLogoFile]          = useState<File | null>(null)
  const [logoPreview,        setLogoPreview]       = useState<string | null>(existingDesign?.logo_url ?? null)
  const [error,              setError]             = useState<string | null>(null)
  const [isPending,          startTransition]      = useTransition()
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
    setBgImagePreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
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

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <Link href="/cards" className="text-white/40 hover:text-white transition-colors text-sm">
            ←
          </Link>
          <h1 className="font-bold text-sm text-white">
            {isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}
          </h1>
        </div>

        <form id="card-form" onSubmit={handleSubmit} className="flex-1 flex flex-col gap-0">

          {/* Section: Información */}
          <SidebarSection label="Información">
            <Field label="Nombre de la tarjeta">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Café de la casa" maxLength={50} />
            </Field>
            <Field label="Premio al completar">
              <Input value={benefit} onChange={e => setBenefit(e.target.value)} placeholder="Ej: 1 café gratis" maxLength={100} />
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

          {/* Section: Estilo */}
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
                  {cardStyle === s.key && (
                    <span className="ml-auto text-[#00C896] text-sm">✓</span>
                  )}
                </motion.button>
              ))}
            </div>
          </SidebarSection>

          {/* Section: Marca */}
          <SidebarSection label="Marca">
            {/* Color picker */}
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

            {/* Emoji icon */}
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

            {/* Logo upload */}
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

          {/* Section: Fondo */}
          <SidebarSection label="Fondo">
            {/* Light/dark toggle — only for clean style */}
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

            {/* Background photo */}
            <Field label="Foto de fondo (opcional)">
              <div className="flex gap-2 mb-2">
                {(['solid', 'image'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setBgType(t)}
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
                    <button type="button" onClick={() => bgInputRef.current?.click()}
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

          {/* Error + Submit */}
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

      {/* ── RIGHT: LIVE PREVIEW ── */}
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

// ── Sub-components ──────────────────────────────────────────

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

function Input({ value, onChange, placeholder, maxLength }: {
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-editor.tsx
git commit -m "feat(editor): sidebar layout, 5-style picker, logo upload, framer-motion preview"
```

---

### Task 6: Update CardWidget — new WalletPreview props + framer-motion hover

**Files:**
- Modify: `src/components/cards/card-widget.tsx`

- [ ] **Step 1: Replace card-widget.tsx**

```tsx
// src/components/cards/card-widget.tsx
'use client'

import { motion } from 'framer-motion'
import { WalletPreview } from '@/components/cards/wallet-preview'
import type { LoyaltyCard, CardDesignConfig } from '@/types/database'

interface CardWidgetProps {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
  onClick: () => void
  dimmed?: boolean
}

export function CardWidget({ card, customerCount, redemptionCount, onClick, dimmed }: CardWidgetProps) {
  const design = card.design_config as unknown as CardDesignConfig

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`cursor-pointer transition-opacity ${dimmed ? 'opacity-40' : ''}`}
    >
      <WalletPreview
        businessName={card.name}
        name={card.name}
        benefitDescription={card.benefit_description}
        stampsRequired={card.stamps_required}
        stampIcon={design.stamp_icon ?? '⭐'}
        color={design.color ?? '#00C896'}
        cardStyle={design.style ?? 'clean'}
        bgMode={design.bg_mode ?? 'light'}
        bgType={design.bg_type === 'image' ? 'image' : 'solid'}
        bgImageUrl={design.bg_image_url}
        logoUrl={design.logo_url}
        filledStamps={3}
        size="sm"
      />
      {/* Stats below card */}
      <div className="mt-2.5 flex gap-4 px-1">
        <div>
          <p className="text-sm font-bold text-white">{customerCount}</p>
          <p className="text-[10px] text-white/30">clientes</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{card.stamps_required}</p>
          <p className="text-[10px] text-white/30">sellos</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{redemptionCount}</p>
          <p className="text-[10px] text-white/30">canjes</p>
        </div>
        <div className="ml-auto">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              color: design.color ?? '#00C896',
              background: `${design.color ?? '#00C896'}18`,
            }}
          >
            {card.is_active ? '● Activa' : '● Inactiva'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-widget.tsx
git commit -m "feat(cards): update CardWidget — new WalletPreview props + framer-motion hover"
```

---

### Task 7: Update CardDrawer — new WalletPreview props with real QR

**Files:**
- Modify: `src/components/cards/card-drawer.tsx`

The drawer already generates a QR via `qrcode` lib and stores it in `qrDataUrl` state. Pass it to the new `WalletPreview` as `qrDataUrl` prop.

- [ ] **Step 1: Update the WalletPreview call inside `card-drawer.tsx`**

Find the `<WalletPreview` JSX block inside `card-drawer.tsx` (around the mini wallet preview section) and replace it with:

```tsx
<WalletPreview
  businessName={businessName}
  name={card.name}
  benefitDescription={card.benefit_description}
  stampsRequired={card.stamps_required}
  stampIcon={design.stamp_icon ?? '⭐'}
  color={design.color ?? '#00C896'}
  cardStyle={design.style ?? 'clean'}
  bgMode={design.bg_mode ?? 'light'}
  bgType={design.bg_type === 'image' ? 'image' : 'solid'}
  bgImageUrl={design.bg_image_url}
  logoUrl={design.logo_url}
  filledStamps={3}
  qrDataUrl={qrDataUrl || null}
  size="sm"
/>
```

Also remove the separate QR + share link section (`{/* QR + Share link */}` block) from the drawer since the QR is now embedded in the card. Keep only the copy-link button below.

Replace the `{/* QR + Share link */}` section with:

```tsx
{/* Share link */}
<div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
  <p className="text-xs text-slate-400">Enlace para clientes</p>
  <p className="text-xs text-[#00C896] break-all">{shareUrl}</p>
  <button
    onClick={handleCopyLink}
    className="w-full text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg py-1.5 transition-colors"
  >
    {copied ? '✓ Copiado' : 'Copiar enlace'}
  </button>
</div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Smoke-test locally**

```bash
# Dev server should already be running. Navigate to:
# http://localhost:3000/cards/nueva
# Verify:
# 1. Sidebar with 5 sections appears
# 2. Style picker shows 5 options — clicking each animates the preview
# 3. Color swatches update the preview in real time
# 4. Logo upload shows preview in the card
# 5. http://localhost:3000/cards shows card widgets with new design
```

- [ ] **Step 4: Commit**

```bash
git add src/components/cards/card-drawer.tsx
git commit -m "feat(cards): update CardDrawer — new WalletPreview with real QR embedded"
```

---

### Task 8: Final TypeScript + build check

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` or `Route (app)` table with no errors

- [ ] **Step 3: Final commit if any last fixes**

```bash
git add -A
git status  # review what changed
git commit -m "fix(cards): build fixes after visual system rewrite" --allow-empty
```
