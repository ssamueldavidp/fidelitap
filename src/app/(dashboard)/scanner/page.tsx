import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScannerClient } from './scanner-client'

export default async function ScannerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-black">Scanner de sellos</h1>
        <p className="text-xs text-slate-500 mt-0.5">{business?.name}</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-start pt-8 px-4">
        <ScannerClient />
      </div>
    </div>
  )
}
