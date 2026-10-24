import type { TableCompanion } from '@/types/table'

/*
 * The row of creatures above a character's sheet (module 0.36.0): its companions as the module
 * lists them, and those it no longer lists, kept until the player has seen they've gone; each one's
 * name, numbered where the row repeats it; and the tint of its initials.
 */

/** A companion in the row: listed now, or kept, marked gone, until it's been shown and left. */
export type RowCompanion = TableCompanion & { gone?: true }

/**
 * The companions the row shows: those listed now, in the module's order, unmarked; and each the
 * row showed before (`last`) that isn't listed now, nor dismissed, marked gone, kept right after
 * the creature it followed there, or first where it was first. So a companion the module stops
 * listing keeps its tab until the player has chosen it and then another; one listed again is
 * unmarked.
 * @param last - The row as it was.
 * @param listed - The companions the module lists now.
 * @param dismissed - The gone ones whose tabs have been shown and left, by key.
 */
export function companionRow(
  last: readonly RowCompanion[],
  listed: readonly TableCompanion[],
  dismissed: ReadonlySet<string>,
): RowCompanion[] {
  const row: RowCompanion[] = listed.map(companion => ({ ...companion }))
  const listedKeys = new Set(listed.map(({ key }) => key))
  for (const [index, companion] of last.entries()) {
    if (listedKeys.has(companion.key) || dismissed.has(companion.key)) continue
    // After the nearest creature before it that's still in the row; first where there's none.
    let at = 0
    for (let before = index - 1; before >= 0; before--) {
      const found = row.findIndex(({ key }) => key === last[before].key)
      if (found !== -1) {
        at = found + 1
        break
      }
    }
    row.splice(at, 0, { ...companion, gone: true })
  }
  return row
}

/**
 * Each creature's name as the row says it, and the numbers kept for the next time. A name the row
 * holds once is itself. Where it holds one more than once, each creature keeps the number it was
 * given before, and one with none takes the lowest from 1 that no other of that name holds, in the
 * row's order: so the first time "Bat 1", "Bat 2", and after that a number never moves to another
 * creature. A name held once again drops its number, so the last Bat left is "Bat".
 * @param row - The creatures in the row's order, by key and name.
 * @param kept - The numbers given before, by key.
 */
export function numberedNames(
  row: readonly { key: string; name: string }[],
  kept: ReadonlyMap<string, number>,
): { names: Map<string, string>; kept: Map<string, number> } {
  const byName = new Map<string, string[]>()
  for (const { key, name } of row) {
    byName.set(name, [...(byName.get(name) ?? []), key])
  }
  const numbers = new Map<string, number>()
  for (const keys of byName.values()) {
    if (keys.length < 2) continue
    const taken = new Set<number>()
    // Those numbered before keep their numbers, each once, should two have been given the same.
    for (const key of keys) {
      const number = kept.get(key)
      if (number === undefined || taken.has(number)) continue
      taken.add(number)
      numbers.set(key, number)
    }
    for (const key of keys) {
      if (numbers.has(key)) continue
      let number = 1
      while (taken.has(number)) number++
      taken.add(number)
      numbers.set(key, number)
    }
  }
  const names = new Map(
    row.map(({ key, name }) => {
      const number = numbers.get(key)
      return [key, number === undefined ? name : `${name} ${number}`]
    }),
  )
  return { names, kept: numbers }
}

/** The tints a companion's initials may take, as the prototype's: one by its name. */
const TINTS = [
  'bg-attack/15 text-attack-text',
  'bg-whisper/15 text-whisper',
  'bg-spell/15 text-spell-text',
  'bg-party/15 text-party',
] as const

/**
 * The tint of a companion's initials, by its name: the sum of its UTF-16 code units, modulo four.
 * So a creature keeps its tint, and two of one name share one.
 */
export function tintOf(name: string): (typeof TINTS)[number] {
  let sum = 0
  for (let index = 0; index < name.length; index++) {
    // Its UTF-16 code units, as the prototype sums them, not its code points.
    // eslint-disable-next-line unicorn/prefer-code-point
    sum += name.charCodeAt(index)
  }
  return TINTS[sum % TINTS.length]
}
