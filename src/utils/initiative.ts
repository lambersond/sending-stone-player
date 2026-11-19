import { atLeast } from '@/utils/module-version'
import type { FoundrySnapshot } from '@/types/foundry-settings'

/**
 * Whether the seat may roll initiative into this encounter from the app, the one rule for the
 * sheet's Initiative tile, the Combat tab's line to roll it and the app's check of the roll as it
 * comes (v0.46): the encounter chosen for its scene (`active`), before Begin Combat or after, where
 * one of the seat's own combatants, as `isSeats` finds them, has no initiative yet. The game takes
 * it into the one the Gamemaster has up, and from module 0.51.0 into any begun one; before Begin
 * Combat the app can't tell which is up, and the game refuses another as not in the combat. One no
 * scene has chosen, as one begun and then switched away from, is as no encounter at all; and so is
 * one its view marks as taking none from the app (`takesInitiative`, item 36).
 * @param isSeats - Whether a combatant is one the seat rolls for, as each reader finds them.
 */
export function waitsForInitiative<C extends { initiative: number | null }>(
  combat:
    | { active: boolean; takesInitiative?: false; combatants: readonly C[] }
    | undefined,
  isSeats: (combatant: C) => boolean,
): boolean {
  return (
    combat?.active === true &&
    combat.takesInitiative !== false &&
    combat.combatants.some(
      combatant => combatant.initiative === null && isSeats(combatant),
    )
  )
}

/** The module from which the game takes initiative from the app into any begun encounter. */
const INITIATIVE_ANYWHERE_FROM = [0, 51, 0] as const

/**
 * Does the campaign's module take an initiative from the app into any begun encounter its scene
 * has chosen, wherever the Gamemaster's Foundry is, as a hello says (its `module`, which the
 * campaign keeps in its `foundry` too): from module 0.51.0 (item 36). One before it takes one only
 * into the encounter the Gamemaster has up, which the app can't see.
 */
export function takesInitiativeAnywhere(
  module?: FoundrySnapshot['module'] | null,
): boolean {
  return atLeast(module?.version, INITIATIVE_ANYWHERE_FROM)
}
