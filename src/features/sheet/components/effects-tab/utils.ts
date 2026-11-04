import type { SheetCondition, SheetEffect } from '@/types/sending-stone'

/** What qualifies a condition: Exhaustion's level, or what the character is concentrating on. */
export function conditionDetail(condition: SheetCondition): string | undefined {
  if (condition.level !== null) return `Level ${condition.level}`
  return condition.detail ?? undefined
}

/**
 * Where an effect came from, unless that is its own name, as for a spell's effect named after the
 * spell, and the time it has left.
 */
export function effectDetail(effect: SheetEffect): string | undefined {
  const source =
    effect.source && effect.source !== effect.name
      ? `From ${effect.source}`
      : undefined
  return [source, effect.duration].filter(Boolean).join(' · ') || undefined
}
