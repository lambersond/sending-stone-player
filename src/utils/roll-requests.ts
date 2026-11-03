import {
  diceTakenAway,
  modifiedDice,
  unmaximizable,
} from '@/utils/damage-modifiers'
import { matchesPlanned } from '@/utils/requests/check-linked'
import { allItems } from '@/utils/sheet-texts'
import type { RollRequestInput } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  DamagePreview,
  SheetUses,
} from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/requests/types'

/**
 * Is this combatant the seat's own: its character, or from module 0.36.0 the companion the seat is
 * at, which the module marks by its key?
 */
export function isSeatCombatant(
  combatant: Pick<
    CombatSnapshot['combatants'][number],
    'character' | 'companion'
  >,
  actorId: string,
): boolean {
  return combatant.character === actorId || combatant.companion === actorId
}

/**
 * Every count of uses the sheet shows: its features', items', spells' and actions', each of their
 * activities', and its favorites', a resource's among them.
 */
export function sheetUses(sheet: CharacterSheet): SheetUses[] {
  const rows: {
    uses?: SheetUses | null
    activities?: { uses?: SheetUses | null }[]
  }[] = [
    ...sheet.features.flatMap(section => section.features),
    ...allItems(sheet),
    ...sheet.spells.flatMap(section => section.spells),
    ...sheet.actions.flatMap(section => section.actions),
    ...sheet.favorites.flatMap(favorite =>
      favorite.type === 'activity' || favorite.type === 'resource'
        ? [favorite]
        : [],
    ),
  ]
  return rows.flatMap(row => [
    ...(row.uses ? [row.uses] : []),
    ...(row.activities ?? []).flatMap(({ uses }) => (uses ? [uses] : [])),
  ])
}

/**
 * Are damage's dice those the game said it throws, in order, each die's first throw, changed as
 * the player chose, if they did, never at its highest where it takes a die away, or a die explodes
 * or is rerolled on its highest face; and is each kind of damage chosen one its roll offers? For an
 * attack's or a use's damage, and from module 0.36.0 an action's on its own.
 */
export function checkDamageDice(
  input: RollRequestInput,
  damage: DamagePreview,
): RollRefusal | undefined {
  // Never at its highest where it takes a die away, nor where a die explodes, or is rerolled on its
  // highest face, whose highest isn't known.
  if (
    input.modifiers?.maximize &&
    (diceTakenAway(damage) || unmaximizable(damage))
  ) {
    return 'dice'
  }
  const planned = modifiedDice(damage, input.modifiers)
  if (!planned || !matchesPlanned(input, planned)) return 'dice'
  const types = input.types ?? []
  const offered =
    types.length <= damage.rolls.length &&
    types.every(
      (type, index) =>
        type === null ||
        (damage.rolls[index].types ?? []).some(({ key }) => key === type),
    )
  return offered ? undefined : 'type'
}
