import type { RollMode, SheetClass } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** A class by its name and levels, such as "Fighter 4", as its rows and the sheet's line say it. */
export function classLevels({
  name,
  levels,
}: Pick<SheetClass, 'name' | 'levels'>): string {
  return levels === null ? name : `${name} ${levels}`
}

/** Such as "Fighter 4 / Rogue 1 · Champion", or the level alone. */
export function classLine(sheet: TableSheet): string {
  if (sheet.classes.length === 0) {
    return sheet.level === null ? 'Character' : `Level ${sheet.level}`
  }
  const classes = sheet.classes.map(each => classLevels(each)).join(' / ')
  const subclasses = sheet.classes.flatMap(({ subclass }) =>
    subclass ? [subclass] : [],
  )
  return subclasses.length > 0
    ? `${classes} · ${subclasses.join(' / ')}`
    : classes
}

/** Advantage or disadvantage, as a roll's label says it. */
export function modeText(mode: RollMode): string {
  if (mode > 0) return ', with advantage'
  if (mode < 0) return ', with disadvantage'
  return ''
}
