'use client'

import { UserMinus } from 'lucide-react'
import { ICON_BUTTON } from '../../constants'
import { toSheetLink } from './utils'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import type { CharacterControl } from './types'

/**
 * Remove a player as their character, after asking: focus then goes to the character's sheet link.
 */
export function RemovePlayer({
  campaignId,
  campaignTitle,
  actorId,
  name,
  player,
  characterId,
  remove,
}: Readonly<
  CharacterControl & { remove: (characterId: string) => Promise<void> }
>) {
  const { focusNext } = useCampaignChoice()
  return (
    <ConfirmDialog
      trigger={<UserMinus aria-hidden className='size-4' />}
      triggerLabel={`Remove ${player} as ${name}`}
      triggerClassName={ICON_BUTTON}
      title={`Remove ${player} as ${name}?`}
      confirmLabel='Remove'
      onConfirm={async () => {
        // The button goes with the player it removes.
        focusNext(toSheetLink(campaignId, actorId))
        await remove(characterId)
      }}
      danger
      focusCancel
    >
      <p>
        {player} stops following {campaignTitle} as {name}, and {name} can be
        chosen again from the invite link.
      </p>
    </ConfirmDialog>
  )
}
