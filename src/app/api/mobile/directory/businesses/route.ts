import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { queryDirectory } from '@/lib/directory'

// Tiendas cercanas (Pro+) for the app. Business info is public, so this uses
// the service-role client; the eligibility rules live in src/lib/directory.ts,
// shared with the public web page /tiendas.
export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const p = req.nextUrl.searchParams
  try {
    const stores = await queryDirectory(createServiceClient(), {
      lat: p.get('lat') ? Number(p.get('lat')) : null,
      lng: p.get('lng') ? Number(p.get('lng')) : null,
      radiusKm: p.get('radius_km') ? Number(p.get('radius_km')) : 25,
      city: p.get('city')?.trim() || null,
      category: p.get('category')?.trim() || null,
    })
    return NextResponse.json({ stores })
  } catch {
    return NextResponse.json({ error: 'Error al cargar tiendas' }, { status: 500 })
  }
}
