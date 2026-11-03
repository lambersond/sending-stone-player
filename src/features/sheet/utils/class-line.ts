import type { TableSheet } from '@/types/table'

/** Such as "Fighter 4 / Rogue 1 · Champion", or the level alone. */
export function classLine(sheet: TableSheet): string {
  if (sheet.classes.length === 0) {
    return sheet.level === null ? 'Character' : `Level ${sheet.level}`
  }
  const classes = sheet.classes
    .map(({ name, levels }) => (levels === null ? name : `${name} ${levels}`))
    .join(' / ')
  const subclasses = sheet.classes.flatMap(({ subclass }) =>
    subclass ? [subclass] : [],
  )
  return subclasses.length > 0
    ? `${classes} · ${subclasses.join(' / ')}`
    : classes
}
