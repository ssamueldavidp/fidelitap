'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CreditCard,
  Users,
  ScanLine,
  Image,
  Megaphone,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cards', label: 'Mis tarjetas', icon: CreditCard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/scanner', label: 'Escanear', icon: ScanLine },
  { href: '/poster', label: 'Plantilla', icon: Image },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Principal" className="flex-1 flex flex-col gap-1 px-4 py-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-colors',
              isActive
                ? 'bg-gradient-to-br from-[#0A9F5B] to-[#087A47] text-white shadow-[0_10px_22px_rgba(10,159,91,0.35)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon size={20} strokeWidth={1.9} />
            {label}
            {href === '/campaigns' && (
              <span
                className={cn(
                  'ml-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-wider',
                  isActive ? 'bg-white/20 text-white' : 'bg-tone-coral-soft text-tone-coral'
                )}
              >
                PRO
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
