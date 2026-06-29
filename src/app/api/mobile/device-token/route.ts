import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { fcmToken, platform } = await req.json()
  if (!fcmToken || !platform) {
    return NextResponse.json({ error: 'fcmToken y platform requeridos' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('device_tokens')
    .upsert({ user_id: user.id, fcm_token: fcmToken, platform }, { onConflict: 'user_id,fcm_token' })

  if (error) return NextResponse.json({ error: 'Error al registrar token' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { fcmToken } = await req.json()
  if (!fcmToken) return NextResponse.json({ error: 'fcmToken requerido' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('device_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('fcm_token', fcmToken)

  if (error) return NextResponse.json({ error: 'Error al eliminar token' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
