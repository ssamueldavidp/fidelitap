import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { BUSINESS_CATEGORIES } from '@/lib/business-categories'
import { getPlanFeatures, isProPlan } from '@/lib/plan-features'
import type { PlanSlug } from '@/lib/plan-limits'

const VALID_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]
const VALID_RADII = [100, 300, 500]

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('businesses') as any)
    .select(`
      name, address, category, latitude, longitude, stamp_cooldown_seconds, plan, email,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .eq('owner_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({
    ...data,
    plan_features: getPlanFeatures(data.plan as PlanSlug),
    is_pro: isProPlan(data.plan),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  const {
    name, address, category, latitude, longitude, stamp_cooldown_seconds,
    timezone, geofence_enabled, geofence_radius_m, geofence_message,
    geofence_cooldown_h, quiet_hours_start, quiet_hours_end,
  } = body

  const db = createServiceClient()

  // Verify plan for geofence-gated fields
  const { data: biz } = await db
    .from('businesses')
    .select('plan')
    .eq('owner_id', user.id)
    .single()
  const isPro = ['pro', 'premium'].includes(biz?.plan ?? '')

  const lat = latitude ? Number(latitude) : null
  const lng = longitude ? Number(longitude) : null
  if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)))
    return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 })
  if ((typeof name === 'string' && name.length > 80) || (typeof address === 'string' && address.length > 200) || (typeof geofence_message === 'string' && geofence_message.length > 160))
    return NextResponse.json({ error: 'Texto demasiado largo' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) update.name = name.trim()
  if (address !== undefined) update.address = typeof address === 'string' ? (address.trim() || null) : null
  if (category !== undefined) {
    if (category && !BUSINESS_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    }
    update.category = category || null
  }
  if (latitude !== undefined) update.latitude = lat
  if (longitude !== undefined) update.longitude = lng
  if (stamp_cooldown_seconds !== undefined && VALID_COOLDOWNS.includes(Number(stamp_cooldown_seconds))) {
    update.stamp_cooldown_seconds = Number(stamp_cooldown_seconds)
  }

  if (isPro) {
    if (timezone !== undefined && typeof timezone === 'string' && /^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(timezone)) update.timezone = timezone
    if (geofence_enabled !== undefined) update.geofence_enabled = Boolean(geofence_enabled)
    if (geofence_radius_m !== undefined && VALID_RADII.includes(Number(geofence_radius_m))) {
      update.geofence_radius_m = Number(geofence_radius_m)
    }
    if (geofence_message !== undefined) update.geofence_message = typeof geofence_message === 'string' ? (geofence_message.trim() || null) : null
    if (geofence_cooldown_h !== undefined && Number(geofence_cooldown_h) > 0) {
      update.geofence_cooldown_h = Number(geofence_cooldown_h)
    }
    if (quiet_hours_start !== undefined) {
      const h = Number(quiet_hours_start)
      if (h >= 0 && h <= 23) update.quiet_hours_start = h
    }
    if (quiet_hours_end !== undefined) {
      const h = Number(quiet_hours_end)
      if (h >= 0 && h <= 23) update.quiet_hours_end = h
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('businesses') as any)
    .update(update)
    .eq('owner_id', user.id)
    .select(`
      name, address, category, latitude, longitude, stamp_cooldown_seconds,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  return NextResponse.json(data)
}
