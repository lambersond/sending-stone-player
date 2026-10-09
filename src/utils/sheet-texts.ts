import type {
  CharacterSheet,
  SheetContainer,
  SheetItem,
} from '@/types/sending-stone'

/**
 * The descriptions a sheet refers to, by hash: its features' and their sections', its effects',
 * its conditions', its items' (those in containers too), its spells', its biography and its
 * actions', and of a spell an action casts from its item, the spell's.
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
    ...allItems(sheet).map(item => item.text),
    ...(sheet.spells ?? []).flatMap(section =>
      section.spells.map(spell => spell.text),
    ),
    sheet.details?.biography,
    ...(sheet.actions ?? []).flatMap(section =>
      section.actions.flatMap(action => [action.text, action.cast?.text]),
    ),
  ]
  return [...new Set(refs.filter(ref => typeof ref === 'string'))]
}

/** Every item on a sheet: by type, the containers, and what they hold, however deep. */
export function allItems(sheet: Partial<CharacterSheet>): SheetItem[] {
  const inventory = sheet.inventory
  if (!inventory) return []
  const withContents = (item: SheetItem | SheetContainer): SheetItem[] => [
    item,
    ...('contents' in item
      ? (item.contents ?? []).flatMap(inner => withContents(inner))
      : []),
  ]
  return [
    ...inventory.sections.flatMap(section => section.items),
    ...inventory.containers.flatMap(container => withContents(container)),
  ]
}
