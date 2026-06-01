'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleLogout() {
    startTransition(async () => {
      await fetch('/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
    >
      <LogOut size={15} />
      <span>{isPending ? 'Saliendo...' : 'Cerrar sesión'}</span>
    </button>
  )
}
