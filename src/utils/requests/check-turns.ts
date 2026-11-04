import { UNDO_TURN_WITHIN } from '@/constants/sending-stone'
import type { EndedTurn, RollRequestInput } from '@/types/roll'
import type { CombatSnapshot, CompanionEntry } from '@/types/sending-stone'
import type { RollRefusal, HeldEndTurn } from '@/utils/requests/types'

/**
 * Can the seat end this turn, from module 0.36.0, as the combat was last heard of: the turn the
 * page was shown, still the current one, of a started combat, and the seat's character's, or one of
 * its companions', by the campaign's stored list. Checked alone, with or without a sheet; the game
 * checks it again as it stands before it ends anything, since a turn can move on in between.
 * @param turn - The turn the page was shown: its combat, round and current combatant.
 * @param actorId - The seat's character: a companion's turn is ended from its character's page.
 * @param roster - The campaign's companions, as stored.
 * @returns Why not, or nothing when it can.
 */
export function checkEndTurn(
  turn: EndedTurn | undefined,
  combats: CombatSnapshot[],
  actorId: string,
  roster: CompanionEntry[],
): RollRefusal | undefined {
  const combat = turn && combats.find(({ id }) => id === turn.combatId)
  if (!turn || !combat) return 'not-in-combat'
  if (!combat.started) return 'not-started'
  // The page names the turn by its round and current combatant, so that a stale or second press
  // ends nothing more once the turn has moved on.
  if (combat.round !== turn.round || combat.combatantId !== turn.combatantId) {
    return 'moved'
  }
  // The page is never shown a hidden combatant as the current one.
  const current = combat.combatants.find(({ id }) => id === turn.combatantId)
  if (!current || current.hidden === true) return 'moved'
  return isTurnOf(current, actorId, roster) ? undefined : 'not-turn'
}

/**
 * Is this combatant's turn one the seat's character may end, or take back (module 0.36.0): the
 * character's own, or one of its companions', by the campaign's stored list. Not isSeatCombatant,
 * whose companion is a companion's own seat's: here it's any of those the list gives the character.
 */
function isTurnOf(
  combatant: Pick<
    CombatSnapshot['combatants'][number],
    'character' | 'companion'
  >,
  actorId: string,
  roster: CompanionEntry[],
): boolean {
  return (
    combatant.character === actorId ||
    roster.some(
      ({ key, of }) => key === combatant.companion && of.includes(actorId),
    )
  )
}

/**
 * Can the seat take back the turn this End Turn of its own ended, from module 0.36.0, as the combat
 * was last heard of: the End Turn the game said it made, a moment ago, in this combat; the combat
 * still started, and where that End Turn left it, the turn the page shows now, not hidden, and not
 * the ended turn back already; and the ended turn's combatant still in it, shown, and still the
 * character's or one of its companions'. The game checks it all again against its own memory of
 * that End Turn, and the combat as it stands, before it moves anything back.
 * @param turn - The turn the page shows now, which that End Turn left: its combat, round and
 *   current combatant.
 * @param ended - The End Turn named, read as this seat's and this character's only; none where it
 *   isn't.
 * @param actorId - The seat's character, whose End Turn it was, for a companion's turn too.
 * @param roster - The campaign's companions, as stored.
 * @param now - When it's asked, in milliseconds.
 * @returns Why not, or nothing when it can.
 */
export function checkUndoTurn(
  turn: EndedTurn | undefined,
  ended: HeldEndTurn | null | undefined,
  combats: CombatSnapshot[],
  actorId: string,
  roster: CompanionEntry[],
  now: number,
): RollRefusal | undefined {
  // Only an End Turn the game made, and only for a moment after, as the toast offers it.
  const endedTurn = (ended?.payload as Partial<RollRequestInput> | undefined)
    ?.turn
  if (
    !turn ||
    !ended ||
    ended.status !== 'done' ||
    !ended.completedAt ||
    now - ended.completedAt.getTime() > UNDO_TURN_WITHIN ||
    !endedTurn ||
    endedTurn.combatId !== turn.combatId
  ) {
    return 'not-undoable'
  }
  const combat = combats.find(({ id }) => id === turn.combatId)
  if (!combat) return 'not-in-combat'
  if (!combat.started) return 'not-started'
  // The combat where that End Turn left it, as the page shows it: else it has moved on since, or
  // it's back on the ended turn already, and taking it back would move it somewhere else.
  if (combat.round !== turn.round || combat.combatantId !== turn.combatantId) {
    return 'moved'
  }
  const current = combat.combatants.find(({ id }) => id === turn.combatantId)
  if (!current || current.hidden === true) return 'moved'
  if (
    endedTurn.round === turn.round &&
    endedTurn.combatantId === turn.combatantId
  ) {
    return 'moved'
  }
  // The turn it ended: still in the combat, shown to the page, and still the seat's to end.
  const back = combat.combatants.find(({ id }) => id === endedTurn.combatantId)
  if (!back || back.hidden === true) return 'not-undoable'
  return isTurnOf(back, actorId, roster) ? undefined : 'not-turn'
}
