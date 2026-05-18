import { NextResponse } from 'next/server'

// Apple Wallet webServiceURL push update stub — actual push notifications are Plan 6
export async function POST() {
  return NextResponse.json({}, { status: 200 })
}
