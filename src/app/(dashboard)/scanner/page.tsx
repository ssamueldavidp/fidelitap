import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScannerClient } from './scanner-client'

export default async function ScannerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Escanear código QR</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Activa la cámara y escanea la tarjeta del cliente para agregar un sello.
        </p>
      </div>
      <ScannerClient />
    </div>
  )
}
