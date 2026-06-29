'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelCampaignAction } from './actions'

interface CancelCampaignButtonProps {
  campaignId: string
}

export function CancelCampaignButton({ campaignId }: CancelCampaignButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCancel() {
    if (!window.confirm('¿Cancelar este envío programado? Esta acción no se puede deshacer.')) {
      return
    }
    startTransition(async () => {
      await cancelCampaignAction(campaignId)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Cancelando...' : 'Cancelar envío'}
    </button>
  )
}
