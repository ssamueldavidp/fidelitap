import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { cancelCampaign } from '@/lib/push/campaigns'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient()
  const { data: business } = await db.from('businesses').select('id').eq('owner_id', user.id).single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const result = await cancelCampaign(db, business.id, params.id)
  if (result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
