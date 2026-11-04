import type { TableSheet } from '@/types/table'

/**
 * Whether the sheet shows its death saving throws: dnd5e's sheet shows them while the character is
 * down, as do we; and while any are marked.
 */
export function isShowingDeathSaves(sheet: TableSheet): boolean {
  const { deathSaves } = sheet
  return (
    deathSaves !== null &&
    (sheet.hp?.value === 0 || deathSaves.success > 0 || deathSaves.failure > 0)
  )
}

/**
 * The first letters of a name's first two words, for a portrait that has no image or won't load;
 * unlike `@/utils/initials`, nothing for a name with none.
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}
