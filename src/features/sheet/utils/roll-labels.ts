import { modeText } from './class-line'
import { formatModifier } from '@/utils/format-modifier'
import type { RollMode } from '@/types/sending-stone'

/**
 * A check's or a saving throw's roll button's name, as the sheet says it: what's rolled, its bonus,
 * what more it is (`details`), advantage or disadvantage, and what follows (`suffix`), such as
 * whose bonus it is on a shaped sheet.
 */
export function checkLabel({
  label,
  total,
  mode,
  details = '',
  suffix = '',
}: Readonly<{
  label: string
  total: number
  mode: RollMode
  details?: string
  suffix?: string
}>): string {
  return `${label}, ${formatModifier(total)}${details}${modeText(mode)}${suffix}`
}

/** What a check carries, as its name says it: in brackets after its bonus, where there's any. */
export function detailWords(details: readonly (string | undefined)[]): string {
  return details.length > 0 ? ` (${details.join(', ')})` : ''
}
