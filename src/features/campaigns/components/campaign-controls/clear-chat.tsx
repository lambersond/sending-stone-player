'use client'

import { MessageSquareX } from 'lucide-react'
import { DANGER_BUTTON } from '../../constants'
import { byId, chatHeadingId } from '../../utils/campaign-ids'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import { useToast } from '@/features/campaigns/hooks/use-toast'

/**
 * Clear chat, after asking (v0.44): the campaign's chat in the app goes for every player, dish
 * cards too, and Foundry's stays. Once it's gone, a toast says so and focus goes to the Chat
 * heading, the button gone with the messages.
 */
export function ClearChat({
  campaignId,
  title,
  clear,
}: Readonly<{
  campaignId: string
  title: string
  clear: () => Promise<void>
}>) {
  const toast = useToast()
  const { focusNext } = useCampaignChoice()
  return (
    <ConfirmDialog
      trigger={
        <>
          <MessageSquareX aria-hidden className='size-4' />
          Clear chat
        </>
      }
      triggerClassName={DANGER_BUTTON}
      title={`Clear ${title}’s chat?`}
      confirmLabel='Clear chat'
      onConfirm={async () => {
        focusNext(() => byId(chatHeadingId(campaignId)))
        await clear()
        toast(`${title}’s chat cleared`)
      }}
      danger
      focusCancel
    >
      <p>
        Every message in the app’s chat for this campaign goes, for every
        player: rolls, whispers and the cookbook’s dish cards too. Foundry’s
        chat log stays as it is, and so does each player’s list of the dishes
        they sent. This can’t be undone.
      </p>
    </ConfirmDialog>
  )
}
