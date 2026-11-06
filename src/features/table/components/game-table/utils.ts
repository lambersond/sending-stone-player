import type { Tab } from '@/features/table/types'
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
 * between (module 0.36.0).
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
  }
}

/**
 * The rolls the game takes from the seat now, and what else it does with them: none while the
 * character isn't in its campaign's game.
 */
export function rollsInGame(view: TableView) {
  return view.connected
    ? { kinds: view.rollsToTable, features: view.rollFeatures }
    : {}
}

/**
 * The panel shown under the table's notices, where focus goes as one is dismissed, as the ids to
 * look for in turn: where the Character pane is in view, the sheet's panel of the creature it
 * shows, the character's own or a companion's, or that companion's own panel while it has no
 * sheet; on a phone or tablet showing combat or the chat, that pane.
 * @param characterInView - Whether the Character pane is in view: on a wide screen, or as its tab.
 * @param tab - The table's tab shown on a phone or tablet.
 * @param chosen - The creature the Character pane shows: 'self', or a companion's key.
 */
export function shownPanels(
  characterInView: boolean,
  tab: Tab,
  chosen: string,
): string[] {
  if (!characterInView) return [`${tab}-pane`]
  if (chosen === 'self') return ['sheet-panel']
  return [`creature-${chosen}-sheet-panel`, `creature-panel-${chosen}`]
}
