import type {
  CharacterSheet,
  SheetActivity,
  SheetCast,
  SheetContainer,
  SheetItem,
} from '@/types/sending-stone'

/**
 * The descriptions a sheet refers to, by hash: its features' and their sections', its effects',
 * its conditions', its items' (those in containers too), its spells', its biography and its
 * actions'; and of anything that casts a spell from its item, the spell's; and of each activity
 * of theirs, and of one made a favorite, its own, as dnd5e 6 gives them, and the spell it casts.
 */
export function sheetTextRefs(sheet: Partial<CharacterSheet>): string[] {
  const refs = [
    ...(sheet.features ?? []).flatMap(section => [
      section.text,
      ...section.features.flatMap(feature => [
        feature.text,
        ...activityRefs(feature),
      ]),
    ]),
    ...(sheet.effects ?? []).flatMap(section =>
      section.effects.map(effect => effect.text),
    ),
    ...(sheet.conditions ?? []).map(condition => condition.text),
    ...allItems(sheet).flatMap(item => [item.text, ...activityRefs(item)]),
    ...(sheet.spells ?? []).flatMap(section =>
      section.spells.flatMap(spell => [spell.text, ...activityRefs(spell)]),
    ),
    sheet.details?.biography,
    ...(sheet.actions ?? []).flatMap(section =>
      section.actions.flatMap(action => [action.text, ...activityRefs(action)]),
    ),
    ...(sheet.favorites ?? []).flatMap(favorite =>
      favorite.type === 'activity' ? [favorite.text, favorite.cast?.text] : [],
    ),
  ]
  return [...new Set(refs.filter(ref => typeof ref === 'string'))]
}

/**
 * The descriptions what an action, item, feature or spell does refers to: of a spell it casts,
 * and of each of its activities, their own and the spell each casts.
 */
function activityRefs(entry: {
  cast?: Pick<SheetCast, 'text'> | null
  activities?: Pick<SheetActivity, 'text' | 'cast'>[]
}): (string | null | undefined)[] {
  return [
    entry.cast?.text,
    ...(entry.activities ?? []).flatMap(activity => [
      activity.text,
      activity.cast?.text,
    ]),
  ]
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
