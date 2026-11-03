import { ABILITIES } from '@/constants/dnd5e'
import { checkName, checkTitle } from '@/utils/description-links'
import type { AskedCheck, CheckOption } from '@/types/sending-stone'
import type { TableAsk } from '@/types/table'

/** Is this one of dnd5e's abilities' ids, and not a name any object answers to? */
export function isAbility(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(ABILITIES, id)
}

/**
 * What a roll request card asks for, in words: such as "DC 15 Dexterity saving throw", "Strength
 * or Dexterity saving throw", or "DC 10 Concentration check", naming its ability where it isn't
 * Constitution; or a check, such as "DC 15 Strength (Athletics) check", or "Intelligence or Wisdom
 * check", a tool by the game's name for it where it says.
 */
export function askTitle(ask: TableAsk): string {
  if (ask.type === 'check') {
    const names = ask.checks.map(check =>
      checkName(checkOptionOf(check), check.name),
    )
    return checkTitle(names, { dc: ask.dc })
  }
  const dc = ask.dc === undefined ? '' : `DC ${ask.dc} `
  const names = ask.abilities
    .filter(id => isAbility(id))
    .map(id => ABILITIES[id])
  if (ask.type === 'concentration') {
    const [ability] = ask.abilities
    return ability && ability !== 'con' && names[0]
      ? `${dc}Concentration check (${names[0]})`
      : `${dc}Concentration check`
  }
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(names)
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
