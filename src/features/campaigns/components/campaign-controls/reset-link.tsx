'use client'

import { RefreshCw } from 'lucide-react'
import { QUIET_BUTTON } from '../../constants'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useToast } from '@/features/campaigns/hooks/use-toast'

/** Reset link, after asking: focus returns to it, as it stays. */
export function ResetLink({
  title,
  reset,
}: Readonly<{ title: string; reset: () => Promise<void> }>) {
  const toast = useToast()
  return (
    <ConfirmDialog
      trigger={
        <>
          <RefreshCw aria-hidden className='size-4' />
          Reset link
        </>
      }
      triggerClassName={QUIET_BUTTON}
      title='Reset the invite link?'
      confirmLabel='Reset link'
      onConfirm={async () => {
        await reset()
        toast('A new invite link is ready')
      }}
      focusCancel
    >
      <p>
        The current link to {title} stops working and a new one takes its place.
        Players who already joined keep their characters.
      </p>
    </ConfirmDialog>
  )
}
