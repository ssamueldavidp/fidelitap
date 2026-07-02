import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find customer linked to this auth user
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id' as any, user.id)
    .single();

  if (!customer) {
    return NextResponse.json({ cards: [] });
  }

  const { data: cards } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      is_complete,
      loyalty_cards (
        name,
        stamps_required,
        benefit_description,
        businesses (
          name,
          lat,
          lng,
          geo_radius_m
        )
      )
    `)
    .eq('customer_id', customer.id)
    .eq('is_complete', false);

  const result = (cards ?? [])
    .filter(card => {
      const lc = card.loyalty_cards as any;
      const biz = lc?.businesses as any;
      return biz?.lat != null && biz?.lng != null;
    })
    .map(card => {
      const lc = card.loyalty_cards as any;
      const biz = lc?.businesses as any;
      return {
        id: card.id,
        businessName: biz.name as string,
        lat: biz.lat as number,
        lng: biz.lng as number,
        radius: (biz.geo_radius_m ?? 200) as number,
        stampsLeft: (lc.stamps_required as number) - card.current_stamps,
        benefitDescription: lc.benefit_description as string,
      };
    });

  return NextResponse.json({ cards: result });
}
