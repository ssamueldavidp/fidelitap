/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error('[mobile/cards auth]', authError.message);
  if (!user) redirect('/app/login');

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('auth_user_id' as any, user.id)
    .single();

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 gap-4">
        <p className="text-gray-500 text-center">
          No tienes tarjetas activadas aún. Escanea el QR de un negocio para empezar.
        </p>
      </div>
    );
  }

  const { data: cards } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      is_complete,
      times_completed,
      loyalty_cards (
        id, name, stamps_required, benefit_description,
        businesses ( name )
      )
    `)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const validCards = (cards ?? []).filter(card => card.loyalty_cards != null);

  return (
    <div className="flex flex-col px-4 py-8 gap-4">
      <h1 className="text-xl font-bold px-2">Hola, {customer.name?.split(' ')[0]} 👋</h1>
      <h2 className="text-sm text-gray-500 px-2">Tus tarjetas de fidelización</h2>

      {validCards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-gray-400 text-center text-sm">
            Aún no tienes tarjetas activas. Escanea el QR de un negocio para empezar.
          </p>
        </div>
      )}

      {validCards.map(card => {
        const lc = card.loyalty_cards as any;
        const business = lc?.businesses as any;
        const pct = lc.stamps_required > 0
          ? Math.round((card.current_stamps / lc.stamps_required) * 100)
          : 0;

        return (
          <Link key={card.id} href={`/app/cards/${card.id}`}>
            <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3 active:scale-95 transition-transform">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{business?.name}</p>
                  <p className="text-xs text-gray-400">{lc.name}</p>
                </div>
                {card.is_complete && (
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                    Premio listo 🎉
                  </span>
                )}
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <p className="text-xs text-gray-500">
                {card.current_stamps} / {lc.stamps_required} sellos
                {!card.is_complete && ` — te faltan ${lc.stamps_required - card.current_stamps} para: ${lc.benefit_description}`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
