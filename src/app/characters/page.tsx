import { Suspense } from 'react'
import { YourCharacters } from './your-characters'
import { LoadingStone } from '@/components/loading-stone/loading-stone'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your characters' }

/**
 * The signed-in player's characters. Signed out, to the login page, before anything is sent; then
 * the loading stone while their characters are read (v0.48.0).
 */
export default async function CharactersPage() {
  const user = await requireUser()

  return (
    <Suspense fallback={<LoadingStone />}>
      <YourCharacters user={user} />
    </Suspense>
  )
}
