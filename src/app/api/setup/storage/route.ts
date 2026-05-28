// ONE-TIME SETUP ROUTE — delete after running
// Creates the card-logos storage bucket in Supabase
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const SETUP_SECRET = process.env.SETUP_SECRET ?? ''

export async function POST(request: Request) {
  // Simple secret check so only you can run this
  const { secret } = await request.json().catch(() => ({ secret: '' }))
  if (!SETUP_SECRET || secret !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Create card-logos bucket
  const { data, error } = await supabase.storage.createBucket('card-logos', {
    public: true,
    fileSizeLimit: 2097152, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })

  if (error && !error.message.includes('already exists')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    bucket: data ?? 'already existed',
    message: 'card-logos bucket ready. Delete src/app/api/setup/ now.',
  })
}
