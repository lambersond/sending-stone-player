import { cache } from 'react'
import { notFound } from 'next/navigation'
import { GameTable } from '@/components/game-table'
import { getGmSeat } from '@/db/seats'
import { getTableView } from '@/db/table'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

type Props = PageProps<'/campaigns/[id]/characters/[actor]'>

/**
 * The Gamemaster's seat at one of their campaign's characters' sheets (#156), once per request:
 * only the campaign's owner, and only for a character in its roster. Signed out, to the login
 * page and back here.
 */
const findSeat = cache(async (campaignId: string, actorId: string) => {
  const path = `/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(actorId)}`
  const user = await requireUser(path)
  return getGmSeat(user.id, campaignId, actorId)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, actor } = await params
  const seat = await findSeat(id, actor)
  return { title: seat?.name ?? 'Character' }
}

/**
 * A character's sheet as its campaign's Gamemaster sees it, without claiming it: its player's
 * view of the campaign, to roll from as the character, each roll marked as theirs. Anyone else, a
 * campaign of another's, or a character not in its roster is told only that the sheet isn't open
 * here.
 */
export default async function GmCharacterPage({ params }: Props) {
  const { id, actor } = await params
  const seat = await findSeat(id, actor)
  if (!seat) notFound()

  const key = `gm:${id}:${actor}`
  const view = await getTableView(seat)
  return (
    <GameTable
      character={{
        id: key,
        name: seat.name,
        gameUrl: seat.gameUrl,
        campaignTitle: seat.campaignTitle,
        campaignId: seat.campaignId,
        actorId: seat.actorId,
      }}
      seat={{
        role: 'gm',
        api: `/api/campaigns/${encodeURIComponent(id)}/characters/${encodeURIComponent(actor)}`,
        key,
      }}
      initialView={view}
    />
  )
}
