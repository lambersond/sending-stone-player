import { getTableView } from '@/db/table'
import { GameTable } from '@/features/table/components/game-table/game-table'
import { gmCharacterApi } from '@/utils/seat-urls'
import type { SheetSeat } from '@/types/character'

/**
 * A character's table as its campaign's Gamemaster sees it (v0.48.0: read once the page has found
 * their seat at it, its outline shimmering until then).
 */
export async function GmCharacterTable({
  seat,
  campaignId,
  actorId,
}: Readonly<{ seat: SheetSeat; campaignId: string; actorId: string }>) {
  const key = `gm:${campaignId}:${actorId}`
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
        api: gmCharacterApi(campaignId, actorId),
        key,
      }}
      initialView={view}
    />
  )
}
