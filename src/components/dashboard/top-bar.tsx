import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LogoutButton } from './logout-button'

interface TopBarProps {
  businessName: string
  userEmail: string
}

export function TopBar({ businessName, userEmail }: TopBarProps) {
  return (
    <div className="hidden md:flex min-h-[84px] shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-8">
      <p className="truncate text-sm text-muted-foreground">{userEmail}</p>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-muted py-1.5 pl-1.5 pr-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#34D399] to-[#0A9F5B] font-display font-bold text-white">
            {businessName.trim().charAt(0).toUpperCase() || 'F'}
          </span>
          <span className="max-w-[160px] truncate text-sm font-bold">{businessName}</span>
        </div>
        <div className="w-40"><LogoutButton /></div>
      </div>
    </div>
  )
}
