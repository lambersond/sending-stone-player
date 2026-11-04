import {
  gmPartyApi,
  gmPartyPath,
  partyApi as playerPartyApi,
  partyPath,
} from '@/utils/seat-urls'
import type { Character, TableSeat } from '@/types/character'

/**
 * Where a party sheet open at the table is read: through the player's character, or for the
 * Gamemaster's seat, through their campaign.
 */
export function partyApi(
  seat: TableSeat,
  character: Character,
  group = '',
): string {
  return seat.role === 'gm'
    ? gmPartyApi(character.campaignId ?? '', group)
    : playerPartyApi(character.id, group)
}

/** A party sheet's own page, as the player or the Gamemaster opens it. */
export function partyPage(
  seat: TableSeat,
  character: Character,
  group = '',
): string {
  return seat.role === 'gm'
    ? gmPartyPath(character.campaignId ?? '', group)
    : partyPath(character.id, group)
}
