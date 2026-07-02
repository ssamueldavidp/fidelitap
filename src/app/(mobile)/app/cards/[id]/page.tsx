import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import Image from 'next/image';

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/app/login');

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id' as any, user.id)
    .single();
  if (!customer) redirect('/app/login');

  const { data: card } = await supabase
    .from('customer_cards')
    .select(`
      id, unique_code, current_stamps, is_complete,
      apple_pass_url, google_pass_url,
      loyalty_cards (
        name, stamps_required, benefit_description,
        businesses ( name )
      )
    `)
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single();

  if (!card) notFound();

  const lc = card.loyalty_cards as any;
  const business = lc?.businesses as any;
  const qrDataUrl = await QRCode.toDataURL(card.unique_code, { width: 240, margin: 2 });

  const stamps = Array.from({ length: lc.stamps_required }, (_, i) => i < card.current_stamps);

  return (
    <div className="flex flex-col px-4 py-8 gap-6 items-center">
      <div className="w-full bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
        <p className="text-sm text-gray-400 uppercase tracking-wide">{business?.name}</p>
        <h1 className="text-lg font-bold text-center">{lc.name}</h1>

        {/* Progreso de sellos */}
        <div className="flex flex-wrap gap-2 justify-center">
          {stamps.map((filled, i) => (
            <span
              key={i}
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg
                ${filled ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 text-gray-300'}`}
            >
              {filled ? '★' : '☆'}
            </span>
          ))}
        </div>

        <p className="text-sm text-gray-500 text-center">
          {card.is_complete
            ? `¡Premio listo! Muestra este QR en caja para reclamar: ${lc.benefit_description}`
            : `Te faltan ${lc.stamps_required - card.current_stamps} sellos para: ${lc.benefit_description}`}
        </p>
      </div>

      {/* QR del cliente */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
        <p className="text-sm text-gray-500 font-medium">Muestra este código al cajero</p>
        <Image src={qrDataUrl} alt="Tu código QR" width={200} height={200} className="rounded-xl" unoptimized />
        <p className="text-xs text-gray-400">El negocio lo escanea para sumar tu sello</p>
      </div>

      {/* Botones de Wallet */}
      {(card.apple_pass_url || card.google_pass_url) && (
        <div className="w-full flex flex-col gap-3">
          {card.apple_pass_url && (
            <a
              href={card.apple_pass_url}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold text-center"
            >
              🎫 Agregar a Apple Wallet
            </a>
          )}
          {card.google_pass_url && (
            <a
              href={card.google_pass_url}
              className="w-full bg-[#1a73e8] text-white py-3 rounded-xl font-semibold text-center"
            >
              🎫 Agregar a Google Wallet
            </a>
          )}
        </div>
      )}
    </div>
  );
}
