import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mobileSupabaseClient, getMobileUser } from '@/lib/mobile/auth'
import { addStampForBusiness } from '@/lib/scanner/add-stamp'

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { uniqueCode } = await req.json()
  if (!uniqueCode) return NextResponse.json({ error: 'uniqueCode requerido' }, { status: 400 })

  const supabase = mobileSupabaseClient(req)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const result = await addStampForBusiness({
    serviceClient: createServiceClient(),
    businessId: business.id,
    businessName: business.name,
    businessPlan: business.plan,
    businessSubscriptionStatus: business.subscription_status,
    stampCooldownSeconds: business.stamp_cooldown_seconds,
    ownerId: user.id,
    uniqueCode,
  })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
