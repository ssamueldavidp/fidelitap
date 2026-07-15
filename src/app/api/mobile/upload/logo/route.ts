import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business, error: bizError } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (bizError || !business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Solo JPEG, PNG o WebP' }, { status: 400 })

  if (file.size > 2 * 1024 * 1024)
    return NextResponse.json({ error: 'Máximo 2 MB' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${business.id}/logo.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from('card-logos')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[POST /api/mobile/upload/logo]', uploadError)
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage.from('card-logos').getPublicUrl(path)

  return NextResponse.json({ public_url: urlData.publicUrl }, { status: 201 })
}
