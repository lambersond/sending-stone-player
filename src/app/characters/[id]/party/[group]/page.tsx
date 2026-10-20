import { cache } from 'react'
import { notFound } from 'next/navigation'
import { PartyPage } from '@/components/party-sheet'
import { getCharacter } from '@/db/characters'
import { getGroupView, partySeat } from '@/db/party'
import { playerSeat } from '@/db/seats'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

type Props = PageProps<'/characters/[id]/party/[group]'>

/**
 * A party sheet of the character's campaign as its player sees it, once per request: only while
 * their Foundry user has Observer or Owner on the group. Signed out, to the login page and back.
 */
const findParty = cache(async (characterId: string, groupId: string) => {
  const path = `/characters/${encodeURIComponent(characterId)}/party/${encodeURIComponent(groupId)}`
  const user = await requireUser(path)
  const character = await getCharacter(user.id, characterId)
  if (!character) return
  const view = await getGroupView(
    partySeat(playerSeat(character, user.id)),
    groupId,
  )
  return view && { character, view }
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

  const { character, view } = found
  const sheet = `/characters/${encodeURIComponent(character.id)}`
  return (
    <PartyPage
      api={`/api${sheet}/party/${encodeURIComponent(group)}`}
      role='player'
      initialView={view}
      back={{ href: sheet, label: `Back to ${character.name}` }}
      ownSheetHref={sheet}
      // Taken into the player's character, through its own API (module 0.31.0).
      takeInto={
        character.actorId
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
