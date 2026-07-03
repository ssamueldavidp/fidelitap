/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { lat, lng, geo_radius_m } = body as {
    lat: number | null;
    lng: number | null;
    geo_radius_m?: number;
  };

  // Validate: either both lat+lng are set, or both are null (clear location)
  if (lat !== null && lng !== null) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
  }

  const radius = typeof geo_radius_m === 'number' && geo_radius_m > 0 ? geo_radius_m : 200;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('businesses')
    .update({ lat, lng, geo_radius_m: radius } as any)
    .eq('owner_id', user.id);

  if (error) {
    console.error('[businesses/location PATCH]', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
