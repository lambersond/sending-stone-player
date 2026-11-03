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
  const id = encodeURIComponent(group)
  return seat.role === 'gm'
    ? `/api/campaigns/${encodeURIComponent(character.campaignId ?? '')}/party/${id}`
    : `/api/characters/${encodeURIComponent(character.id)}/party/${id}`
}

/** A party sheet's own page, as the player or the Gamemaster opens it. */
export function partyPage(
  seat: TableSeat,
  character: Character,
  group = '',
): string {
  const id = encodeURIComponent(group)
  return seat.role === 'gm'
    ? `/campaigns/${encodeURIComponent(character.campaignId ?? '')}/party/${id}`
    : `/characters/${encodeURIComponent(character.id)}/party/${id}`
}
