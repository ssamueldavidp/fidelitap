import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanUsage } from '@/components/dashboard/plan-usage'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/cards', label: 'Mis tarjetas', icon: '◉' },
  { href: '/customers', label: 'Clientes', icon: '◎' },
  { href: '/scanner', label: 'Escanear', icon: '⌻' },
  { href: '/poster', label: 'Plantilla', icon: '▤' },
  { href: '/settings', label: 'Ajustes', icon: '⚙' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col py-6">
        <Link href="/dashboard" className="px-6 pb-8 text-xl font-black tracking-tight">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <PlanUsage businessId={business.id} plan={business.plan} />
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
