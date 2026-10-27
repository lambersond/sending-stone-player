import { cache } from 'react'
import { notFound } from 'next/navigation'
import { PartyPage } from '@/components/party-sheet'
import { getCharacter } from '@/db/characters'
import { getGroupView, partySeat } from '@/db/party'
import { playerSeat } from '@/db/seats'
import { shapedRefusal } from '@/db/wild-shape'
import { requireUser } from '@/lib/session'
import type { RollRequestInput } from '@/types/roll'
import type { Metadata } from 'next'

type Props = PageProps<'/characters/[id]/party/[group]'>

/** A Take from the group into the character, as the move would be sent: no dice, its two ends. */
const takeFrom = (groupId: string, actorId: string): RollRequestInput => ({
  kind: 'transfer',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  transfer: { from: groupId, to: actorId },
})

/**
 * A party sheet of the character's campaign as its player sees it, once per request: only while
 * their Foundry user has Observer or Owner on the group. Signed out, to the login page and back.
 * And whether a Take into the character would wait until it's back in its own form, from module
 * 0.40.0, as the move itself would be asked, by its sheet as last sent.
 */
const findParty = cache(async (characterId: string, groupId: string) => {
  const path = `/characters/${encodeURIComponent(characterId)}/party/${encodeURIComponent(groupId)}`
  const user = await requireUser(path)
  const character = await getCharacter(user.id, characterId)
  if (!character) return
  const seat = playerSeat(character, user.id)
  const [view, shaped] = await Promise.all([
    getGroupView(partySeat(seat), groupId),
    character.actorId
      ? shapedRefusal(seat, takeFrom(groupId, character.actorId))
      : undefined,
  ])
  return view && { character, view, shaped: shaped !== undefined }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, group } = await params
  const found = await findParty(id, group)
  return { title: found?.view.group.name ?? 'Party' }
}

/**
 * A party's sheet as its own page (module 0.30.0), for a player whose Foundry user may see it:
 * its members, stash and description, as the side panel over their character's sheet shows it.
 * Anyone else, or a group not there, is told only that it isn't open here.
 */
export default async function CharacterPartyPage({ params }: Props) {
  const { id, group } = await params
  const found = await findParty(id, group)
  if (!found) notFound()

  const { character, view, shaped } = found
  const sheet = `/characters/${encodeURIComponent(character.id)}`
  return (
    <PartyPage
      api={`/api${sheet}/party/${encodeURIComponent(group)}`}
      role='player'
      initialView={view}
      back={{ href: sheet, label: `Back to ${character.name}` }}
      ownSheetHref={sheet}
      // Taken into the player's character, through its own API (module 0.31.0). Never while it's
      // transformed, as by Wild Shape (module 0.40.0), as on its table's party panel: its gear
      // isn't on its form, and every move from its seat waits until it's back, so the others
      // offered here with Take go too. One made after the page was opened is refused, as `shaped`.
      takeInto={
        character.actorId && !shaped
          ? {
              kind: 'own',
              actorId: character.actorId,
              name: character.name,
              api: `/api${sheet}`,
            }
          : undefined
      }
    />
  )
}
