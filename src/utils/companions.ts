import { COMPANION_KEY } from '@/constants/sending-stone'
import { portraitUrl } from '@/utils/table-view'
import type { CompanionEntry } from '@/types/sending-stone'
import type { TableCompanion } from '@/types/table'

/*
 * A campaign's characters' companions, from module 0.36.0, as the campaign keeps them: the
 * creatures each character summoned in Foundry and the NPCs its player owns there, each with the
 * campaign characters it's a companion of. Never a character's roster entry.
 */

const KINDS: ReadonlySet<string> = new Set(['owned', 'summoned'])

/**
 * A campaign's companions, as stored: those that can be read, by a key, the characters each is
 * a companion of, its kind and its name. None where there's nothing to read.
 */
export function companionRoster(companions: unknown): CompanionEntry[] {
  if (!Array.isArray(companions)) return []
  return (companions as (Partial<CompanionEntry> | null)[]).filter(
    (entry): entry is CompanionEntry =>
      typeof entry?.key === 'string' &&
      COMPANION_KEY.test(entry.key) &&
      Array.isArray(entry.of) &&
      entry.of.length > 0 &&
      entry.of.every(id => typeof id === 'string') &&
      typeof entry.kind === 'string' &&
      KINDS.has(entry.kind) &&
      typeof entry.name === 'string',
  )
}

/**
 * A companion as its character's tab shows it: its key, name and portrait, its kind, and for a
 * summoned one the item it was summoned with, where it's named.
 * @param origin - The game's address, which its portrait's path may be relative to.
 */
export function tableCompanion(
  entry: CompanionEntry,
  origin: string,
): TableCompanion {
  const portrait = portraitUrl(entry.img, origin)
  const from = entry.kind === 'summoned' ? entry.summon?.item : undefined
  return {
    key: entry.key,
    name: entry.name,
    ...(portrait && { portrait }),
    kind: entry.kind,
    ...(from && { from }),
  }
}

/**
 * Every listed companion, by key, with the characters it's a companion of, its name and portrait:
 * for a viewer to tell whose side each combatant and message is on.
 */
export function companionsByKey(
  entries: CompanionEntry[],
  origin: string,
): Map<string, { of: string[]; portrait?: string; name: string }> {
  return new Map(
    entries.map(entry => {
      const portrait = portraitUrl(entry.img, origin)
      return [
        entry.key,
        { of: entry.of, name: entry.name, ...(portrait && { portrait }) },
      ] as const
    }),
  )
}
