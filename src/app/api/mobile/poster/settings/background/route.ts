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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido (multipart requerido)' }, { status: 400 })
  }
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'La imagen no debe superar 5MB' }, { status: 400 })

  const allowed = ['image/png', 'image/jpeg']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Solo se permiten PNG o JPEG' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${business.id}/bg.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from('poster-backgrounds')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[POST /api/mobile/poster/settings/background]', uploadError)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage.from('poster-backgrounds').getPublicUrl(path)

  return NextResponse.json({ public_url: urlData.publicUrl }, { status: 201 })
}
