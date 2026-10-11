'use client'

import { useState, type ReactNode } from 'react'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import { BellRing, Dices, HeartPulse, Send, Swords } from 'lucide-react'
import { rulesOf } from './conditions-panel'
import {
  formulaOf,
  useDamageMenu,
  type DamageChoice,
  type DamageSubject,
} from './damage-menu'
import { ModifyRoll } from './modify-roll'
import { RollButton, type RollTarget } from './roll-button'
import {
  choiceItem,
  ChoiceMenu,
  D20_CHOICES,
  type MenuItem,
  type MenuPoint,
  type RollChoice,
} from './roll-menu'
import { Modal, usePortalRoot, useTopmostEscape } from '@/components/modal'
import { ABILITIES } from '@/constants/dnd5e'
import {
  changes,
  criticalParts,
  firstDie,
  withModifiers,
} from '@/utils/damage-modifiers'
import {
  checkName,
  checkTitle,
  toolOrSkillName,
  type CheckLink,
  type CheckOption,
  type ConditionLink,
  type DamageLink,
  type RollLink,
  type SaveLink,
} from '@/utils/description-links'
import { formatModifier } from '@/utils/format-modifier'
import { formulaTerms } from '@/utils/formulas'
import { toAdvantage } from '@/utils/roll-mode'
import type {
  DescribedDamage,
  DescriptionActions,
  DescriptionOrigin,
} from './description-actions'
import type { LinkPart } from './description-html'
import type {
  CriticalRule,
  RollMode,
  SheetAbility,
  SheetSkill,
  SheetTool,
} from '@/types/sending-stone'
import type { ExtraTerm } from '@/utils/roll-modifiers'

/*
 * The links in a description, as the sheet acts on them: a saving throw or check it calls for
 * opens a menu, to ask the table for it or roll the player's own; its damage or healing, and its
 * own rolls, roll at a tap with the player's dice, and its damage offers other ways to roll it, as
 * an action's does; and a condition it names shows its rules, on a hover or focus, and opens the
 * conditions panel at it on a tap. Each says only what the description says, as text; one the app
 * can't act on, such as a formula it can't read, is only that text.
 */

/** A menu a description's link opens: where, what it's of, its items, and what each does. */
type OpenMenu = {
  anchor: HTMLElement
  /** Where on the link the player clicked or pressed for it; below the link with none. */
  point?: MenuPoint
  title: string
  items: MenuItem<string>[]
  onChoose: (id: string) => void
}

/**
 * The menus a description's links open, and the dialogs that modify a saving throw or check, or
 * damage, first.
 */
export type LinkMenus = {
  open: (menu: OpenMenu) => void
  /** Modify a saving throw or check before it's rolled, against the DC its description names. */
  modify: (target: RollTarget, dc?: number) => void
  /**
   * The other ways to roll a description's damage or healing: as a critical hit's, at its highest,
   * or changed first.
   */
  damage: (
    anchor: HTMLElement,
    subject: DamageSubject,
    point?: MenuPoint,
  ) => void
}

/**
 * The menus a description's links open, one at a time, and the dialogs that modify a saving throw
 * or check, or damage, before it's rolled, which are in `dialogs`, to be put on the page beside the
 * description, never in it.
 */
export function useLinkMenus(actions?: DescriptionActions): {
  menus: LinkMenus
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<OpenMenu>()
  const [modifying, setModifying] = useState<{
    target: RollTarget
    dc?: number
  }>()
  const damage = useDamageMenu()
  const dialogs = (
    <>
      {menu && (
        <ChoiceMenu
          anchor={menu.anchor}
          point={menu.point}
          title={menu.title}
          items={menu.items}
          onChoose={id => {
            setMenu(undefined)
            menu.onChoose(id)
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
      {modifying && actions && (
        <Modal open onClose={() => setModifying(undefined)} title='Modify roll'>
          <ModifyRoll
            target={modifying.target}
            mode={modifying.target.mode}
            onRoll={request => {
              setModifying(undefined)
              actions.roll({
                ...request,
                ...(modifying.dc !== undefined && { dc: modifying.dc }),
              })
            }}
            onCancel={() => setModifying(undefined)}
          />
        </Modal>
      )}
      {actions && damage.dialogs}
    </>
  )
  return {
    menus: {
      open: setMenu,
      modify: (target, dc) => setModifying({ target, dc }),
      damage: damage.open,
    },
    dialogs,
  }
}

/**
 * A link that does something, set in the description's text as a roll is: on one line where it
 * fits, but wrapping inside its own box where it's wider than the text, as a long saving throw's
 * may be on a phone, rather than reaching past it.
 */
const PILL =
  'max-w-full touch-manipulation rounded-md px-[0.3em] text-left font-semibold whitespace-normal transition-colors select-none [-webkit-touch-callout:none]'

/**
 * A link in a description, as the sheet acts on it: by what `actions` do, or with none, as only
 * its text.
 */
export function DescriptionLink({
  part,
  hash,
  origin,
  actions,
  menus,
}: Readonly<{
  part: LinkPart
  /** The hash of the description it's in. */
  hash: string
  origin: DescriptionOrigin
  actions?: DescriptionActions
  menus: LinkMenus
}>): ReactNode {
  const { link, label } = part
  if (!actions) {
    return link.kind === 'condition' ? (
      <span className='ref'>{label}</span>
    ) : (
      label
    )
  }
  switch (link.kind) {
    case 'save': {
      return (
        <SaveButton
          link={link}
          label={label}
          secret={part.secret}
          hash={hash}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'check': {
      return (
        <CheckButton
          link={link}
          label={label}
          secret={part.secret}
          hash={hash}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'damage': {
      return (
        <DamageButton
          link={link}
          label={label}
          hash={hash}
          origin={origin}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'roll': {
      return (
        <FormulaButton
          link={link}
          label={label}
          hash={hash}
          origin={origin}
          actions={actions}
        />
      )
    }
    case 'condition': {
      return <ConditionButton link={link} label={label} actions={actions} />
    }
  }
}

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
 * A saving throw a description calls for, which opens a menu: to ask the table for it, on the
 * game's own card, for the Gamemaster to roll for those it names, unless it's in a secret, which
 * the table mustn't read, and where this device doesn't send rolls, to send them; or to roll the
 * player's own, against its DC: for each of its abilities, and for one, with advantage, with
 * disadvantage, or modified first.
 */
function SaveButton({
  link,
  label,
  secret,
  hash,
  actions,
  menus,
}: Readonly<{
  link: SaveLink
  label: string
  secret: boolean
  hash: string
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  const title = saveTitle(link)
  const abilities = link.abilities.flatMap(id => {
    const ability = actions.abilities.find(each => each.id === id)
    return ability ? [ability] : []
  })
  const targetOf = (ability: SheetAbility): RollTarget => ({
    label: link.concentration
      ? 'Concentration check'
      : `${ability.label} saving throw`,
    modifier: ability.save,
    mode: ability.saveMode,
    source: { kind: 'save', key: ability.id, text: hash, link: link.n },
  })
  const roll = (target: RollTarget, chosen?: 'adv' | 'dis') =>
    rollAgainst(actions, target, link.dc, chosen)
  const items: MenuItem<string>[] = [
    ...askItems(secret, actions),
    ...abilities.map(ability => ({
      id: `roll:${ability.id}`,
      label: `Roll my ${link.concentration ? 'concentration check' : `${ability.label} save`} (${formatModifier(ability.save)}${modeWord(ability.saveMode)})`,
      icon: Dices,
      tint: 'text-primary',
    })),
    // For one ability, the other ways to roll it, as the sheet's menu offers them.
    ...(abilities.length === 1
      ? D20_CHOICES.map(choice => choiceItem(choice))
      : []),
  ]
  const choose = (id: string) => {
    const [only] = abilities
    if (id === 'ask') {
      actions.ask({ label: title, text: hash, link: link.n })
    } else if (id === 'send') {
      actions.sendRolls?.()
    } else if (id.startsWith('roll:')) {
      const ability = abilities.find(each => `roll:${each.id}` === id)
      if (ability) roll(targetOf(ability))
    } else if (only && (id === 'adv' || id === 'dis')) {
      roll(targetOf(only), id)
    } else if (only && id === 'modify') {
      menus.modify(targetOf(only), link.dc)
    }
  }
  return (
    <button
      type='button'
      aria-haspopup='menu'
      onClick={event =>
        menus.open({
          anchor: event.currentTarget,
          title,
          items,
          onChoose: choose,
        })
      }
      className={clsx(PILL, 'bg-primary/12 hover:bg-primary/20')}
    >
      {label}
    </button>
  )
}

/**
 * A check a description calls for, which opens a menu, as a saving throw's does: to ask the table
 * for it, on the game's own card, for the Gamemaster to roll for those it names, unless it's in a
 * secret, and where this device doesn't send rolls, to send them; or to roll the player's own,
 * against its DC: each way it may be made that the character can, and for one, with advantage,
 * with disadvantage, or modified first.
 */
function CheckButton({
  link,
  label,
  secret,
  hash,
  actions,
  menus,
}: Readonly<{
  link: CheckLink
  label: string
  secret: boolean
  hash: string
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  // A skill or tool by the sheet's name for it, where it has one.
  const nameOf = (option: CheckOption) => {
    const named =
      option.type === 'skill'
        ? actions.skills.find(skill => skill.id === option.key)?.label
        : actions.tools.find(tool => tool.id === option.key)?.name
    return checkName(option, option.type === 'check' ? undefined : named)
  }
  const using =
    link.usingTool &&
    (actions.tools.find(tool => tool.id === link.usingTool)?.name ||
      toolOrSkillName('tool', link.usingTool))
  const title = checkTitle(
    link.checks.map(option => nameOf(option)),
    {
      dc: link.dc,
      ...(using && { using }),
    },
  )
  const choices = link.checks.flatMap((option, index) => {
    const target = checkTarget(option, nameOf(option), link, hash, actions)
    return target ? [{ id: `roll:${index}`, target }] : []
  })
  const items: MenuItem<string>[] = [
    ...askItems(secret, actions),
    ...choices.map(({ id, target }) => ({
      id,
      label: `Roll my ${target.label} (${formatModifier(target.modifier)}${modeWord(target.mode)})`,
      icon: Dices,
      tint: 'text-primary',
    })),
    // For one way to make it, the other ways to roll it, as the sheet's menu offers them.
    ...(choices.length === 1
      ? D20_CHOICES.map(choice => choiceItem(choice))
      : []),
  ]
  const choose = (id: string) => {
    const only = choices.length === 1 ? choices[0].target : undefined
    if (id === 'ask') {
      actions.ask({ label: title, text: hash, link: link.n })
    } else if (id === 'send') {
      actions.sendRolls?.()
    } else if (id.startsWith('roll:')) {
      const chosen = choices.find(choice => choice.id === id)
      if (chosen) rollAgainst(actions, chosen.target, link.dc)
    } else if (only && (id === 'adv' || id === 'dis')) {
      rollAgainst(actions, only, link.dc, id)
    } else if (only && id === 'modify') {
      menus.modify(only, link.dc)
    }
  }
  return (
    <button
      type='button'
      aria-haspopup='menu'
      onClick={event =>
        menus.open({
          anchor: event.currentTarget,
          title,
          items,
          onChoose: choose,
        })
      }
      className={clsx(PILL, 'bg-primary/12 hover:bg-primary/20')}
    >
      {label}
    </button>
  )
}

/**
 * How the character makes one of the ways a check a description calls for may be made, as the
 * game makes it: an ability check as the sheet has it; a skill's, or a tool's the character has,
 * as the sheet has it, but with the ability the description names, where that isn't its own, and
 * for a skill check made using a tool the character has, with the higher of the two
 * proficiencies, and with advantage where it has both, as dnd5e makes it; and a tool's the
 * character hasn't as dnd5e makes it, without proficiency, as that ability's check is. The game's
 * own total is the one that counts, which takes in what the sheet doesn't say, such as a bonus to
 * one ability's checks alone. None where the sheet has no such ability or skill.
 */
function checkTarget(
  option: CheckOption,
  name: string,
  link: CheckLink,
  hash: string,
  actions: DescriptionActions,
): RollTarget | undefined {
  const ability = actions.abilities.find(each => each.id === option.ability)
  if (!ability) return
  const label = `${name} check`
  const linked = { text: hash, link: link.n }
  if (option.type === 'check') {
    return {
      label,
      modifier: ability.check,
      mode: ability.checkMode,
      source: { kind: 'ability', key: ability.id, ...linked },
    }
  }
  const { key } = option
  if (key === undefined) return
  if (option.type === 'skill') {
    const skill = actions.skills.find(each => each.id === key)
    if (!skill) return
    const tool = actions.tools.find(each => each.id === link.usingTool)
    const both = !!tool && skill.proficiency > 0 && tool.proficiency > 0
    return {
      label,
      modifier: withAbility(
        skill.total + withTool(skill, tool, actions.proficiency),
        skill.ability,
        ability,
        actions,
      ),
      mode: both ? withAdvantage(skill.mode) : skill.mode,
      source: { kind: 'skill', key, ...linked },
    }
  }
  const tool = actions.tools.find(each => each.id === key)
  return {
    label,
    modifier: tool
      ? withAbility(tool.total, tool.ability, ability, actions)
      : ability.check,
    mode: tool ? tool.mode : ability.checkMode,
    source: { kind: 'tool', key, ...linked },
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
 * Damage or healing a description deals, which a tap rolls with the player's dice, named for where
 * it's from; first asking which kind, where it offers a choice. A right-click, a long-press, or the
 * keyboard's context menu key offers other ways to roll it, as an action's damage does: as a
 * critical hit's, for damage; at its highest; or with its dice changed first; then which kind,
 * where it offers a choice, the menu saying what will be thrown, and how. Where the Gamemaster's
 * game rolls it too, it offers only those the game takes: a critical hit's as the world's rules
 * make one, where the sheet says how, and changed where the game takes it so. One whose formula the
 * app can't read is only its text.
 */
function DamageButton({
  link,
  label,
  hash,
  origin,
  actions,
  menus,
}: Readonly<{
  link: DamageLink
  label: string
  hash: string
  origin: DescriptionOrigin
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  const terms = link.parts.map(part => formulaTerms(part.formula))
  const read = terms.flatMap(each => (each ? [each] : []))
  if (read.length !== link.parts.length) return label
  const kind = link.healing ? 'healing' : 'damage'
  const name = `${origin.name} ${kind}`
  const formula = link.parts.map(part => part.formula).join(' + ')
  const choice = link.parts.find(part => part.types.length > 1)
  const table = actions.damage
  const rule = table?.critical
  const ways = damageWays(link, read, table)
  const roll = (
    chosen: string | undefined,
    { critical = false, modifiers }: DamageChoice = {},
  ) => {
    const types = link.parts.map(part =>
      chosen && part.types.includes(chosen)
        ? chosen
        : // eslint-disable-next-line unicorn/no-null -- a part of no kind has none, as the sheet's
          (part.types[0] ?? null),
    )
    actions.rollDamage({
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
          // eslint-disable-next-line unicorn/no-null -- the protocol's for the game's own kind
          part.types.length > 1 ? types[index] : null,
        ),
      }),
      // A critical hit's as the game makes one, where it rolls it too and says how; else every
      // die twice, the player's alone.
      ...(critical && { critical, ...(rule && { criticalRule: rule }) }),
      ...(modifiers && changes(modifiers) && { modifiers }),
    })
  }
  // Which kind first, where it offers a choice, then rolled so, the way chosen: the menu says what
  // will be thrown, as the damage menu says it, and how.
  const rollFrom = (
    anchor: HTMLElement,
    way?: DamageChoice,
    point?: MenuPoint,
  ) => {
    if (!choice) {
      roll(undefined, way)
      return
    }
    const critical = way?.critical === true
    const maximum = way?.modifiers?.maximize === true
    const thrown = way ? thrownBy(read, way, rule) : formula
    const how = [critical && 'Critical hit', maximum && 'Maximum']
      .filter(Boolean)
      .map(word => ` · ${word}`)
      .join('')
    let adjective = ''
    if (critical) adjective = 'critical '
    else if (maximum) adjective = 'maximum '
    menus.open({
      anchor,
      point,
      title: `${name} ${thrown}${how}`,
      items: choice.types.map(type => ({
        id: type,
        label: link.healing
          ? `Roll ${adjective}${typeLabel(type)}`
          : `Roll ${adjective}${typeLabel(type)} damage`,
        icon: link.healing ? HeartPulse : Swords,
        tint: link.healing ? 'text-primary' : 'text-damage',
      })),
      onChoose: type => roll(type, way),
    })
  }
  const props = {
    label: `${label}, roll ${kind}`,
    className: clsx(
      PILL,
      link.healing
        ? 'bg-primary/12 text-primary hover:bg-primary/20'
        : 'bg-damage/15 text-damage hover:bg-damage/25',
    ),
  }
  if (ways.length === 0) {
    return (
      <button
        type='button'
        aria-label={props.label}
        {...(choice && { 'aria-haspopup': 'menu' as const })}
        onClick={event => rollFrom(event.currentTarget)}
        className={props.className}
      >
        {label}
      </button>
    )
  }
  return (
    <RollButton
      target={link}
      onRoll={(_link, anchor) => rollFrom(anchor)}
      onMenu={(anchor, _link, point) =>
        menus.damage(
          anchor,
          {
            label: name,
            formula,
            // As thrown unchanged, each part as the kind it is, where it offers no choice.
            parts: read.map((part, index) => {
              const { types } = link.parts[index]
              return {
                terms: part,
                // eslint-disable-next-line unicorn/no-null -- none, or one still to choose
                type: types.length === 1 ? typeLabel(types[0]) : null,
              }
            }),
            healing: link.healing,
            choices: ways,
            ...(rule && { criticalRule: rule }),
            onChoose: way => rollFrom(anchor, way, point),
          },
          point,
        )
      }
      {...props}
    >
      {label}
    </RollButton>
  )
}

/**
 * What a description's damage or healing will throw, rolled the way chosen: changed as the player
 * chose, and as a critical hit's, as the world's rules make one, where the game says how, or else
 * every die twice; such as "4d10 + 2d6".
 */
function thrownBy(
  parts: ExtraTerm[][],
  { critical = false, modifiers }: DamageChoice,
  rule?: CriticalRule,
): string {
  const changed = withModifiers(
    // eslint-disable-next-line unicorn/no-null -- its kind is still to choose
    parts.map(terms => ({ terms, type: null })),
    modifiers,
    1,
  )
  if (critical && rule) return formulaOf(criticalParts(changed, rule))
  return formulaOf(changed, { doubled: critical })
}

/**
 * The other ways a description's damage or healing may be rolled, as an action's may: as a critical
 * hit's, for damage the game doesn't mark as never one, and at its highest, or with its first die
 * changed, where it has one. Where the game rolls it too, only those it takes: a critical hit's
 * where the sheet says how the world makes one, and changed where it takes it so.
 */
function damageWays(
  link: DamageLink,
  parts: ExtraTerm[][],
  table: DescribedDamage | undefined,
): RollChoice[] {
  const critical =
    !link.healing &&
    link.critical !== false &&
    (!table || table.critical !== undefined)
  const changed = !table || table.modifies
  const die = firstDie(parts.map(terms => ({ terms })))
  return [
    ...(critical ? (['critical'] as const) : []),
    ...(changed ? (['maximize'] as const) : []),
    ...(changed && die ? (['modify-damage'] as const) : []),
  ]
}

/**
 * A description's own roll, such as a d4 of luck, which a tap rolls with the player's dice, named
 * for where it's from. One whose formula the app can't read is only its text.
 */
function FormulaButton({
  link,
  label,
  hash,
  origin,
  actions,
}: Readonly<{
  link: RollLink
  label: string
  hash: string
  origin: DescriptionOrigin
  actions: DescriptionActions
}>) {
  const terms = formulaTerms(link.formula)
  if (!terms) return label
  return (
    <button
      type='button'
      aria-label={`${label}, roll it`}
      onClick={() =>
        actions.rollFormula({
          label: `${origin.name} roll`,
          terms,
          source: { kind: 'textRoll', text: hash, link: link.n },
        })
      }
      className={clsx(PILL, 'bg-primary/12 hover:bg-primary/20')}
    >
      {label}
    </button>
  )
}

/**
 * A condition a description names, underlined with dots: a hover or focus shows its rules, a tap
 * or click opens the conditions panel at it. One the app has no rules for is only bold text.
 */
function ConditionButton({
  link,
  label,
  actions,
}: Readonly<{
  link: ConditionLink
  label: string
  actions: DescriptionActions
}>) {
  if (!rulesOf(link.condition)) return <span className='ref'>{label}</span>
  return <ConditionTip id={link.condition} label={label} actions={actions} />
}

/**
 * A condition's button and the tooltip with its rules, which Escape closes, and only it, inside a
 * dialog too.
 */
function ConditionTip({
  id,
  label,
  actions,
}: Readonly<{ id: string; label: string; actions: DescriptionActions }>) {
  const [open, setOpen] = useState(false)
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      mouseOnly: true,
      delay: { open: 250 },
      handleClose: safePolygon(),
    }),
    // A tap that focuses it opens the panel, with no tooltip on the way.
    useFocus(context, { visibleOnly: true }),
    useRole(context, { role: 'tooltip' }),
    useDismiss(context),
  ])
  const rules = rulesOf(id)
  const yours = actions.conditions.find(condition => condition.id === id)
  return (
    <>
      <button
        ref={refs.setReference}
        type='button'
        aria-haspopup='dialog'
        className='font-semibold underline decoration-dotted underline-offset-2 transition-colors hover:text-primary'
        {...getReferenceProps({
          onClick: () => {
            setOpen(false)
            actions.showConditions(id)
          },
        })}
      >
        {label}
      </button>
      {open && rules && (
        <FloatingPortal root={root}>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className='z-50 flex max-w-xs flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-xs font-normal whitespace-normal text-text-primary shadow-xl'
            {...getFloatingProps()}
          >
            <p className='flex flex-wrap items-baseline gap-x-2 text-sm font-semibold'>
              {rules.name}
              {actions.rules === 'legacy' && (
                <span className='text-xs font-normal text-text-secondary'>
                  (2024 rules)
                </span>
              )}
              {yours && (
                <span className='text-xs font-semibold text-ruby'>
                  {yours.level === null
                    ? 'You have it'
                    : `You're at level ${yours.level}`}
                </span>
              )}
            </p>
            {rules.rules.map(rule => (
              <p key={rule.title}>
                <strong>{rule.title}.</strong> {rule.text}
              </p>
            ))}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

/**
 * The ways a saving throw's or check's menu offers to ask the table for it: there unless it's in a
 * secret, which the table mustn't read; with why it can't be, where it can't; and where this
 * device doesn't send rolls, to send them.
 */
function askItems(
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
    ...(actions.sendRolls
      ? [
          {
            id: 'send',
            label: 'Send my rolls to the table',
            icon: Send,
            tint: 'text-primary',
          },
        ]
      : []),
  ]
}

/**
 * Rolls a saving throw or check a description calls for, the player's own, against the DC it
 * names, if any: as the sheet has it, or with the advantage or disadvantage chosen.
 */
function rollAgainst(
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
  })
}

/** A kind of damage or healing, by dnd5e's key, as the tray says it, such as "fire". */
function typeLabel(type: string | null): string | null {
  if (type === 'temphp') return 'temporary hit points'
  return type
}

/** The advantage or disadvantage the sheet rolls a save or check with, as a menu item says it. */
function modeWord(mode: number): string {
  if (mode > 0) return ', advantage'
  if (mode < 0) return ', disadvantage'
  return ''
}

/** A reason as a sentence of its own, such as under a menu item. */
function sentence(reason: string): string {
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`
}
