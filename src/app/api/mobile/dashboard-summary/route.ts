import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mobileSupabaseClient, getMobileUser } from '@/lib/mobile/auth'
import { getDashboardOverview } from '@/lib/dashboard/overview'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = mobileSupabaseClient(req)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const serviceClient = createServiceClient()
  const [{ data: metricsRaw }, overview] = await Promise.all([
    serviceClient.rpc('get_business_metrics', { p_business_id: business.id }),
    getDashboardOverview(business.id),
  ])

  const metrics = metricsRaw as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    total_clientes: number
    retencion_pct: number
  } | null

  return NextResponse.json({
    businessName: business.name,
    plan: business.plan,
    metrics,
    overview: {
      stampsToday: overview.stampsToday,
      stampsYesterday: overview.stampsYesterday,
      rewardsThisMonth: overview.rewardsThisMonth,
      weekTotal: overview.weekTotal,
      days: overview.days.map((d) => ({ label: d.label, count: d.count, isToday: d.isToday })),
      activity: overview.activity,
    },
  })
}
