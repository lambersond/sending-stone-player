import { hitPointsAvailable } from '@/utils/hit-points'
import { availableRollFeatures } from '@/utils/requests/availability'
import { seatRolls } from '@/utils/table-seat'
import type { SheetSeat } from '@/types/character'
import type { CombatSnapshot, ConnectedCharacter } from '@/types/sending-stone'
import type { CompanionView } from '@/types/table'

// What a companion's pane is shown, and may do, from its character's seat (module 0.36.0;
// src/db/companions.ts).

/**
 * The rolls a companion can have made, and what else the game does with them: the seat's, as its
 * character's would be, of the kinds the game takes for its companions, none while it's no longer
 * listed as its character's; and what the game asks of it only from module 0.41.0, which asks it
 * of companions (`companionPrompts`), as of no companion before.
 * @param connected - It's still listed as its character's.
 */
export function companionRolls(
  seat: SheetSeat,
  campaign: Parameters<typeof availableRollFeatures>[0] & {
    companionKinds: string[]
  },
  connected: boolean,
): ReturnType<typeof seatRolls> {
  const rolls = seatRolls(seat, campaign)
  const kinds = connected
    ? rolls.rollsToTable.filter(kind => campaign.companionKinds.includes(kind))
    : []
  const asked = campaign.rollFeatures.includes('companionPrompts')
  return {
    rollsToTable: kinds,
    rollFeatures:
      kinds.length > 0
        ? rolls.rollFeatures.filter(feature => asked || feature !== 'prompts')
        : [],
    ...(rolls.gm && { gm: rolls.gm }),
  }
}

/**
 * Whether the seat may set a companion's hit points and temporary hit points, from module 0.44.0:
 * its character's player's alone, never the Gamemaster's, while it's still listed as its
 * character's and the campaign lets its players, its module fetching; with the rolls off too.
 */
export function setsHitPoints(
  seat: SheetSeat,
  campaign: { hitPointsEnabled: boolean; bridgePolledAt: Date | null },
  connected: boolean,
  now: number,
): boolean {
  return (
    seat.role === 'player' && connected && hitPointsAvailable(campaign, now)
  )
}

/** The view's flag that its player may set its hit points (module 0.44.0), only where they may. */
export function hitPointsFlag(...args: Parameters<typeof setsHitPoints>): {
  hitPoints?: true
} {
  return setsHitPoints(...args) ? { hitPoints: true } : {}
}

/**
 * How a companion enters initiative (module 0.36.0): its own roll, or right after its character,
 * as the campaign's Gamemaster set it; and under the second, the character it follows in the
 * combat shown, by the roster's name: the first of its characters that's a combatant there, the
 * first with an initiative where any has one, as the game leads it. None where none of them is in
 * it, when it rolls its own.
 * @param of - The characters it's a companion of, in the order the module lists them.
 */
export function initiativeOf(
  mode: string,
  of: string[],
  combat: CombatSnapshot | undefined,
  roster: ConnectedCharacter[],
): CompanionView['initiative'] {
  if (mode !== 'after') return { mode: 'own' }
  const fighting = of.filter(id =>
    combat?.combatants.some(({ character }) => character === id),
  )
  const leader =
    fighting.find(id =>
      combat?.combatants.some(
        ({ character, initiative }) => character === id && initiative !== null,
      ),
    ) ?? fighting[0]
  const name = leader && roster.find(({ id }) => id === leader)?.name
  return name ? { mode: 'after', after: name } : { mode: 'after' }
}
