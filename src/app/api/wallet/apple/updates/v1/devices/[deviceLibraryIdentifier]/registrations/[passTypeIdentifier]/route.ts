import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type Params = {
  deviceLibraryIdentifier: string
  passTypeIdentifier: string
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = params
  const passesUpdatedSince = request.nextUrl.searchParams.get('passesUpdatedSince')

  const supabase = createServiceClient()

  const { data: registrations } = await supabase
    .from('device_registrations')
    .select('serial_number')
    .eq('device_library_identifier', deviceLibraryIdentifier)
    .eq('pass_type_identifier', passTypeIdentifier)

  if (!registrations || registrations.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  const allSerials = registrations.map((r) => r.serial_number)

  if (!passesUpdatedSince) {
    return NextResponse.json({ serialNumbers: allSerials, lastUpdated: new Date().toISOString() })
  }

  const { data: updatedCards } = await supabase
    .from('customer_cards')
    .select('wallet_pass_serial')
    .in('wallet_pass_serial', allSerials)
    .gt('updated_at', passesUpdatedSince)

  const filteredSerials = (updatedCards ?? [])
    .map((c) => c.wallet_pass_serial)
    .filter((s): s is string => s !== null)

  if (filteredSerials.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    serialNumbers: filteredSerials,
    lastUpdated: new Date().toISOString(),
  })
}
