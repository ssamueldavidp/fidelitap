'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const dark = mounted && resolvedTheme === 'dark'

  return (
    <div className="flex rounded-full border border-border bg-muted p-1" role="group" aria-label="Tema">
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={mounted && !dark}
        aria-label="Tema claro"
        className={cn(
          'flex h-9 w-10 items-center justify-center rounded-full transition-colors',
          mounted && !dark ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        )}
      >
        <Sun size={18} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={dark}
        aria-label="Tema oscuro"
        className={cn(
          'flex h-9 w-10 items-center justify-center rounded-full transition-colors',
          dark ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        )}
      >
        <Moon size={18} />
      </button>
    </div>
  )
}
