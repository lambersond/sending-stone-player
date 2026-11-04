import type { SheetCastFrom, SheetSpellcasting } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** How many spells a search found, in words. */
export function foundOf(sections: TableSheet['spells']): string {
  const found = sections.reduce(
    (total, section) => total + section.spells.length,
    0,
  )
  if (found === 0) return 'No spells found'
  return found === 1 ? '1 spell found' : `${found} spells found`
}

/**
 * How many of a class's spells are prepared, of how many it may prepare, as dnd5e's sheet shows it
 * (module 0.42.1): "5 / 6", read "5 of 6", and past the limit as it is, "7 / 6", as dnd5e never
 * refuses one more; the count alone where the class may prepare none, as a homebrew one; nothing
 * where it counts none, as a 2014 Sorcerer, or the module doesn't say.
 */
export function preparedCount(
  prepared: SheetSpellcasting['classes'][number]['prepared'],
): { shown: string; said: string } | undefined {
  if (!prepared || (prepared.value === 0 && prepared.max === 0)) return
  const { value, max } = prepared
  return max > 0
    ? { shown: `${value} / ${max}`, said: `${value} of ${max}` }
    : { shown: String(value), said: String(value) }
}

/** The item a spell is cast from, such as "From Wand of Fireballs". */
export function fromNote(castFrom: SheetCastFrom): string {
  return `From ${castFrom.name}`
}

/** The facts there are of these, each with its label. */
export function factsOf(
  specifics: [string, string | null][],
): { label: string; value: string }[] {
  return specifics.flatMap(([label, value]) =>
    value ? [{ label, value }] : [],
  )
}
