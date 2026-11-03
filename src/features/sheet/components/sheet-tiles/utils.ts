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
