import { cache } from 'react'
import { notFound } from 'next/navigation'
import { GameTable } from '@/components/game-table'
import { LISTENER_PATH } from '@/constants/sending-stone'
import { getCharacter } from '@/db/characters'
import { getTableView } from '@/db/table'
import { appOrigin } from '@/lib/app-origin'
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

  const [view, origin] = await Promise.all([
    getTableView(character),
    appOrigin(),
  ])
  return (
    <GameTable
      character={character}
      initialView={view}
      listenerUrl={`${origin}${LISTENER_PATH}`}
    />
  )
}
