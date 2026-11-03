import type { Character, TableSeat } from '@/types/character'
import type { CookbookPlace } from '@/types/cookbook'
import type { TableView } from '@/types/table'

/**
 * Who is at the sheet (#156): its player, by default, through the character's own API; or its
 * campaign's Gamemaster, through theirs, rolling as it.
 * @param given - The seat the page was given, if any.
 */
export function seatOf(
  given: TableSeat | undefined,
  characterId: string,
): TableSeat {
  return {
    role: given?.role ?? 'player',
    api: given?.api ?? `/api/characters/${characterId}`,
    key: given?.key ?? characterId,
  }
}

/**
 * The player's Magical Recipe Book (module 0.38.0): their own seat's alone, while their
 * character plays one of the campaign's, opened from the sheet's cog (round 0.39.0). The
 * Gamemaster's page passes neither action, so never offers it.
 * @param playing - Whether the character plays one of its campaign's characters.
 */
export function cookbookPlace(
  seat: TableSeat,
  character: Character,
  playing: boolean,
  make?: CookbookPlace['make'],
  revoke?: CookbookPlace['revoke'],
): CookbookPlace | undefined {
  return seat.role === 'player' && playing && make && revoke
    ? { characterId: character.id, make, revoke }
    : undefined
}

/**
 * The Character pane: the party sheets it may open, from the sheet's Inventory tab, or, with no
 * sheet, from under why there's none: either way the Character pane shows on a wide screen too.
 * So it does at a character, with no sheet, for its notes there, and with companions to switch
 * between (module 0.36.0). With a sheet or companions, every creature's pane throws its dice on
 * one renderer.
 * @param playing - Whether the character plays one of its campaign's characters.
 * @param switching - Whether the character has companions, each with a tab above the sheet.
 */
export function sheetPane(
  view: TableView,
  playing: boolean,
  switching: boolean,
) {
  const hasSheet = view.sheet !== undefined
  const parties =
    view.groups && view.groups.length > 0 ? view.groups : undefined
  return {
    parties,
    paneShown: hasSheet || parties !== undefined || playing || switching,
    sharedDice: hasSheet || switching,
  }
}
