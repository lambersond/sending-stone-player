'use client'

import { Trash2 } from 'lucide-react'
import { DANGER_BUTTON } from '../../constants'
import { byId, PAGE_HEADING_ID } from '../../utils/campaign-ids'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import { useToast } from '@/features/campaigns/hooks/use-toast'

/**
 * Delete campaign, after asking: once it's gone, a toast says so and focus goes to the page's
 * heading, the campaign's page gone with it; the address drops it as an id no longer listed.
 */
export function DeleteCampaign({
  title,
  remove,
}: Readonly<{ title: string; remove: () => Promise<void> }>) {
  const toast = useToast()
  const { focusNext } = useCampaignChoice()
  return (
    <ConfirmDialog
      trigger={
        <>
          <Trash2 aria-hidden className='size-4' />
          Delete campaign
        </>
      }
      triggerClassName={DANGER_BUTTON}
      title={`Delete ${title}?`}
      confirmLabel='Delete campaign'
      onConfirm={async () => {
        focusNext(() => byId(PAGE_HEADING_ID))
        await remove()
        toast(`${title} deleted`)
      }}
      danger
      focusCancel
    >
      <p>
        Its chat and combats are deleted, and its players&apos; characters stop
        following it. This can&apos;t be undone.
      </p>
      <p>
        To set it up again, you would need a new invite link for your players.
      </p>
    </ConfirmDialog>
  )
}
