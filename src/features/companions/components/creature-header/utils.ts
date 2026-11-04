import type { TableSheet } from '@/types/table'

/**
 * A creature's speeds other than its walking speed, for its Speed tile, as its sheet's speeds trait
 * lists them, each beginning in lower case: "Speed 5 ft", "Fly 30 ft" give "fly 30 ft". The first
 * is left out where it has a walking speed, which dnd5e lists first and the tile already shows.
 * None where it has no other.
 */
export function otherSpeeds(sheet: TableSheet): string[] {
  const values = sheet.traits.find(({ id }) => id === 'speeds')?.values ?? []
  const walks = (sheet.speed?.value ?? 0) > 0
  return (walks ? values.slice(1) : values).map(
    value => value.charAt(0).toLowerCase() + value.slice(1),
  )
}
