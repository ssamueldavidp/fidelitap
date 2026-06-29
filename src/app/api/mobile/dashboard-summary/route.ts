import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mobileSupabaseClient, getMobileUser } from '@/lib/mobile/auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = mobileSupabaseClient(req)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const serviceClient = createServiceClient()
  const { data: metricsRaw } = await serviceClient.rpc('get_business_metrics', {
    p_business_id: business.id,
  })

  const metrics = metricsRaw as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    retencion_pct: number
  } | null

  return NextResponse.json({ businessName: business.name, metrics })
}
