import { ThemeToggle } from '@/components/ui/theme-toggle'

interface TopBarProps {
  businessName: string
}

export function TopBar({ businessName }: TopBarProps) {
  return (
    <div className="hidden md:flex h-14 border-b border-border items-center justify-between px-6 shrink-0">
      <p className="text-sm text-muted-foreground font-medium">{businessName}</p>
      <ThemeToggle />
    </div>
  )
}
