import { BellRing, Dices, Send } from 'lucide-react'
import { ABILITIES } from '@/constants/dnd5e'
import { D20_CHOICES } from '@/features/rolling/constants'
import { formulaOf } from '@/features/rolling/utils/damage-words'
import { choiceItem } from '@/features/rolling/utils/menu-points'
import { toAdvantage } from '@/features/rolling/utils/roll-mode'
import {
  EVERY_DIE_TWICE,
  changes,
  criticalParts,
  damageChanges,
  sameFirstDie,
  withModifiers,
} from '@/utils/damage-modifiers'
import { checkName, toolOrSkillName } from '@/utils/description-links'
import { formatModifier } from '@/utils/format-modifier'
import type { CheckFrom, CheckWay, LinkMenus, OpenMenu } from './types'
import type {
  DescribedDamage,
  DescriptionActions,
} from '../description-actions/types'
import type {
  DamageChoice,
  MenuItem,
  RollChoice,
  RollTarget,
} from '@/features/rolling/types'
import type { CriticalAdds, ExtraTerm, SheetDamageRoll } from '@/types/roll'
import type {
  CheckOption,
  CriticalRule,
  DamageLink,
  RollMode,
  SaveLink,
  SheetAbility,
  SheetSkill,
  SheetTool,
} from '@/types/sending-stone'

/**
 * What a saving throw a description calls for is, in words: such as "DC 15 Dexterity saving
 * throw", "Strength or Dexterity saving throw", or "DC 10 Concentration check".
 */
export function saveTitle(link: SaveLink): string {
  const dc = link.dc === undefined ? '' : `DC ${link.dc} `
  if (link.concentration) {
    const [ability] = link.abilities
    return ability && ability !== 'con'
      ? `${dc}Concentration check (${ABILITIES[ability]})`
      : `${dc}Concentration check`
  }
  const names = link.abilities.map(id => ABILITIES[id])
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(names)
  return `${dc}${list} saving throw`
}

/**
 * A way a check may be made, by the sheet's name for its skill or tool, where it has one, as
 * dnd5e's card names it: such as "Dexterity (Sleight of Hand)".
 */
export function checkOptionName(
  option: CheckOption,
  actions?: Pick<DescriptionActions, 'skills' | 'tools'>,
): string {
  const named =
    option.type === 'skill'
      ? actions?.skills.find(skill => skill.id === option.key)?.label
      : actions?.tools.find(tool => tool.id === option.key)?.name
  return checkName(option, option.type === 'check' ? undefined : named)
}

/**
 * A way a check an activity asks for may be made, by its own name, as its chip and the player's
 * roll name it: the skill's or tool's, by the sheet's name for it, or the ability's, for an ability
 * check; or as dnd5e's card names it, with the ability, where that isn't the skill's or the tool's
 * own, as the sheet has it, such as "Strength (Sleight of Hand)".
 */
export function checkWayName(
  option: CheckOption,
  actions?: Pick<DescriptionActions, 'skills' | 'tools'>,
): string {
  const { type, key } = option
  if (type === 'check' || key === undefined) return checkName(option)
  const own =
    type === 'skill'
      ? actions?.skills.find(skill => skill.id === key)
      : actions?.tools.find(tool => tool.id === key)
  if (own?.ability && own.ability !== option.ability) {
    return checkOptionName(option, actions)
  }
  const named = own && ('label' in own ? own.label : own.name)
  return named || toolOrSkillName(type, key)
}

/**
 * The menu a check opens, which a description's link and an activity's chip share: first the ways
 * to ask the table for it, as given; then, for one the character makes itself, a roll of the
 * player's own against its DC for each way it may be made that the character can, saying what it
 * spends where told, and for one, with advantage, with disadvantage, or modified first.
 * @param ask - What it offers first, and what choosing each of those does.
 * @param own - Whether the character makes it, and may roll it here.
 * @param usingTool - For a skill check made using a tool, as a description may ask, the tool.
 * @param from - What it's rolled for, for the game to make it too; nothing for the player's alone.
 * @param hint - What each of the player's own rolls says under it, such as that it spends nothing.
 * @param nameOf - What each way to make it is called, as its roll is named; as dnd5e's card names
 *   it, unless said.
 */
export function checkMenuItems({
  checks,
  dc,
  title,
  ask,
  own,
  actions,
  menus,
  usingTool,
  from,
  hint,
  nameOf = option => checkOptionName(option, actions),
}: {
  checks: CheckWay[]
  dc?: number
  title: string
  ask: { items: MenuItem<string>[]; choose: (id: string) => void }
  own: boolean
  actions?: DescriptionActions
  menus: LinkMenus
  usingTool?: string
  from?: CheckFrom
  hint?: string
  nameOf?: (option: CheckWay) => string
}): Pick<OpenMenu, 'title' | 'items' | 'onChoose'> {
  const choices =
    own && actions
      ? checks.flatMap((option, index) => {
          const target = checkTarget(option, nameOf(option), actions, {
            usingTool,
            from,
          })
          return target ? [{ id: `roll:${index}`, target }] : []
        })
      : []
  const items: MenuItem<string>[] = [
    ...ask.items,
    ...choices.map(({ id, target }) => ({
      id,
      label: `Roll my ${target.label} (${formatModifier(target.modifier)}${modeWord(target.mode)})`,
      icon: Dices,
      tint: 'text-primary',
      ...(hint && { hint }),
    })),
    // For one way to make it, the other ways to roll it, as the sheet's menu offers them.
    ...(choices.length === 1
      ? D20_CHOICES.map(choice => choiceItem(choice))
      : []),
  ]
  const choose = (id: string) => {
    const only = choices.length === 1 ? choices[0].target : undefined
    if (id.startsWith('roll:')) {
      const chosen = choices.find(choice => choice.id === id)
      if (chosen && actions) rollAgainst(actions, chosen.target, dc)
    } else if (only && actions && (id === 'adv' || id === 'dis')) {
      rollAgainst(actions, only, dc, id)
    } else if (only && id === 'modify') {
      menus.modify(only, dc)
    } else {
      ask.choose(id)
    }
  }
  return { title, items, onChoose: choose }
}

/**
 * How the character makes one of the ways a check a description or an activity calls for may be
 * made, as the game makes it: an ability check as the sheet has it; a skill's, or a tool's the
 * character has, as the sheet has it, but with the ability the check names, where that isn't its
 * own, and for a skill check made using a tool the character has, with the higher of the two
 * proficiencies, and with advantage where it has both, as dnd5e makes it; and a tool's the
 * character hasn't as dnd5e makes it, without proficiency, as that ability's check is. An
 * activity's tool check made with the tool it's of takes the tool's own bonus too. The game's own
 * total is the one that counts, which takes in what the sheet doesn't say, such as a bonus to one
 * ability's checks alone. None where the sheet has no such ability or skill.
 * @param name - What it's called, as the roll is named: such as "Dexterity (Sleight of Hand)".
 * @param usingTool - For a skill check made using a tool, the tool's key.
 * @param from - What it's rolled for, for the game to make it too; nothing for the player's alone.
 */
export function checkTarget(
  option: CheckWay,
  name: string,
  actions: DescriptionActions,
  { usingTool, from }: { usingTool?: string; from?: CheckFrom },
): RollTarget | undefined {
  const ability = actions.abilities.find(each => each.id === option.ability)
  if (!ability) return
  const label = `${name} check`
  const bonus = option.bonus ?? 0
  if (option.type === 'check') {
    return {
      label,
      modifier: ability.check + bonus,
      mode: ability.checkMode,
      source: { kind: 'ability', key: ability.id, ...from },
    }
  }
  const { key } = option
  if (key === undefined) return
  if (option.type === 'skill') {
    const skill = actions.skills.find(each => each.id === key)
    if (!skill) return
    const tool = actions.tools.find(each => each.id === usingTool)
    const both = !!tool && skill.proficiency > 0 && tool.proficiency > 0
    return {
      label,
      modifier:
        withAbility(
          skill.total + withTool(skill, tool, actions.proficiency),
          skill.ability,
          ability,
          actions,
        ) + bonus,
      mode: both ? withAdvantage(skill.mode) : skill.mode,
      source: { kind: 'skill', key, ...from },
    }
  }
  const tool = actions.tools.find(each => each.id === key)
  return {
    label,
    modifier:
      (tool
        ? withAbility(tool.total, tool.ability, ability, actions)
        : ability.check) + bonus,
    mode: tool ? tool.mode : ability.checkMode,
    source: { kind: 'tool', key, ...from },
  }
}

/**
 * A skill's or tool's modifier, made with another ability than its own, as a description may ask:
 * its own ability's modifier taken away, and the other's added.
 */
function withAbility(
  total: number,
  own: string | null,
  ability: SheetAbility,
  actions: DescriptionActions,
): number {
  const from = actions.abilities.find(each => each.id === own)
  return from && from.id !== ability.id ? total - from.mod + ability.mod : total
}

/**
 * What a skill check made using a tool the character has gains over the skill's own modifier, as
 * dnd5e makes it: the higher of the two proficiencies in place of the skill's, where the tool's is
 * higher, each times the proficiency bonus, rounded down. The tool's is the sheet's, doubled for
 * Tool Expertise. Nothing where the sheet has no proficiency bonus.
 */
function withTool(
  skill: SheetSkill,
  tool: SheetTool | undefined,
  bonus: number | null,
): number {
  if (!tool || bonus === null || tool.proficiency <= skill.proficiency) return 0
  return (
    Math.floor(tool.proficiency * bonus) - Math.floor(skill.proficiency * bonus)
  )
}

/** A roll's mode with advantage added, which disadvantage cancels, as dnd5e counts them. */
function withAdvantage(mode: RollMode): RollMode {
  return mode < 0 ? 0 : 1
}

/**
 * What a description's damage or healing will throw, rolled the way chosen: changed as the player
 * chose, and as a critical hit's, as the world's rules make one, where the game says how, or else
 * every die twice, with what a critical hit adds; such as "4d10 + 2d6".
 */
export function thrownBy(
  parts: ExtraTerm[][],
  { critical = false, modifiers }: DamageChoice,
  rule?: CriticalRule,
  adds?: CriticalAdds,
): string {
  const changed = withModifiers(
    parts.map(terms => ({ terms, type: null })),
    modifiers,
    1,
  )
  if (critical) {
    return formulaOf(criticalParts(changed, rule ?? EVERY_DIE_TWICE, adds))
  }
  return formulaOf(changed)
}

/**
 * The other ways a description's damage or healing may be rolled, as an action's may: as a critical
 * hit's, where one is offered, as `criticalOffered` says, and at its highest, unless it takes a die
 * away, or with its first die changed, where it has one, never one it takes away. Where the game
 * rolls it too, only those it takes: a critical hit's where the sheet says how the world makes
 * one, and changed where it takes it so, as a module before 0.21.0, which changes its first die
 * whatever its sign, does only where that's one it adds.
 * @param adds - What a critical hit adds, where one is offered.
 */
export function damageWays(
  parts: ExtraTerm[][],
  table: DescribedDamage | undefined,
  adds: CriticalAdds | false,
): RollChoice[] {
  const changed = !table || table.modifies
  const read = parts.map(terms => ({ terms }))
  // A module before 0.21.0 changes its first die whatever its sign: only where that's one it adds.
  const fixed =
    table !== undefined && table.signed !== true && !sameFirstDie(read)
  return [
    ...(adds ? (['critical'] as const) : []),
    ...(changed ? damageChanges(read, fixed) : []),
  ]
}

/**
 * The ways a saving throw's or check's menu offers to ask the table for it: there unless it's in a
 * secret, which the table mustn't read; with why it can't be, where it can't; and where this
 * device doesn't send rolls, to send them.
 */
export function askItems(
  secret: boolean,
  actions: DescriptionActions,
): MenuItem<string>[] {
  if (secret) return []
  return [
    {
      id: 'ask',
      label: 'Ask the table',
      icon: BellRing,
      tint: 'text-primary',
      ...(actions.askBlocked && { disabled: sentence(actions.askBlocked) }),
    },
    // Where only this device's switch keeps it from being asked, a way to turn it on.
    ...(actions.sendRolls ? [SEND_ROLLS] : []),
  ]
}

/** The menu item that has this device send the player's rolls to the table. */
const SEND_ROLLS: MenuItem<string> = {
  id: 'send',
  label: 'Send my rolls to the table',
  icon: Send,
  tint: 'text-primary',
}

/**
 * The ways an activity's check menu offers to ask the table for it, by using the activity in the
 * game, which posts dnd5e's card with a button for each way it may be made: saying what using it
 * spends, or why it can't be used now; and where it can't, and this device doesn't send rolls, to
 * send them.
 * @param spends - What using it spends, such as "Uses Manacles (Bind)".
 * @param blocked - Why it can't be used now; unset while it can be.
 */
export function tableUseItems(
  spends: string,
  blocked: string | undefined,
  actions?: Pick<DescriptionActions, 'sendRolls'>,
): MenuItem<string>[] {
  return [
    {
      id: 'ask',
      label: 'Ask the table',
      icon: BellRing,
      tint: 'text-primary',
      ...(blocked ? { disabled: sentence(blocked) } : { hint: spends }),
    },
    ...(blocked && actions?.sendRolls ? [SEND_ROLLS] : []),
  ]
}

/**
 * Rolls a saving throw or check a description calls for, the player's own, against the DC it
 * names, if any: as the sheet has it, or with the advantage or disadvantage chosen.
 */
export function rollAgainst(
  actions: DescriptionActions,
  target: RollTarget,
  dc: number | undefined,
  chosen?: 'adv' | 'dis',
) {
  actions.roll({
    label: target.label,
    modifier: target.modifier,
    advantage: chosen ?? toAdvantage(target.mode),
    source: target.source,
    explicit: chosen !== undefined,
    ...(dc !== undefined && { dc }),
    ...(target.ask && { ask: target.ask }),
  })
}

/** A kind of damage or healing, by dnd5e's key, as the tray says it, such as "fire". */
export function typeLabel(type: string | null): string | null {
  if (type === 'temphp') return 'temporary hit points'
  return type
}

/** The advantage or disadvantage the sheet rolls a save or check with, as a menu item says it. */
export function modeWord(mode: number): string {
  if (mode > 0) return ', advantage'
  if (mode < 0) return ', disadvantage'
  return ''
}

/** A reason as a sentence of its own, such as under a menu item. */
export function sentence(reason: string): string {
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`
}

/**
 * What rolling a description's damage or healing asks for: named for where it's from, each part
 * as the kind chosen, where it offers that one, or else its first; and the kind chosen for each
 * part that offers a choice, for the game to roll it so; as a critical hit's, and changed, as
 * chosen.
 * @param read - Each part's formula, read.
 * @param rule - How the world makes a critical hit, where the game rolls it too and says how.
 * @param adds - What a critical hit adds, where one is offered.
 * @param chosen - The kind chosen, if any.
 */
export function damageRequest(
  link: DamageLink,
  {
    name,
    hash,
    read,
    rule,
    adds,
  }: {
    name: string
    hash: string
    read: ExtraTerm[][]
    rule?: CriticalRule
    adds: CriticalAdds | false
  },
  chosen: string | undefined,
  { critical = false, modifiers }: DamageChoice = {},
): SheetDamageRoll {
  const choice = link.parts.find(part => part.types.length > 1)
  const types = link.parts.map(part =>
    chosen && part.types.includes(chosen)
      ? chosen
      : // a part of no kind has none, as the sheet's
        (part.types[0] ?? null),
  )
  return {
    label: name,
    parts: read.map((part, index) => ({
      terms: part,
      type: typeLabel(types[index]),
    })),
    healing: link.healing,
    text: { text: hash, link: link.n },
    // The kind chosen, for each part that offers a choice, for the game to roll it so.
    ...(choice && {
      types: link.parts.map((part, index) =>
        part.types.length > 1 ? types[index] : null,
      ),
    }),
    // A critical hit's as the game makes one, where it rolls it too and says how; else every
    // die twice, the player's alone; with what a critical hit adds, either way.
    ...(critical && {
      critical,
      ...(rule && { criticalRule: rule }),
      ...(adds && { criticalAdds: adds }),
    }),
    ...(modifiers && changes(modifiers) && { modifiers }),
  }
}
