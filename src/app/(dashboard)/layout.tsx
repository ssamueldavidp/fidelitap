import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanUsage } from '@/components/dashboard/plan-usage'
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
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar))]">
        <Link
          href="/dashboard"
          className="px-6 h-14 flex items-center text-xl font-black tracking-tight border-b border-border/30 text-[hsl(var(--sidebar-foreground))]"
        >
          fideli<span className="text-primary">tap</span>
        </Link>

        <SidebarNav />

        <div className="border-t border-border/30">
          <PlanUsage businessId={business.id} plan={business.plan} />
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav (includes hamburger) */}
        <MobileNav
          businessName={business.name}
          planContent={<PlanUsage businessId={business.id} plan={business.plan} />}
        />
        {/* Desktop top bar */}
        <TopBar businessName={business.name} />
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
