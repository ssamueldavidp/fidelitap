import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mobileSupabaseClient, getMobileUser } from '@/lib/mobile/auth'
import { claimRewardForBusiness } from '@/lib/scanner/add-stamp'

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { customerCardId } = await req.json()
  if (!customerCardId) return NextResponse.json({ error: 'customerCardId requerido' }, { status: 400 })

  const supabase = mobileSupabaseClient(req)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const result = await claimRewardForBusiness(createServiceClient(), business.id, user.id, customerCardId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
