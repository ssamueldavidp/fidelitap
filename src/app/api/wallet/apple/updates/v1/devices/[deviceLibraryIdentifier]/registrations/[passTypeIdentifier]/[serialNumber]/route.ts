import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateAppleWebServiceAuth } from '@/lib/wallet/apple-webservice-auth'

type Params = {
  deviceLibraryIdentifier: string
  passTypeIdentifier: string
  serialNumber: string
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = params
  const auth = await validateAppleWebServiceAuth(request, serialNumber)
  if (!auth.valid) return new NextResponse(null, { status: 401 })

  const body = await request.json() as { pushToken?: string }
  if (!body.pushToken) return new NextResponse(null, { status: 400 })

  const supabase = createServiceClient()

  const { error } = await supabase.from('device_registrations').upsert(
    {
      device_library_identifier: deviceLibraryIdentifier,
      push_token: body.pushToken,
      pass_type_identifier: passTypeIdentifier,
      serial_number: serialNumber,
    },
    { onConflict: 'device_library_identifier,pass_type_identifier,serial_number' }
  )

  if (error) return new NextResponse(null, { status: 500 })

  return new NextResponse(null, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = params
  const auth = await validateAppleWebServiceAuth(request, serialNumber)
  if (!auth.valid) return new NextResponse(null, { status: 401 })

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('device_registrations')
    .delete()
    .eq('device_library_identifier', deviceLibraryIdentifier)
    .eq('pass_type_identifier', passTypeIdentifier)
    .eq('serial_number', serialNumber)

  if (error) {
    console.error('device_registrations delete error:', error)
  }

  return new NextResponse(null, { status: 200 })
}
