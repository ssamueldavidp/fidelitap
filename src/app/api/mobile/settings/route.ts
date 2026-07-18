import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]
const VALID_RADII = [100, 300, 500]

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('businesses') as any)
    .select(`
      name, address, latitude, longitude, stamp_cooldown_seconds, plan, email,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .eq('owner_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const {
    name, address, latitude, longitude, stamp_cooldown_seconds,
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

  const update: Record<string, unknown> = {}
  if (name?.trim()) update.name = name.trim()
  if (address !== undefined) update.address = address || null
  if (latitude !== undefined) update.latitude = latitude ? Number(latitude) : null
  if (longitude !== undefined) update.longitude = longitude ? Number(longitude) : null
  if (stamp_cooldown_seconds !== undefined && VALID_COOLDOWNS.includes(Number(stamp_cooldown_seconds))) {
    update.stamp_cooldown_seconds = Number(stamp_cooldown_seconds)
  }

  if (isPro) {
    if (timezone !== undefined) update.timezone = String(timezone)
    if (geofence_enabled !== undefined) update.geofence_enabled = Boolean(geofence_enabled)
    if (geofence_radius_m !== undefined && VALID_RADII.includes(Number(geofence_radius_m))) {
      update.geofence_radius_m = Number(geofence_radius_m)
    }
    if (geofence_message !== undefined) update.geofence_message = geofence_message || null
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
      name, address, latitude, longitude, stamp_cooldown_seconds,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  return NextResponse.json(data)
}
