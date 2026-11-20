import { checkName, checkTitle } from '@/utils/description-links'
import { DND5E_NAMES, abilityName } from '@/utils/game-names'
import type { AskedCheck, CheckOption, GameNames } from '@/types/sending-stone'
import type { TableAsk } from '@/types/table'

/** What a roll request card's chip calls what it asks for. */
export const ASK_CHIPS: Record<TableAsk['type'], string> = {
  save: 'Saving throw',
  concentration: 'Concentration',
  check: 'Check',
}

/**
 * What a roll request card asks for, in words: such as "DC 15 Dexterity saving throw", "Strength
 * or Dexterity saving throw", or "DC 10 Concentration check", naming its ability where it isn't
 * Constitution; or a check, such as "DC 15 Strength (Athletics) check", or "Intelligence or Wisdom
 * check", a tool by the game's name for it where it says.
 * @param names - The game's names for its abilities and skills, as the seat's sheet has them, such
 *   as "Honor (Etiquette)"; dnd5e's English six and 18 where none are given.
 */
export function askTitle(
  ask: TableAsk,
  names: GameNames = DND5E_NAMES,
): string {
  if (ask.type === 'check') {
    const ways = ask.checks.map(check =>
      checkName(checkOptionOf(check), check.name, names),
    )
    return checkTitle(ways, { dc: ask.dc })
  }
  const dc = ask.dc === undefined ? '' : `DC ${ask.dc} `
  if (ask.type === 'concentration') {
    const [ability] = ask.abilities
    return ability && ability !== 'con'
      ? `${dc}Concentration check (${abilityName(names, ability)})`
      : `${dc}Concentration check`
  }
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(
    ask.abilities.map(id => abilityName(names, id)),
  )
  return `${dc}${list} saving throw`
}

/** One way a check the table is asked for may be made, as a description's link has it. */
function checkOptionOf(check: AskedCheck): CheckOption {
  const key = check.type === 'skill' ? check.skill : check.tool
  return {
    type: check.type,
    ability: check.ability,
    ...(check.type !== 'check' && key !== undefined && { key }),
  }
}
