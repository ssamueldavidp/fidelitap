/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.platform) {
    return NextResponse.json({ error: 'Missing token or platform' }, { status: 400 });
  }

  const { token, platform } = body as { token: string; platform: string };
  if (!['ios', 'android'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  if (typeof token !== 'string' || token.length === 0 || token.length > 1000) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const service = createServiceClient();

  // Find the customer linked to this auth user
  const { data: customer } = await service
    .from('customers')
    .select('id')
    .eq('auth_user_id' as any, user.id)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Upsert: if (customer_id, expo_token) already exists, update updated_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any)
    .from('device_tokens')
    .upsert(
      { customer_id: customer.id, expo_token: token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id,expo_token', ignoreDuplicates: false }
    );

  if (error) {
    console.error('[device-token POST]', error);
    return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: customer } = await service
    .from('customers')
    .select('id')
    .eq('auth_user_id' as any, user.id)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service as any)
    .from('device_tokens')
    .delete()
    .eq('customer_id', customer.id)
    .eq('expo_token', body.token);

  if (error) {
    console.error('[device-token DELETE]', error);
    return NextResponse.json({ error: 'Failed to unregister token' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
