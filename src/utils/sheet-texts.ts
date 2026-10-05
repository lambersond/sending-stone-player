import type { CharacterSheet } from '@/types/sending-stone'

/**
 * The descriptions a sheet refers to, by hash: its features' and their sections', its effects'
 * and its conditions'.
 */
export function sheetTextRefs(sheet: Partial<CharacterSheet>): string[] {
  const refs = [
    ...(sheet.features ?? []).flatMap(section => [
      section.text,
      ...section.features.map(feature => feature.text),
    ]),
    ...(sheet.effects ?? []).flatMap(section =>
      section.effects.map(effect => effect.text),
    ),
    ...(sheet.conditions ?? []).map(condition => condition.text),
  ]
  return [...new Set(refs.filter(ref => typeof ref === 'string'))]
}
