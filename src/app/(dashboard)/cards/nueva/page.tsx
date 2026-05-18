import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardEditor } from '@/components/cards/card-editor'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'

export default async function NuevaCardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits = getPlanLimits(business.plan)
  if (isAtLimit(cardCount ?? 0, limits.maxCards)) redirect('/cards')

  return <CardEditor businessName={business.name} />
}
