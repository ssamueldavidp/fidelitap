import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { ActivateForm } from './activate-form'
import type { CardDesignConfig } from '@/types/database'
import { resolveStorageUrl } from '@/lib/storage-url'

export default async function CardActivationPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = await createClient()

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, name, benefit_description, stamps_required, design_config, business_id')
    .eq('slug', params.slug)
    .is('deleted_at', null)
    .eq('is_active', true)
    .single()

  if (!card) notFound()

  const { data: business } = await supabase
    .from('businesses')
    .select('name, plan, subscription_status')
    .eq('id', card.business_id)
    .single()

  const design = card.design_config as unknown as CardDesignConfig
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'}/c/${params.slug}`

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-[#00C896] text-xs font-bold uppercase tracking-widest mb-1">
            {business?.name}
          </p>
          <h1 className="text-2xl font-black">{card.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{card.benefit_description}</p>
        </div>

        {/* Card Preview */}
        <WalletPreview
          businessName={business?.name ?? ''}
          name={card.name}
          benefitDescription={card.benefit_description}
          stampsRequired={card.stamps_required}
          stampIcon={design.stamp_icon ?? '⭐'}
          color={design.color ?? '#00C896'}
          cardStyle={design.style ?? 'clean'}
          bgMode={design.bg_mode ?? 'light'}
          bgType={design.bg_type === 'image' ? 'image' : 'solid'}
          bgImageUrl={resolveStorageUrl(design.bg_image_url)}
          logoUrl={resolveStorageUrl(design.logo_url) ?? null}
          filledStamps={0}
        />

        {/* Form */}
        <ActivateForm
          loyaltyCardId={card.id}
          businessId={card.business_id}
          shareUrl={shareUrl}
          businessPlan={business?.plan ?? 'free'}
          businessSubscriptionStatus={business?.subscription_status ?? 'canceled'}
        />
      </div>
    </div>
  )
}
