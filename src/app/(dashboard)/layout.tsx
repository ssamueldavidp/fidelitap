import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanUsage } from '@/components/dashboard/plan-usage'
import { Logo } from '@/components/ui/logo'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileNav } from '@/components/dashboard/mobile-nav'

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
    .select('id, name, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[272px] shrink-0 flex-col gap-5 border-r border-border bg-[hsl(var(--sidebar))] px-0 py-6">
        <Link href="/dashboard" aria-label="Fidelitap, inicio" className="px-6">
          <Logo />
        </Link>

        <SidebarNav />

        <div className="mt-auto px-4">
          <PlanUsage businessId={business.id} plan={business.plan} />
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav (includes hamburger) */}
        <MobileNav
          businessName={business.name}
          userEmail={user.email ?? ''}
          planContent={<PlanUsage businessId={business.id} plan={business.plan} />}
        />
        {/* Desktop top bar */}
        <TopBar businessName={business.name} userEmail={user.email ?? ''} />
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
