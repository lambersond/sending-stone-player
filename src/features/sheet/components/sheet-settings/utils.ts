import type { SheetSettingsProps } from './types'

/**
 * What Damage on its own does, beneath its switch: that Send to the table must be on first, while
 * it's off; else where it goes, and for whom to apply; and from module 0.41.0, where the game takes
 * its choices, that they're made as it's rolled (round 0.41.0 §2.4.3).
 * @param gm - At the Gamemaster's seat, who applies it.
 */
export function aloneHint(
  game: string,
  gm: boolean,
  { disabled, choices }: NonNullable<SheetSettingsProps['alone']>,
): string {
  if (disabled) return 'Turn on Send to the table first.'
  const goes = `Damage you roll goes to ${game} with no attack or saving throw made there, for ${gm ? 'you' : 'your Gamemaster'} to apply.`
  return choices
    ? `${goes} You choose a spell’s level, a weapon’s mode and its ammunition as you roll, and whether to spend what it uses.`
    : goes
}
