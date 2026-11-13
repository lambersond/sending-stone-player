import { cache, Suspense } from 'react'
import { notFound } from 'next/navigation'
import { GmCharacterTable } from './gm-character-table'
import { LoadingStone } from '@/components/loading-stone/loading-stone'
import { getGmSeat } from '@/db/seats'
import { requireUser } from '@/lib/session'
import { gmCharacterPath } from '@/utils/seat-urls'
import type { Metadata } from 'next'

/**
 * The Gamemaster's seat at one of their campaign's characters' sheets (#156), once per request:
 * only the campaign's owner, and only for a character in its roster. Signed out, to the login
 * page and back here.
 */
const findSeat = cache(async (campaignId: string, actorId: string) => {
  const path = gmCharacterPath(campaignId, actorId)
  const user = await requireUser(path)
  return getGmSeat(user.id, campaignId, actorId)
})

export async function generateMetadata({
  params,
}: PageProps<'/campaigns/[id]/characters/[actor]'>): Promise<Metadata> {
  const { id, actor } = await params
  const seat = await findSeat(id, actor)
  return { title: seat?.name ?? 'Character' }
}

/**
 * A character's sheet as its campaign's Gamemaster sees it, without claiming it: its player's
 * view of the campaign, to roll from as the character, each roll marked as theirs. Anyone else, a
 * campaign of another's, or a character not in its roster is told only that the sheet isn't open
 * here, answered 404 before anything is sent. Then the loading stone while its table is read
 * (v0.48.0).
 */
export default async function GmCharacterPage({
  params,
}: PageProps<'/campaigns/[id]/characters/[actor]'>) {
  const { id, actor } = await params
  const seat = await findSeat(id, actor)
  if (!seat) notFound()

  return (
    <Suspense fallback={<LoadingStone />}>
      <GmCharacterTable seat={seat} campaignId={id} actorId={actor} />
    </Suspense>
  )
}
