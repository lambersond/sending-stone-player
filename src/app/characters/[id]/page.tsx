import { cache, Suspense } from 'react'
import { notFound } from 'next/navigation'
import { CharacterTable } from './character-table'
import { getCharacter } from '@/db/characters'
import { GameTableSkeleton } from '@/features/table/components/game-table/game-table-skeleton'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

const findCharacter = cache(async (characterId: string) => {
  const user = await requireUser()
  return getCharacter(user.id, characterId)
})

export async function generateMetadata({
  params,
}: PageProps<'/characters/[id]'>): Promise<Metadata> {
  const { id } = await params
  const character = await findCharacter(id)
  return { title: character?.name ?? 'Character' }
}

/**
 * A player's character's table. Signed out, to the login page; a character not theirs, not
 * found: both before anything is sent. Then its table's outline, with its name, while the table is
 * read (v0.48.0).
 */
export default async function CharacterPage({
  params,
}: PageProps<'/characters/[id]'>) {
  const { id } = await params
  const character = await findCharacter(id)
  if (!character) notFound()

  const user = await requireUser()
  return (
    <Suspense fallback={<GameTableSkeleton name={character.name} />}>
      <CharacterTable character={character} userId={user.id} />
    </Suspense>
  )
}
