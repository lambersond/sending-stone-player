import clsx from 'clsx'

/**
 * The grid of a character's numbers in the card atop its sheet. The hit points and the hit dice
 * side by side, however wide the sheet; while the character is dying, the death saves on a row of
 * their own; then the numbers after them, two to a row on a phone, and four wider. Only where the
 * sheet is as wide as it gets do the numbers go on the row beside one size of hit die, eight to a
 * row: narrower, an eighth is too narrow for a Roll badge, temporary hit points or a speed of
 * 120 ft. Not beside more than one size, which is taller, nor while the death saves show, which
 * would leave half the next row empty. Without hit dice, the hit points and the numbers make one
 * row, or the hit points one of their own on a phone. The table's skeleton draws it too, for a
 * character with one size of hit die, not dying (v0.48.0).
 * @param pools - How many sizes of hit die the character has.
 * @param dying - Whether its death saves show.
 */
export function statsGrid(pools: number, dying: boolean): string {
  return clsx(
    'grid grid-cols-2 gap-2',
    pools > 0 ? '@lg:grid-cols-4' : '@lg:grid-cols-6',
    pools === 1 && !dying && '@5xl:grid-cols-8',
  )
}
