import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPushEligible } from '@/lib/push/send'
import { CampaignForm } from './campaign-form'
import { CancelCampaignButton } from './cancel-campaign-button'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  if (!isPushEligible(business.plan, business.subscription_status)) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-black text-white mb-2">Campañas push</h1>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-300 text-sm">
            Las campañas push están disponibles en los planes <strong className="text-white">Pro</strong> y{' '}
            <strong className="text-white">Premium</strong>.
          </p>
          <a
            href="/settings?tab=suscripcion"
            className="inline-block mt-4 bg-[#00C896] text-slate-900 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-[#00b386] transition-colors"
          >
            Ver planes
          </a>
        </div>
      </div>
    )
  }

  const { data: cards } = await supabase
    .from('loyalty_cards')
    .select('id, name')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const { data: campaigns } = await supabase
    .from('push_campaigns')
    .select('id, title, body, status, scheduled_at, sent_at, recipients_count, loyalty_card_id')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black text-white">Campañas push</h1>
        <p className="text-slate-500 text-sm mt-1">
          Envía promociones a los clientes que tienen tu tarjeta activa.
        </p>
      </div>

      <CampaignForm cards={cards ?? []} />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Historial</p>
        {(!campaigns || campaigns.length === 0) && (
          <p className="text-sm text-slate-600">Todavía no has enviado ninguna campaña.</p>
        )}
        {campaigns?.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{c.title}</p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  c.status === 'sent'
                    ? 'bg-green-950 text-green-400'
                    : c.status === 'scheduled'
                    ? 'bg-amber-950 text-amber-400'
                    : c.status === 'failed'
                    ? 'bg-red-950 text-red-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">{c.body}</p>
            <div className="flex items-center justify-between mt-1">
              {c.recipients_count !== null ? (
                <p className="text-[11px] text-slate-600">{c.recipients_count} destinatarios</p>
              ) : (
                <span />
              )}
              {c.status === 'scheduled' && <CancelCampaignButton campaignId={c.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
