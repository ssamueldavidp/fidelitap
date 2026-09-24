import Link from 'next/link'
import { Search, Gift } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/service'
import { queryDirectory } from '@/lib/directory'
import { BUSINESS_CATEGORIES } from '@/lib/business-categories'
import { resolveStorageUrl } from '@/lib/storage-url'
import { LocationButton } from './location-button'

export const metadata = { title: 'Tiendas cercanas — FideliTap' }
export const dynamic = 'force-dynamic'

type Search = { city?: string; category?: string; lat?: string; lng?: string }

// Public "Tiendas cercanas" — the web counterpart of the app's Tiendas tab.
// Same rule everywhere: only Pro/Premium businesses with an active card appear.
export default async function TiendasPage({ searchParams }: { searchParams: Search }) {
  const city = searchParams.city?.trim() || null
  const category = BUSINESS_CATEGORIES.find((c) => c === searchParams.category) ?? null
  const lat = searchParams.lat ? Number(searchParams.lat) : null
  const lng = searchParams.lng ? Number(searchParams.lng) : null
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

  const stores = await queryDirectory(createServiceClient(), {
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    city,
    category,
  })

  const chip = (c: string | null) => {
    const q = new URLSearchParams()
    if (city) q.set('city', city)
    if (hasCoords) { q.set('lat', String(lat)); q.set('lng', String(lng)) }
    if (c) q.set('category', c)
    const active = (category ?? null) === c
    return (
      <Link
        key={c ?? 'all'}
        href={`/tiendas?${q.toString()}`}
        className={`shrink-0 text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
          active ? 'bg-[#00C896] text-slate-900 font-bold border-[#00C896]' : 'bg-card border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        {c ?? 'Todas'}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[#00C896] text-xs font-bold uppercase tracking-widest mb-1">FideliTap</p>
          <h1 className="text-3xl font-black">Tiendas cercanas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Negocios con tarjeta de fidelización. Únete y empieza a acumular sellos.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <form action="/tiendas" className="flex-1 min-w-[220px] flex gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <input
              name="city"
              defaultValue={city ?? ''}
              placeholder="Buscar por ciudad o dirección"
              className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#00C896]"
            />
            <button type="submit" aria-label="Buscar" className="bg-[#00C896] text-slate-900 rounded-xl px-3.5 hover:bg-[#00b386] transition-colors">
              <Search size={16} />
            </button>
          </form>
          <LocationButton category={category ?? undefined} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {chip(null)}
          {BUSINESS_CATEGORIES.map((c) => chip(c))}
        </div>

        {stores.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No hay tiendas por aquí todavía.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stores.map((s) => {
              const icon = (s.primary_card.design_config?.stamp_icon as string | undefined) ?? '🏪'
              const expires = s.primary_card.expires_at ? new Date(s.primary_card.expires_at) : null
              const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000) : null
              return (
                <Link
                  key={s.id}
                  href={`/c/${s.primary_card.slug}`}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-[#00C896]/50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl overflow-hidden shrink-0">
                    {s.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={resolveStorageUrl(s.avatar_url) ?? undefined} alt="" className="w-full h-full object-cover" />
                      : icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.category, s.distance_km != null ? `${s.distance_km.toFixed(1)} km` : s.address].filter(Boolean).join(' · ')}
                    </p>
                    <p className="flex items-center gap-1 text-xs font-semibold mt-1.5 text-foreground/80 truncate">
                      <Gift size={12} className="text-[#00C896] shrink-0" />
                      {s.primary_card.benefit_description}
                    </p>
                    {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                      <p className="text-[11px] text-red-400 font-semibold mt-1">⚠️ Vence en {daysLeft} días</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[#00C896] shrink-0">Ver tarjeta →</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
