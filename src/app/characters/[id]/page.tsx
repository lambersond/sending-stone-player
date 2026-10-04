import { cache } from 'react'
import { notFound } from 'next/navigation'
import { chooseActor } from '../actions'
import { GameTable } from '@/components/game-table'
import { getCampaignChoice } from '@/db/campaigns'
import { getCharacter } from '@/db/characters'
import { getTableView } from '@/db/table'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

type Props = PageProps<'/characters/[id]'>

const findCharacter = cache(async (characterId: string) => {
  const user = await requireUser()
  return getCharacter(user.id, characterId)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const character = await findCharacter(id)
  return { title: character?.name ?? 'Character' }
}

export default async function CharacterPage({ params }: Props) {
  const { id } = await params
  const character = await findCharacter(id)
  if (!character) notFound()

  const user = await requireUser()
  // A character in a campaign but not yet one of its characters chooses which it is.
  const { campaignId, actorId } = character
  const [view, choice] = await Promise.all([
    getTableView(character),
    campaignId && !actorId
      ? getCampaignChoice(campaignId, user.id, character.id)
      : undefined,
  ])
  return (
    <GameTable
      character={character}
      initialView={view}
      choice={choice}
      chooseActor={chooseActor.bind(undefined, character.id)}
    />
  )
}
