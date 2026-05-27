'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { SidebarNav } from './sidebar-nav'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import type { ReactNode } from 'react'

interface MobileNavProps {
  businessName: string
  planContent: ReactNode
}

export function MobileNav({ planContent }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card">
        <Link href="/dashboard" className="text-lg font-black tracking-tight">
          fideli<span className="text-primary">tap</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-[hsl(var(--sidebar))] z-50 flex flex-col transform transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/30">
          <Link
            href="/dashboard"
            className="text-xl font-black tracking-tight text-[hsl(var(--sidebar-foreground))]"
            onClick={() => setOpen(false)}
          >
            fideli<span className="text-primary">tap</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>

        <div className="border-t border-border/30">
          {planContent}
        </div>
      </div>
    </>
  )
}
