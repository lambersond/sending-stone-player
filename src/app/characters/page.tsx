import { Suspense } from 'react'
import { CharacterChoices } from './character-choices'
import { YourCharacters } from './your-characters'
import { CharacterListSkeleton } from '@/features/characters/components/character-list/character-list-skeleton'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your characters' }

/**
 * The signed-in player's characters. Signed out, to the login page, before anything is sent; then
 * the page at once, its characters' outline shimmering while they're read (v0.48.0).
 */
export default async function CharactersPage() {
  const user = await requireUser()

  return (
    <YourCharacters user={user}>
      <Suspense fallback={<CharacterListSkeleton />}>
        <CharacterChoices userId={user.id} />
      </Suspense>
    </YourCharacters>
  )
}
