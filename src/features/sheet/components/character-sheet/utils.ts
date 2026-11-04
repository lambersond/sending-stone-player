import type { SheetForm } from '@/types/sending-stone'

/**
 * Whose the Armor class is on a shaped sheet (module 0.40.0): the form's, or the Circle of the
 * Moon's where its floor is the AC.
 */
export function acTag(form?: SheetForm): string | undefined {
  if (!form) return undefined
  return form.flooredAc ? 'Circle of the Moon' : form.name
}
