import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CardEditor } from '@/components/cards/card-editor'

export default async function EditarCardPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('*, card_rewards(id, stamps_required, reward_label, color, sort_order)')
    .eq('id', params.id)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('sort_order', { referencedTable: 'card_rewards', ascending: true })
    .single()

  if (!card) notFound()

  const { card_rewards, ...cardFields } = card
  return <CardEditor card={cardFields} existingRewards={card_rewards} businessName={business.name} />
}
