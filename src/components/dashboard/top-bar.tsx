import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LogoutButton } from './logout-button'

interface TopBarProps {
  businessName: string
  userEmail: string
}

export function TopBar({ businessName, userEmail }: TopBarProps) {
  return (
    <div className="hidden md:flex h-14 border-b border-border items-center justify-between px-6 shrink-0">
      <p className="text-sm text-muted-foreground font-medium">{businessName}</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground/60 truncate max-w-[180px]">{userEmail}</span>
        <ThemeToggle />
        <LogoutButton />
      </div>
    </div>
  )
}
