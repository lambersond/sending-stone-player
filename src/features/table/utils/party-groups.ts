import type { TableGroup } from '@/types/party'

/** Is this the same group, as listed, as the one kept? */
export function sameGroup(
  group: TableGroup,
  kept: TableGroup | undefined,
): boolean {
  return (
    group.id === kept?.id &&
    group.name === kept.name &&
    group.primary === kept.primary &&
    group.portrait === kept.portrait
  )
}
