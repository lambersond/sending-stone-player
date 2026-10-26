'use client'

import { Link2Off, RefreshCw, Trash2, UserMinus } from 'lucide-react'
import { byId, PAGE_HEADING_ID, sheetLinkId } from './campaign-ids'
import { useCampaignChoice } from './campaign-index'
import { DANGER_BUTTON, ICON_BUTTON, QUIET_BUTTON } from './campaign-styles'
import { CopyField } from '@/components/copy-button'
import { ConfirmDialog } from '@/components/modal'
import { useToast } from '@/components/page-toast'

// The controls on a campaign's page (round 0.39.0), which the server draws: each confirms with a
// toast the page shows, beside its own confirmation, and where what it acted on is gone with the
// refreshed page, has focus go next where its Gamemaster can carry on. Each dialog opens on its
// Cancel.

/** The campaign's invite link, to copy, its button saying Copy, then Copied. */
export function InviteLink({ url }: Readonly<{ url: string }>) {
  const toast = useToast()
  return (
    <CopyField
      value={url}
      label='invite link'
      word
      // Its button already says Copied, so the toast isn't said again.
      onCopied={() => toast('Invite link copied', { announce: false })}
    />
  )
}

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

type CharacterControl = {
  campaignId: string
  campaignTitle: string
  /** The character's id in the campaign, as its sheet link has it. */
  actorId: string
  name: string
  player: string
  /** The player's character's own id. */
  characterId: string
}

/**
 * Has focus go to a character's sheet link once its row is drawn again without the control
 * pressed, gone with what it acted on.
 */
const toSheetLink = (campaignId: string, actorId: string) => () =>
  byId(sheetLinkId(campaignId, actorId))

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
