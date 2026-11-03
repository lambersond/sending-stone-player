import type { DescriptionActions } from './types'
import type {
  SheetCastFrom,
  CharacterSheet,
  SheetTool,
} from '@/types/sending-stone'

/**
 * What a spell's description is from, as its rolls are named: the spell, and the item it's cast
 * from, if any, such as "Starry Wisp (Worn Bardic Eternal Flame)".
 */
export function spellOrigin({
  name,
  castFrom,
}: {
  name: string
  castFrom?: Pick<SheetCastFrom, 'name'> | null
}): string {
  return castFrom ? `${name} (${castFrom.name})` : name
}

/**
 * The tools the character has, as far as its sheet says: its tools, from module 0.18.0, and the
 * tools it made favorites, which named them before.
 */
export function sheetTools(
  sheet: Pick<CharacterSheet, 'tools' | 'favorites'>,
): SheetTool[] {
  const tools = [...(sheet.tools ?? [])]
  for (const favorite of sheet.favorites ?? []) {
    if (
      favorite.type === 'tool' &&
      !tools.some(tool => tool.id === favorite.id)
    ) {
      const { id, name, ability, total, passive, proficiency, mode } = favorite
      tools.push({ id, name, ability, total, passive, proficiency, mode })
    }
  }
  return tools
}

/**
 * What a description's links do, then `done`: once its dice are thrown, or the table is asked, as
 * a dialog it's in closes then, for the dice and the tray behind it to be seen.
 */
export function closingAfter(
  actions: DescriptionActions,
  done: () => void,
): DescriptionActions {
  return {
    ...actions,
    roll: roll => {
      actions.roll(roll)
      done()
    },
    rollDamage: roll => {
      actions.rollDamage(roll)
      done()
    },
    rollFormula: roll => {
      actions.rollFormula(roll)
      done()
    },
    ask: asking => {
      actions.ask(asking)
      done()
    },
  }
}
