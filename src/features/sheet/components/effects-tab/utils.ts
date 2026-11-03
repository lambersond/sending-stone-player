import type { SheetCondition } from '@/types/sending-stone'

/** What qualifies a condition: Exhaustion's level, or what the character is concentrating on. */
export function conditionDetail(condition: SheetCondition): string | undefined {
  if (condition.level !== null) return `Level ${condition.level}`
  return condition.detail ?? undefined
}
