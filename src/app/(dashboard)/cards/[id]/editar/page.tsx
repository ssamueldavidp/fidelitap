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
    .select('*')
    .eq('id', params.id)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .single()

  if (!card) notFound()

  return <CardEditor card={card} businessName={business.name} />
}
