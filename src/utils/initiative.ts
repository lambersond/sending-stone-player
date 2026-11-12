/**
 * Whether the seat may roll initiative into this encounter from the app, the one rule for the
 * sheet's Initiative tile, the Combat tab's line to roll it and the app's check of the roll as it
 * comes (v0.46): the encounter its Gamemaster's tracker shows (`active`), the only one the game
 * takes an initiative rolled from the sheet into, before Begin Combat or after, where one of the
 * seat's own combatants, as `isSeats` finds them, has no initiative yet. An encounter that isn't
 * the tracker's, such as one begun and then switched away from, is as no encounter at all.
 * @param isSeats - Whether a combatant is one the seat rolls for, as each reader finds them.
 */
export function waitsForInitiative<C extends { initiative: number | null }>(
  combat: { active: boolean; combatants: readonly C[] } | undefined,
  isSeats: (combatant: C) => boolean,
): boolean {
  return (
    combat?.active === true &&
    combat.combatants.some(
      combatant => combatant.initiative === null && isSeats(combatant),
    )
  )
}
