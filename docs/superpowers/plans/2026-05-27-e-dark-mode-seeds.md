# FideliTap v2 — E: Dark Mode Fixes + Test Seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (E2) Fix remaining dark mode text contrast issues across all dashboard pages. (E3) Create a `scripts/seed-test-users.ts` script that creates 4 test users with different plan tiers for local development.

**Architecture:** E2 is a systematic audit of all dashboard files replacing hardcoded `text-white`/`text-slate-*`/`bg-slate-*` tokens with CSS variable classes (`text-foreground`, `text-muted-foreground`, `bg-card`, etc.). E3 is a standalone script using the Supabase Admin SDK to create users; passwords come only from `.env.local`.

**Tech Stack:** Tailwind CSS, CSS custom properties, Supabase Admin SDK (`@supabase/supabase-js`), tsx runner

**NOTE on E1 (Poster Export):** E1 is already done — font files exist at `src/lib/poster/fonts/Inter-Regular.ttf` and `Inter-Bold.ttf`, and `src/lib/poster/generate.ts` already reads them correctly. No action needed.

---

## CSS Variable Reference

In this codebase, Tailwind CSS variables map to:
- `bg-background` / `text-foreground` — page background / primary text
- `bg-card` / `text-card-foreground` — card surfaces
- `bg-muted` / `text-muted-foreground` — subtle backgrounds / secondary text
- `border-border` — all borders
- `text-primary` — brand color (#00C896 teal)
- `text-primary-foreground` — text ON primary background (dark in light mode, dark in dark mode)
- `bg-input` — form input backgrounds

**Replace these patterns:**
| Old (hardcoded) | New (semantic) |
|---|---|
| `text-white` | `text-foreground` |
| `text-slate-900` | `text-foreground` |
| `text-slate-400`, `text-slate-500` | `text-muted-foreground` |
| `text-slate-600` | `text-muted-foreground` |
| `bg-slate-900`, `bg-slate-950` | `bg-card` or `bg-background` |
| `bg-slate-800` | `bg-input` or `bg-muted` |
| `border-slate-700` | `border-border` |
| `border-slate-800` | `border-border` |
| `placeholder:text-slate-500` | `placeholder:text-muted-foreground` |

**Exception:** The public `/c/[slug]` page intentionally uses dark `bg-slate-900`/`text-white` because it's always dark (customers see it, not the dashboard). Only audit `(dashboard)` pages.

---

## File Map

- Audit & Modify: `src/app/(dashboard)/cards/page.tsx`
- Audit & Modify: `src/app/(dashboard)/cards/nueva/page.tsx`
- Audit & Modify: `src/app/(dashboard)/cards/[id]/editar/page.tsx`
- Audit & Modify: `src/app/(dashboard)/customers/page.tsx`
- Audit & Modify: `src/app/(dashboard)/customers/[customerId]/page.tsx`
- Audit & Modify: `src/app/(dashboard)/settings/settings-form.tsx`
- Audit & Modify: `src/components/cards/card-editor.tsx`
- Audit & Modify: `src/app/(dashboard)/poster/page.tsx`
- Audit & Modify: `src/app/(dashboard)/poster/poster-editor.tsx`
- Create: `scripts/seed-test-users.ts`
- Modify: `.env.local` (document SEED_TEST_PASSWORD)

---

### Task 1: Dark mode audit — Cards pages

**Files:**
- Audit: `src/app/(dashboard)/cards/page.tsx`
- Audit: `src/app/(dashboard)/cards/nueva/page.tsx`
- Audit: `src/app/(dashboard)/cards/[id]/editar/page.tsx`
- Audit: `src/components/cards/card-editor.tsx`

- [ ] **Step 1: Run grep to find hardcoded slate/white classes in cards pages**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate\|placeholder:text-slate" \
  src/app/(dashboard)/cards/page.tsx \
  src/app/(dashboard)/cards/nueva/page.tsx \
  "src/app/(dashboard)/cards/[id]/editar/page.tsx" \
  src/components/cards/card-editor.tsx \
  2>/dev/null
```

Expected: a list of lines with hardcoded color classes.

- [ ] **Step 2: Fix each occurrence in `src/app/(dashboard)/cards/page.tsx`**

Read the file, then for each match:
- `text-white` → `text-foreground`
- `text-slate-400` or `text-slate-500` → `text-muted-foreground`
- `text-slate-600` → `text-muted-foreground`
- `bg-slate-800` (as input bg) → `bg-input`
- `bg-slate-900` (as card bg) → `bg-card`
- `border-slate-700` / `border-slate-800` → `border-border`

- [ ] **Step 3: Fix each occurrence in `src/components/cards/card-editor.tsx`**

Read the file, apply the same replacements. This file is large — focus on labels, headings, input fields, and modal overlays.

- [ ] **Step 4: Fix each occurrence in nueva and editar pages**

Apply same replacements to those two pages.

- [ ] **Step 5: Verify no slate references remain in dashboard cards pages**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate\|placeholder:text-slate" \
  src/app/(dashboard)/cards/page.tsx \
  src/app/(dashboard)/cards/nueva/page.tsx \
  "src/app/(dashboard)/cards/[id]/editar/page.tsx" \
  src/components/cards/card-editor.tsx \
  2>/dev/null
```

Expected: empty output (or only intentional uses like the wallet preview gradient which is always dark).

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/cards/ src/components/cards/card-editor.tsx
git commit -m "fix(dark-mode): replace hardcoded slate classes in cards pages"
```

---

### Task 2: Dark mode audit — Customers pages

**Files:**
- Audit: `src/app/(dashboard)/customers/page.tsx`
- Audit: `src/app/(dashboard)/customers/[customerId]/page.tsx`

- [ ] **Step 1: Grep for hardcoded classes**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate\|placeholder:text-slate" \
  src/app/(dashboard)/customers/page.tsx \
  "src/app/(dashboard)/customers/[customerId]/page.tsx" \
  2>/dev/null
```

- [ ] **Step 2: Apply fixes using the mapping table above**

Read each file, make targeted replacements. Pay attention to:
- Table headers: usually `text-slate-400` → `text-muted-foreground`
- Table row data: usually `text-slate-300` or `text-white` → `text-foreground`
- Search input: `bg-slate-800 border-slate-700` → `bg-input border-border`
- Empty state text: `text-slate-500` → `text-muted-foreground`

- [ ] **Step 3: Verify and commit**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate" \
  src/app/(dashboard)/customers/page.tsx \
  "src/app/(dashboard)/customers/[customerId]/page.tsx" \
  2>/dev/null

git add src/app/(dashboard)/customers/
git commit -m "fix(dark-mode): replace hardcoded slate classes in customers pages"
```

---

### Task 3: Dark mode audit — Settings and Poster pages

**Files:**
- Audit: `src/app/(dashboard)/settings/settings-form.tsx`
- Audit: `src/app/(dashboard)/poster/page.tsx`
- Audit: `src/app/(dashboard)/poster/poster-editor.tsx`

- [ ] **Step 1: Grep for hardcoded classes**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate\|placeholder:text-slate" \
  src/app/(dashboard)/settings/settings-form.tsx \
  src/app/(dashboard)/poster/page.tsx \
  src/app/(dashboard)/poster/poster-editor.tsx \
  2>/dev/null
```

- [ ] **Step 2: Apply fixes**

Read each file and replace using the mapping table. Common patterns in settings-form:
- Form labels: `text-slate-400` → `text-muted-foreground`
- Input fields: `bg-slate-800 border-slate-700 text-white` → `bg-input border-border text-foreground`
- Help text: `text-slate-500` → `text-muted-foreground`

Common patterns in poster pages:
- Section headings: `text-white` → `text-foreground`
- Sidebar/panel: `bg-slate-900` → `bg-card`
- Buttons: check `text-slate-900` on primary buttons — should be `text-primary-foreground`

- [ ] **Step 3: Verify and commit**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate" \
  src/app/(dashboard)/settings/settings-form.tsx \
  src/app/(dashboard)/poster/page.tsx \
  src/app/(dashboard)/poster/poster-editor.tsx \
  2>/dev/null

git add src/app/(dashboard)/settings/settings-form.tsx \
        src/app/(dashboard)/poster/
git commit -m "fix(dark-mode): replace hardcoded slate classes in settings and poster pages"
```

---

### Task 4: Dark mode audit — Dashboard and Scanner pages

**Files:**
- Audit: `src/app/(dashboard)/dashboard/page.tsx`
- Audit: `src/app/(dashboard)/scanner/page.tsx`

- [ ] **Step 1: Grep and fix**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate\|placeholder:text-slate" \
  src/app/(dashboard)/dashboard/page.tsx \
  src/app/(dashboard)/scanner/page.tsx \
  2>/dev/null
```

Apply the same replacements. Note: `scanner/scanner-client.tsx` was rewritten in Plan B using CSS variables — no changes needed there.

- [ ] **Step 2: Verify and commit**

```bash
grep -n "text-white\|text-slate\|bg-slate\|border-slate" \
  src/app/(dashboard)/dashboard/page.tsx \
  src/app/(dashboard)/scanner/page.tsx \
  2>/dev/null

git add src/app/(dashboard)/dashboard/page.tsx \
        src/app/(dashboard)/scanner/page.tsx
git commit -m "fix(dark-mode): replace hardcoded slate classes in dashboard and scanner"
```

---

### Task 5: Final dark mode visual check

- [ ] **Step 1: Start dev server and toggle modes**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Toggle between dark/light mode using the theme toggle button.

- [ ] **Step 2: Check each page in light mode**

Visit in light mode:
- `/dashboard` → all text readable, no white-on-white
- `/cards` → card list readable
- `/customers` → table readable
- `/scanner` → scanner UI readable
- `/settings` → all tabs readable
- `/poster` → poster editor readable

Fix any remaining issues found: replace any remaining `text-white` that becomes invisible in light mode.

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix(dark-mode): final light mode contrast corrections"
```

---

### Task 6: Create test user seed script (E3)

**Files:**
- Create: `scripts/seed-test-users.ts`

This script creates 4 Supabase auth users + businesses with different plan tiers. Password is read from `.env.local` — never hardcoded.

- [ ] **Step 1: Ensure SEED_TEST_PASSWORD is in `.env.local`**

Open `.env.local` and add if not present:
```
SEED_TEST_PASSWORD=FideliTest2026!
```

This is a local dev password only. Never commit `.env.local` to git.

- [ ] **Step 2: Create `scripts/seed-test-users.ts`**

```typescript
// scripts/seed-test-users.ts
// Run with: npx tsx scripts/seed-test-users.ts
// Creates 4 test users with different plan tiers for local development.
// Reads password from SEED_TEST_PASSWORD in .env.local

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD     = process.env.SEED_TEST_PASSWORD

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

if (!PASSWORD) {
  console.error('Error: SEED_TEST_PASSWORD must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USERS = [
  {
    email:    'test-free@fidelitap.app',
    plan:     'free',
    bizName:  'Negocio Gratis Demo',
  },
  {
    email:    'test-basic@fidelitap.app',
    plan:     'basic',
    bizName:  'Negocio Básico Demo',
  },
  {
    email:    'test-pro@fidelitap.app',
    plan:     'pro',
    bizName:  'Negocio Pro Demo',
  },
  {
    email:    'test-premium@fidelitap.app',
    plan:     'premium',
    bizName:  'Negocio Premium Demo',
  },
]

async function seed() {
  console.log('Seeding test users...\n')

  for (const testUser of TEST_USERS) {
    // 1. Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers()
    const alreadyExists = existing?.users?.find((u) => u.email === testUser.email)

    let userId: string

    if (alreadyExists) {
      console.log(`  ⏩ User ${testUser.email} already exists — updating plan`)
      userId = alreadyExists.id
    } else {
      // 2. Create auth user
      const { data: created, error } = await supabase.auth.admin.createUser({
        email:             testUser.email,
        password:          PASSWORD,
        email_confirm:     true,
      })

      if (error || !created?.user) {
        console.error(`  ✗ Failed to create ${testUser.email}:`, error?.message)
        continue
      }
      userId = created.user.id
      console.log(`  ✓ Created auth user: ${testUser.email}`)
    }

    // 3. Check if business exists for this owner
    const { data: existingBiz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (existingBiz) {
      // Update plan
      await supabase
        .from('businesses')
        .update({ plan: testUser.plan })
        .eq('owner_id', userId)
      console.log(`  ✓ Updated business plan → ${testUser.plan}`)
    } else {
      // Create business
      const { error: bizError } = await supabase.from('businesses').insert({
        owner_id:            userId,
        name:                testUser.bizName,
        email:               testUser.email,
        plan:                testUser.plan,
        subscription_status: testUser.plan === 'free' ? 'active' : 'active',
      })

      if (bizError) {
        console.error(`  ✗ Failed to create business for ${testUser.email}:`, bizError.message)
        continue
      }
      console.log(`  ✓ Created business: ${testUser.bizName} (${testUser.plan})`)
    }
  }

  console.log('\nDone. Test users:')
  console.log('  Email: test-free@fidelitap.app     | Plan: free')
  console.log('  Email: test-basic@fidelitap.app    | Plan: basic')
  console.log('  Email: test-pro@fidelitap.app      | Plan: pro')
  console.log('  Email: test-premium@fidelitap.app  | Plan: premium')
  console.log('\nPassword: set in .env.local as SEED_TEST_PASSWORD')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Install tsx if not already installed**

```bash
ls node_modules/.bin/tsx 2>/dev/null && echo "tsx exists" || npm install --save-dev tsx
```

- [ ] **Step 4: Run the seed script**

```bash
npx tsx scripts/seed-test-users.ts
```

Expected output:
```
Seeding test users...

  ✓ Created auth user: test-free@fidelitap.app
  ✓ Created business: Negocio Gratis Demo (free)
  ✓ Created auth user: test-basic@fidelitap.app
  ✓ Created business: Negocio Básico Demo (basic)
  ✓ Created auth user: test-pro@fidelitap.app
  ✓ Created business: Negocio Pro Demo (pro)
  ✓ Created auth user: test-premium@fidelitap.app
  ✓ Created business: Negocio Premium Demo (premium)

Done. Test users:
  Email: test-free@fidelitap.app     | Plan: free
  ...
Password: set in .env.local as SEED_TEST_PASSWORD
```

- [ ] **Step 5: Verify users were created in local Supabase**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT email, plan FROM businesses b JOIN auth.users u ON b.owner_id = u.id WHERE u.email LIKE 'test-%@fidelitap.app';"
```

Expected: 4 rows with different plan values.

- [ ] **Step 6: Add npm script shortcut**

In `package.json`, add to the `scripts` section:
```json
"seed:test-users": "tsx scripts/seed-test-users.ts"
```

So it can be run as `npm run seed:test-users`.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-test-users.ts package.json
git commit -m "feat(dev): seed script for test users with 4 plan tiers"
```

---

### Task 7: Document .env.local variable list

- [ ] **Step 1: Create/update `.env.local.example`**

If a `.env.local.example` file doesn't exist, create it (this is safe to commit — it has no real secrets):

```bash
cat > .env.local.example << 'EOF'
# Supabase (local dev)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from: npx supabase status>
SUPABASE_SERVICE_ROLE_KEY=<get from: npx supabase status>

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# MercadoPago (TEST credentials for dev)
MP_PUBLIC_KEY=TEST-xxxxxxxx-...
MP_ACCESS_TOKEN=TEST-xxxxxxxx-...
MP_PLAN_ID_BASIC=<create in MP dashboard, copy ID here>
MP_PLAN_ID_PRO=<create in MP dashboard, copy ID here>
MP_PLAN_ID_PREMIUM=<create in MP dashboard, copy ID here>
MP_WEBHOOK_SECRET=<from MP dashboard → Webhooks → Secret Key>

# Dev seed password (never use in production)
SEED_TEST_PASSWORD=<your-local-dev-password>

# Upstash (rate limiting) — leave empty to use noop limiter in dev
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend (email)
RESEND_API_KEY=<from resend.com dashboard>

# Apple Wallet (optional)
APPLE_PASS_CERTIFICATE=
APPLE_PASS_CERTIFICATE_PASSWORD=
APPLE_PASS_TYPE_IDENTIFIER=
APPLE_TEAM_IDENTIFIER=
APPLE_APN_KEY=
APPLE_APN_KEY_ID=

# Google Wallet (optional)
GOOGLE_SERVICE_ACCOUNT_JSON=
EOF
```

- [ ] **Step 2: Add `.env.local.example` to git**

```bash
git add .env.local.example
git commit -m "docs: add .env.local.example with all variable names"
```
