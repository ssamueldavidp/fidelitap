import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const cardId = req.nextUrl.searchParams.get('card_id') ?? undefined

  const { data, error } = await serviceClient.rpc('get_customers_list', {
    p_business_id: business.id,
    ...(cardId ? { p_card_id: cardId } : {}),
  })

  if (error) return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
