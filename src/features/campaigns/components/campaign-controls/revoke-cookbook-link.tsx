'use client'

import { Link2Off } from 'lucide-react'
import { ICON_BUTTON } from '../../constants'
import { toSheetLink } from './utils'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import type { CharacterControl } from './types'

/** Revoke a player's cookbook link to their character, after asking (module 0.38.0). */
export function RevokeCookbookLink({
  campaignId,
  campaignTitle,
  actorId,
  name,
  player,
  characterId,
  revoke,
}: Readonly<
  CharacterControl & { revoke: (characterId: string) => Promise<void> }
>) {
  const { focusNext } = useCampaignChoice()
  return (
    <ConfirmDialog
      trigger={<Link2Off aria-hidden className='size-4' />}
      triggerLabel={`Revoke ${player}’s cookbook link for ${name}`}
      triggerClassName={ICON_BUTTON}
      title={`Revoke ${player}’s cookbook link for ${name}?`}
      confirmLabel='Revoke link'
      onConfirm={async () => {
        // The button goes with the link it revokes.
        focusNext(toSheetLink(campaignId, actorId))
        await revoke(characterId)
      }}
      danger
      focusCancel
    >
      <p>
        Dishes from {player}’s Magical Recipe Book stop reaching {campaignTitle}{' '}
        until they make a new link code.
      </p>
    </ConfirmDialog>
  )
}
