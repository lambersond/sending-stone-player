import type { SheetConcentrationEffect } from '@/types/sending-stone'

/** What ending one is called, as its button and menu item are: "End concentration on Bless". */
export function endLabel(effect: SheetConcentrationEffect): string {
  return `End concentration on ${effect.name}`
}
