import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Public — same info the web /c/[slug] activation page shows before asking
// for the customer's data. No auth: this is what a business's printed QR
// (or the mobile scanner reading that same QR) resolves to.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const serviceClient = createServiceClient()

  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, name, benefit_description, stamps_required, design_config, business_id')
    .eq('slug', params.slug)
    .is('deleted_at', null)
    .eq('is_active', true)
    .single()

  if (!card) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const { data: business } = await serviceClient
    .from('businesses')
    .select('name')
    .eq('id', card.business_id)
    .single()

  const design = (card.design_config as Record<string, unknown>) ?? {}

  return NextResponse.json({
    slug: params.slug,
    loyalty_card_id: card.id,
    business_name: business?.name ?? '',
    card_name: card.name,
    benefit_description: card.benefit_description,
    stamps_required: card.stamps_required,
    stamp_icon: (design.stamp_icon as string) ?? '⭐',
    color: (design.color as string) ?? '#00C896',
    logo_url: (design.logo_url as string | null) ?? null,
  })
}
