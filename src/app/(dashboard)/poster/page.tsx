import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PosterEditor } from './poster-editor'

export default async function PosterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, poster_bg_color, poster_bg_image_url')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: cards } = await serviceClient
    .from('loyalty_cards')
    .select('id, name, slug, stamps_required, poster_reward_text')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (!cards || cards.length === 0) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-black text-white mb-1">Plantilla / Cartel</h1>
        <p className="text-slate-500 text-sm">
          Primero crea una tarjeta de sellos para poder generar tu cartel.
        </p>
      </div>
    )
  }

  const businessTyped = business as {
    id: string
    poster_bg_color: string
    poster_bg_image_url: string | null
  }

  const cardsTyped = cards as {
    id: string
    name: string
    slug: string
    stamps_required: number
    poster_reward_text: string | null
  }[]

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-white mb-1">Plantilla / Cartel</h1>
      <p className="text-slate-500 text-sm mb-8">
        Personaliza y descarga el cartel para imprimir en tu negocio.
      </p>

      <PosterEditor
        cards={cardsTyped}
        business={businessTyped}
        defaultCardId={cardsTyped[0].id}
      />
    </div>
  )
}
