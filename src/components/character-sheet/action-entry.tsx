'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ChevronDown,
  Dices,
  FlaskConical,
  Hammer,
  HeartPulse,
  Info,
  Search,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Wand,
  type LucideIcon,
} from 'lucide-react'
import {
  castAs,
  castCost,
  chargesOf,
  Facts,
  spellFacts,
  spellKind,
  useActionInfo,
  type ActivityInfo,
  type UsesSpending,
} from './action-info'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { useDamageMenu } from './damage-menu'
import {
  spellOrigin,
  useDescriptionActions,
  type DescriptionOrigin,
} from './description-actions'
import {
  checkMenuItems,
  checkOptionName,
  checkWayName,
  tableUseItems,
  useLinkMenus,
  type LinkMenus,
} from './description-link'
import {
  EndButton,
  EnchantedMark,
  EnchantmentList,
  useEnchanting,
} from './enchantments'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { useFavoriteChoice } from './favoriting'
import { NONE_LEFT } from './hit-dice'
import { useItemMenu } from './item-menu'
import { usePrepareChoice } from './preparing'
import { usePressMenu } from './press-menu'
import { RechargeChip, rechargeable } from './recharge-chip'
import { RollButton } from './roll-button'
import { REASONS } from './roll-tray'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetText } from './sheet-text'
import { spendsToo, UsesButton } from './uses-button'
import { WildShapeRowControls, WildShapeRowLine } from './wild-shape'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import {
  choicesOf,
  damageRollOf,
  type DueDamage,
} from '@/hooks/use-table-rolls'
import {
  defaultPool,
  ordinal,
  outOfSlots,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import { castIndex, castOf, type CastIndex } from '@/utils/casts'
import { rechargeWords } from '@/utils/creature-words'
import {
  alonePicks,
  alonePlan,
  aloneRollOf,
  aloneSelection,
  type AloneChoice,
  type AloneRow,
} from '@/utils/damage-alone'
import {
  changes,
  damageChanges,
  diceTakenAway,
  unmaximizable,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { checkTitle } from '@/utils/description-links'
import { allApplied, enchantOf } from '@/utils/enchantments'
import { formatModifier } from '@/utils/format-modifier'
import { formulaTerms } from '@/utils/formulas'
import { activityAction, itemSpellOf, spellAction } from '@/utils/sheet-actions'
import type { MenuPoint, RollChoice } from './roll-menu'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type { FavoriteTarget, RollSource } from '@/types/roll'
import type {
  CharacterSheet,
  SheetAction,
  SheetActivity,
  SheetCast,
  SheetCheck,
  SheetEnchant,
  SheetForward,
  SheetSpell,
  SheetSpellSection,
  SheetUses,
} from '@/types/sending-stone'

/*
 * An action as the Actions tab shows it, and the favorites too, and the spells, features and
 * inventory items that roll: its name, opening to the rest, and beside it what it rolls, each a
 * button of its own.
 */

/**
 * An action's damage or healing, ready to roll, with its formula as dnd5e shows it; and from module
 * 0.41.0 the row it's of, for damage on its own's choices.
 */
export type DamageTarget = SheetDamageRoll & {
  formula: string
  action?: SheetAction
}

export type DamageActions = {
  /** Rolls it, from the chip tapped, which a choice of its kind opens from where one's asked. */
  onRoll: (target: DamageTarget, anchor: HTMLElement) => void
  /**
   * Offers other ways to roll it; or, for the damage of a spell or feature used in the game, to
   * use it with its damage changed.
   */
  onMenu: (
    anchor: HTMLElement,
    target: DamageTarget,
    point?: MenuPoint,
    use?: DamageUse,
  ) => void
  /**
   * Whether it will go to the table on its own, from module 0.36.0, for its chip to say so: this
   * device sends damage so, the game plans it, and no attack of its own waits for it.
   */
  goesAlone: (target: DamageTarget) => boolean
}

/** A spell or feature used in the game, its damage to follow, as its damage chip's menu uses it. */
export type DamageUse = {
  /** Such as "Cast". */
  verb: string
  onUse: (modifiers?: DamageModifiers) => void
}

/** Using a spell or feature in the Gamemaster's game, rather than rolling it here. */
export type UseActions = {
  /** Uses it, its damage changed as the player chose, if they did. */
  onUse: (action: SheetAction, modifiers?: DamageModifiers) => void
  /**
   * Whether damage rolled here goes to the table on its own, from module 0.36.0: a damage or
   * healing chip then rolls it so, rather than using its spell or feature.
   */
  sendsAlone: boolean
}

/** What the Gamemaster's game does with damage rolled from the sheet, while it takes damage. */
export type TableDamage = {
  /** Whether it takes damage the player changed. */
  modifies: boolean
  /** An attack's or a use's damage due at the table, if it's waiting for it. */
  dueFor: (source: { item: string; activity: string }) => DueDamage | undefined
  /** Whether damage rolled here goes to it on its own, from module 0.36.0. */
  sendsAlone: boolean
  /** Whether it takes a spent recharge rolled here, from module 0.36.0. */
  recharges: boolean
  /**
   * Where it takes damage on its own's choices, from module 0.41.0: asks the player for those of
   * a row the game sends them for, where there's anything to ask, then goes on with what they
   * picked; or at once, with nothing picked.
   */
  pickAlone?: (pick: AlonePick) => void
}

/**
 * Damage on its own whose choices are asked, from module 0.41.0: the row it's of, whether it's
 * healing, what the player chose of it already, as from its chip's menu, the chip it's rolled from,
 * and how it goes on once they've picked, from the row and the spellbook as the picker showed them
 * then, which the sheet may have changed since the chip was tapped.
 */
export type AlonePick = {
  action: SheetAction
  healing: boolean
  choice: AloneChoice
  anchor: HTMLElement
  onPicked: (picks: AloneChoice, shown: AloneRow) => void
}

/**
 * What every action's row needs: the character, its spellbook, and what rolling does; and using
 * spells and features, while the Gamemaster's game takes them.
 */
export type ActionRows = {
  characterId: string
  spellbook: SheetSpellSection[]
  /** How each spell an item casts is cast, by its copy's id. */
  casts: CastIndex
  d20: RollActions
  damage: DamageActions
  use?: UseActions
  /** Rolls an activity's own formula, such as a light's radius. */
  formula?: (roll: SheetFormulaRoll) => void
  /** Opens what there is to read of one of an item's activities folded beneath it. */
  about: (info: ActivityInfo) => void
  /** Opens the menu of a check an activity asks for, as a description's check opens its own. */
  menus: LinkMenus
  /**
   * Whether the game takes a spent recharge rolled from here, from module 0.36.0, for a row's
   * Recharge chip to show.
   */
  recharges?: boolean
}

/**
 * How a tab shows something it lists as an action, where it's shown otherwise than on the Actions
 * tab: such as a spell on the Spells tab, with its school and components, or an item in the
 * inventory, with its weight and price.
 */
export type EntryLook = {
  /** Under its name, in place of how it's used; empty for nothing. */
  detail?: string
  /** Beside what it rolls, such as a spell's marks or how many there are of an item. */
  marks?: ReactNode
  /** Over its facts once it's open, in place of what kind of action it is. */
  meta?: string
  /** Its own facts, after how and at whom it's used, such as a spell's duration. */
  facts?: { label: string; value: string }[]
  /** Faded, such as a spell not prepared. */
  muted?: boolean
  /**
   * Uses to show in place of its own, such as those of the resource a favorite feature stands
   * for; null for none. Only shown: what it spends in the game is its own. Given, they're shown
   * however narrow the list, as they're what it's there for.
   */
  uses?: SheetUses | null
  /** Shown once it's open, after its enchantments, such as Give… */
  moves?: ReactNode
  /**
   * Shown once it's open, before its facts, such as what Wild Shape gives on Features (module
   * 0.40.0).
   */
  lead?: ReactNode
  /** On Features, Wild Shape's row offers Known forms… too (module 0.40.0). */
  knownForms?: boolean
  /**
   * Opens what else is done with it, such as Send to…: on a right-click, a long-press, or the
   * keyboard's context menu key.
   */
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void
}

/**
 * What every action's row needs, on a tab or among the favorites, with the menus and dialogs its
 * rolls open in `dialogs`, to be put on the page.
 */
export function useActionRows({
  characterId,
  sheet,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  /** Its spellbook, and wherever a spell an item casts is listed with how it's cast. */
  sheet: Pick<
    CharacterSheet,
    'spells' | 'actions' | 'inventory' | 'features' | 'favorites'
  >
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>): { rows: ActionRows; dialogs: ReactNode } {
  const spellbook = sheet.spells
  const casts = useMemo(() => castIndex(sheet), [sheet])
  const { actions: d20, dialogs } = useD20Rolls(onRoll)
  // A check an activity asks for rolls as a description's does, against its DC; and damage on its
  // own asks its kind from its chip, as a description's damage does.
  const { menus, dialogs: checks } = useLinkMenus(useDescriptionActions())
  const { actions: damage, dialogs: damageMenu } = useDamageRolls(
    onRollDamage,
    tableDamage,
    menus,
    spellbook,
  )
  const { show: about, dialog: info } = useActionInfo(characterId, spellbook)
  return {
    rows: {
      characterId,
      spellbook,
      casts,
      d20,
      damage,
      ...(onUse && {
        use: { onUse, sendsAlone: tableDamage?.sendsAlone === true },
      }),
      ...(onRollFormula && { formula: onRollFormula }),
      about,
      menus,
      recharges: tableDamage?.recharges === true,
    },
    dialogs: (
      <>
        {dialogs}
        {damageMenu}
        {info}
        {checks}
      </>
    ),
  }
}

/** Icons for actions without one of their own, by the item's type. */
export const FALLBACKS: Record<string, LucideIcon> = {
  weapon: Sword,
  spell: Wand,
  consumable: FlaskConical,
  equipment: Shield,
}

/** What an item is, for a type other than a spell. */
const KINDS: Record<string, string> = {
  weapon: 'Weapon',
  equipment: 'Equipment',
  consumable: 'Consumable',
  feat: 'Feature',
  tool: 'Tool',
  loot: 'Loot',
}

/**
 * Rolling an action's damage or healing from the sheet. A tap rolls it; a right-click or
 * long-press offers other ways: as a critical hit's, for damage rolled here; at its highest, unless
 * it takes a die away; or with its dice changed first, more of them or another size, where it has a
 * first die to change. For damage the Gamemaster's game is waiting for, the game decides a critical
 * hit, and the rest is offered where it takes them. A spell or feature the game uses offers to use
 * it so, its damage to follow. From module 0.36.0, damage this device sends on its own, where no
 * attack of its own waits for it, is rolled from the dice the game said it throws, asking first
 * which kind where it offers a choice, and offers a critical hit's only where the game makes one
 * of it. A menu that would offer nothing isn't opened. The menu and its dialog are in `dialogs`,
 * to be put on the page. From module 0.41.0, where the game takes damage on its own's choices and
 * sends a row's, its choices are asked first, after the menu's where it was long-pressed, and it's
 * rolled from the plan they pick, its kind asked from that plan.
 * @param menus - Where a choice of its kind is asked, from the chip.
 * @param spellbook - The slots a spell's damage on its own may be rolled at.
 */
export function useDamageRolls(
  onRollDamage: (roll: SheetDamageRoll) => void,
  table: TableDamage | undefined,
  menus: LinkMenus,
  spellbook: SheetSpellSection[] = [],
): {
  actions: DamageActions
  dialogs: ReactNode
} {
  const { open, dialogs } = useDamageMenu()
  // Damage due on an attack made at the table goes on that attack, whatever the switch.
  const dueOf = (target: DamageTarget) =>
    target.source && table?.dueFor(target.source)
  const goesAlone = (target: DamageTarget) =>
    !!target.alone?.plan && !!table?.sendsAlone && !dueOf(target)
  const roll = (
    target: DamageTarget,
    choice: AloneChoice & { picked?: true },
    anchor: HTMLElement,
    // The slots damage on its own may be rolled at: once its choices are picked, as the picker
    // showed them.
    spells: SheetSpellSection[] = spellbook,
  ): void => {
    const { critical = false, modifiers } = choice
    const request: SheetDamageRoll = {
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
      ...(target.source && { source: target.source }),
      ...(modifiers && changes(modifiers) && { modifiers }),
    }
    const { alone } = target
    // Due damage first, which the pane rolls on its attack whatever the switch; then damage on
    // its own; else as ever, rolled here, or using its spell or feature.
    if (dueOf(target) || !alone?.plan || !table?.sendsAlone) {
      onRollDamage(request)
      return
    }
    // As the action's name, which the roll's label adds "damage" or "healing" to again.
    const name = target.label.replace(/ (damage|healing)$/, '')
    // Its choices, from module 0.41.0, where the game takes them and sends the row's: asked first,
    // once, where there's anything to ask; then its plan is the one they pick (round 0.41.0
    // §2.3.7-§2.3.9).
    const row: AloneRow | undefined =
      table.pickAlone && target.action && alone.plan.choices
        ? { action: target.action, spells }
        : undefined
    if (row && table.pickAlone && !choice.picked) {
      table.pickAlone({
        action: row.action,
        healing: target.healing === true,
        choice,
        anchor,
        // Rolled from the row the picker showed as they picked, and its plans: the page's next
        // poll may have changed both since the chip was tapped, as a slot the Gamemaster gives
        // does, and the dice must be those of the level picked from the chips shown.
        onPicked: (picks, shown) =>
          roll(
            pickedTarget(target, shown.action),
            { ...choice, ...picks, picked: true },
            anchor,
            shown.spells,
          ),
      })
      return
    }
    const plan = row
      ? alonePlan(
          alone.plan,
          alonePicks(
            row.action,
            row.spells,
            aloneSelection(alone.plan, row, choice),
          ),
        )
      : alone.plan
    // Its kinds, and the dice the menu names, are the plan's picked.
    const formula = row
      ? plan.normal.rolls.map(each => each.formula).join(' + ')
      : target.formula
    const kinds = choicesOf(plan.normal)
    if (kinds.length > 0 && !choice.type) {
      const maximum = modifiers?.maximize === true
      const how = [critical && 'Critical hit', maximum && 'Maximum']
        .filter(Boolean)
        .map(word => ` · ${word}`)
        .join('')
      let adjective = ''
      if (critical) adjective = 'critical '
      else if (maximum) adjective = 'maximum '
      menus.open({
        anchor,
        title: `${name} ${formula}${how}`,
        items: kinds.map(({ key, label }) => ({
          id: key,
          label: target.healing
            ? `Roll ${adjective}${label}`
            : `Roll ${adjective}${label} damage`,
          icon: target.healing ? HeartPulse : Swords,
          tint: target.healing ? 'text-primary' : 'text-damage',
        })),
        onChoose: type => roll(target, { ...choice, type }, anchor, spells),
      })
      return
    }
    onRollDamage(aloneRollOf(name, alone, choice, row) ?? request)
  }
  const onMenu: DamageActions['onMenu'] = (anchor, target, point, use) => {
    const subject = {
      label: target.label,
      formula: target.formula,
      healing: target.healing === true,
    }
    const changed: RollChoice[] = damageChanges(target.parts)
    if (use) {
      if (!table?.modifies || changed.length === 0) return
      open(
        anchor,
        {
          ...subject,
          parts: target.parts,
          choices: changed,
          verb: use.verb,
          onChoose: ({ modifiers }) => use.onUse(modifiers),
        },
        point,
      )
      return
    }
    const due = dueOf(target)
    if (due) {
      if (!table?.modifies) return
      // As the game will throw it: a critical hit's dice as it doubled them; damage it rolls itself
      // at its highest only where its formula takes no die away, nor explodes one.
      const game = damageRollOf(target.label, due)
      const choices = damageChanges(
        game.parts,
        game.fixed,
        diceTakenAway(due.damage) || unmaximizable(due.damage),
      )
      if (choices.length === 0) return
      open(
        anchor,
        {
          ...subject,
          parts: game.parts,
          perDie: game.perDie,
          choices,
          onChoose: choice => roll(target, choice, anchor),
        },
        point,
      )
      return
    }
    const plan = target.alone?.plan
    if (target.alone && plan && goesAlone(target)) {
      // As the game will throw it: a critical hit's only where it makes one, never of healing; its
      // highest and its dice changed only where it takes damage changed.
      const game = aloneRollOf(
        target.label.replace(/ (damage|healing)$/, ''),
        target.alone,
      )
      const choices: RollChoice[] = [
        ...(plan.critical && !target.healing ? (['critical'] as const) : []),
        ...(table?.modifies && game
          ? damageChanges(
              game.parts,
              game.fixed,
              diceTakenAway(plan.normal) || unmaximizable(plan.normal),
            )
          : []),
      ]
      if (!game || choices.length === 0) return
      open(
        anchor,
        {
          ...subject,
          parts: game.parts,
          perDie: game.perDie,
          choices,
          onChoose: choice => roll(target, choice, anchor),
        },
        point,
      )
      return
    }
    const choices: RollChoice[] = target.healing
      ? changed
      : ['critical', ...changed]
    if (choices.length === 0) return
    open(
      anchor,
      {
        ...subject,
        parts: target.parts,
        choices,
        onChoose: choice => roll(target, choice, anchor),
      },
      point,
    )
  }
  return {
    actions: {
      onRoll: (target, anchor) => roll(target, {}, anchor),
      onMenu,
      goesAlone,
    },
    dialogs,
  }
}

/**
 * An action as it's shown, worked out once for a row: its damage or healing and their kinds, for a
 * spell cast with slots, which it can be cast with and whether any are left; and, while the
 * Gamemaster's game takes spells and features, which of its chips use it there: its saving throw's
 * and damage's, for an activity that calls for one or deals it, or else one of its own.
 */
export function viewOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  using?: UseActions,
) {
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const pools = slotPools(action, spellbook)
  const formula = action.damage.map(part => part.formula).join(' + ')
  const use =
    using && action.activity && action.identified ? action.activity : undefined
  const save = !!use && use.type === 'save' && !!action.save
  // An enchant activity is used through a chip of its own, as a utility is, its damage rolled here.
  // Damage this device sends on its own, from module 0.36.0, goes so rather than using it.
  const damage =
    !!use &&
    use.type !== 'utility' &&
    use.type !== 'enchant' &&
    !!formula &&
    !action.attackId &&
    !(using?.sendsAlone && action.tableDamage)
  const onUse =
    using &&
    ((modifiers?: DamageModifiers) =>
      modifiers ? using.onUse(action, modifiers) : using.onUse(action))
  return {
    healing,
    formula,
    target: damageTarget(action, healing),
    types: [
      ...new Set(action.damage.flatMap(part => (part.type ? [part.type] : []))),
    ],
    pools,
    spent: outOfSlots(action, pools),
    /** What the chips do in the game, if anything. */
    uses: {
      save: save ? onUse : undefined,
      damage: damage ? onUse : undefined,
      chip: use && !save && !damage ? onUse : undefined,
    },
  }
}

/**
 * An action in a list: its name, how it's activated and its reach, opening to the rest; and
 * beside it what it rolls, each a button of its own. A note, such as the item an activity is one
 * of, comes first. A tab that lists it otherwise shows it as it shows the rest it lists. From
 * module 0.37.0, its name opens a menu of its own, Add to favorites or Remove from favorites, where
 * the pane offers them and the tab gives it none of its own. From module 0.42.1, a spell's menu
 * prepares or unprepares it, where the pane offers that, however the spell is listed.
 */
export function ActionEntry({
  action,
  rows,
  note,
  look = {},
  section,
  favorite: target = { type: 'item', id: action.id },
}: Readonly<{
  action: SheetAction
  rows: ActionRows
  note?: string
  look?: EntryLook
  /** The section of the Actions tab it's listed in, whose kind of action goes without saying. */
  section?: string
  /**
   * What its row's favorites entry adds or removes, from module 0.37.0: its item, unless said; null
   * for none on its own row, as where the tab's menu has its own, or among the favorites for a
   * resource's feature. Its other activities keep theirs.
   */
  favorite?: FavoriteTarget | null
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const { name } = action
  const own = useItemMenu(name, {
    favorite: useFavoriteChoice(target, name),
    // A spell's, by its id, whichever tab or favorite lists it as an action (module 0.42.1).
    prepare: usePrepareChoice(action.type === 'spell' ? action.id : undefined),
  })
  // Its name opens its own menu, where it has one; what it rolls keeps the roll's.
  const press = usePressMenu(look.onMenu ?? own.onMenu)
  const view = viewOf(action, rows.spellbook, rows.use)
  const cast = castOf(action, rows.casts)
  const others = otherActivities(action, rows.spellbook)
  const uses = look.uses === undefined ? action.uses : look.uses
  // A spent recharge rolled from here, from module 0.36.0, where the game takes it.
  const recharge = rechargeOf(rows, uses)
  const detail =
    look.detail ??
    joinParts(
      note,
      action.activityName,
      activationIn(action, section),
      action.range,
      view.types.join(', '),
      castNote(cast),
      forwardNote(action.forward),
      view.spent && 'No slots left',
      firstInFoundry(action) && 'Used in Foundry',
      !open && moreNote(others.length),
      // What recharges its uses, as dnd5e's stat block says it, in place of "Recharge [5+]".
      uses?.recharge ? rechargeWords(uses.recharge) : undefined,
    )

  return (
    <li>
      {/* Where its chips don't fit beside its name, they wrap under it, rather than cutting the
          name short, as on a narrow phone. */}
      <div className='flex flex-wrap items-center gap-x-2 gap-y-0 rounded-xl py-1.5 pr-1.5 pl-1'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          onClick={() => setOpen(!open)}
          {...press.props}
          className={clsx(
            'flex min-w-[8.5rem] flex-1 items-center gap-3 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-primary/5',
            (view.spent ||
              look.muted ||
              cast?.short ||
              action.forward?.short) &&
              'opacity-60',
            press.className,
          )}
        >
          <EntryIcon
            src={action.img}
            fallback={FALLBACKS[action.type] ?? Sparkles}
          />
          <span className='min-w-0 flex-1'>
            {/* The mark sits by the name, where it lines up from row to row whatever each
                rolls. */}
            <span className='flex items-center gap-1'>
              <span className='truncate font-medium'>{name}</span>
              {favorite && <FavoriteStar />}
              {!!action.enchantments?.length && <EnchantedMark />}
              <Chevron open={open} />
            </span>
            {detail && (
              <span className='block truncate text-xs text-text-secondary'>
                {detail}
              </span>
            )}
          </span>
        </button>
        <span className='ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1'>
          {look.marks}
          {/* First of its chips, beside its uses, which show with it however narrow the list. */}
          {uses && recharge && (
            <RechargeChip
              name={usesName(action, uses)}
              uses={uses}
              onRoll={recharge}
            />
          )}
          {uses && (
            <ChipUses
              uses={uses}
              view={view}
              action={action}
              always={look.uses !== undefined || !!recharge}
            />
          )}
          <ActionChips action={action} view={view} rows={rows} uses={uses} />
          {/* Wild Shape's Change, Return and Known forms…, from module 0.40.0. */}
          <WildShapeRowControls id={action.id} knownForms={look.knownForms} />
        </span>
      </div>
      {/* And what Wild Shape does now, under its name, in a line of its own. */}
      <WildShapeRowLine id={action.id} />
      {open && (
        <div id={body} className='flex flex-col gap-2 pb-3'>
          {/* Its other activities, folded away with the rest until it's opened. */}
          {others.length > 0 && (
            <ul
              aria-label={`${name}: its other activities`}
              className='ml-[1.625rem] border-l border-border pl-[1.5rem]'
            >
              {others.map(other => (
                <ActivityEntry
                  key={other.key}
                  other={other}
                  parent={action}
                  rows={rows}
                  muted={look.muted}
                  section={section}
                />
              ))}
            </ul>
          )}
          <div className='flex flex-col gap-2 px-2.5 pt-1 pl-[3.25rem]'>
            <ActionDetails
              action={action}
              pools={view.pools}
              characterId={rows.characterId}
              spellbook={rows.spellbook}
              look={look}
              spending={
                uses && look.uses === undefined && foldsUses(action, view)
                  ? {
                      name: usesName(action, uses),
                      spends: action.activity?.spends,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
      {!look.onMenu && own.menu}
    </li>
  )
}

/**
 * One of an action's other activities, beneath it, such as Hex's Bonus Hex Damage: its name, how
 * it differs from the action in how it's used and how far it reaches, and what it rolls beside it,
 * as an action's row has them. One the app can't use, such as a summoning, says so. One of an
 * item's opens to what there is to read of it from beside its name. From module 0.37.0, its name
 * opens a menu of its own, adding the activity itself to the favorites or removing it, where the
 * pane offers them, and is a tab stop then, for the keyboard to open it.
 */
function ActivityEntry({
  other,
  parent,
  rows,
  muted,
  section,
}: Readonly<{
  other: OtherActivity
  parent: SheetAction
  rows: ActionRows
  muted?: boolean
  section?: string
}>) {
  const { activity, action } = other
  const view = viewOf(action, rows.spellbook, rows.use)
  const cast = castOf(action, rows.casts)
  const uses = ownUses(activity, parent)
  const recharge = rechargeOf(rows, uses)
  const detail = joinParts(
    ...activityDetail(activity, parent, view.spent, { section, cast }),
  )
  const { onMenu, menu } = useActivityMenu(other)
  const press = usePressMenu(onMenu)
  return (
    // Its chips wrap under its name where both don't fit, as an action's row's do.
    <li className='flex flex-wrap items-center gap-x-2 gap-y-0 py-0.5 pr-1.5'>
      <span
        tabIndex={onMenu ? 0 : undefined}
        {...press.props}
        className={clsx(
          'min-w-[8.5rem] flex-1 py-0.5',
          (view.spent || muted || dimmed(activity, cast)) && 'opacity-60',
          onMenu &&
            'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary',
          press.className,
        )}
      >
        <span className='flex items-center gap-1'>
          <span className='truncate text-sm'>{other.name}</span>
          <ActivityInfoButton
            activity={activity}
            action={action}
            parent={parent}
            rows={rows}
            spellId={other.spellId}
          />
        </span>
        {detail && (
          <span className='block truncate text-xs text-text-secondary'>
            {detail}
          </span>
        )}
      </span>
      <span className='ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1'>
        {uses && recharge && (
          <RechargeChip
            name={usesName(action, uses)}
            uses={uses}
            onRoll={recharge}
          />
        )}
        {uses && (
          <ChipUses
            uses={uses}
            view={view}
            action={action}
            always={!!recharge}
          />
        )}
        <ActionChips action={action} view={view} rows={rows} uses={uses} />
      </span>
      {menu}
    </li>
  )
}

/**
 * The menu of one of an action's other activities, from module 0.37.0: adding the activity itself
 * to the favorites, by its item and its own id, or removing it, where the pane offers them.
 */
export function useActivityMenu(
  other: OtherActivity,
): ReturnType<typeof useItemMenu> {
  const target: FavoriteTarget = {
    type: 'activity',
    id: other.activity.id,
    item: other.action.id,
  }
  return useItemMenu(other.name, {
    favorite: useFavoriteChoice(target, other.name),
  })
}

/**
 * A button beside the name of one of an item's activities folded beneath it, such as a staff's
 * Starry Wisp, that opens what there is to read of it, as its row has no description of its own.
 * None for a spell's, such as Spirit Guardians' save each turn, as the spell opens to its own; but
 * one of a spell an item casts, beneath the item, opens to the spell, as the Spells tab lists it.
 */
export function ActivityInfoButton({
  activity,
  action,
  parent,
  rows,
  spellId,
}: Readonly<{
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  parent: SheetAction
  rows: ActionRows
  /** For one of a spell an item casts, the copy of the spell the Spells tab lists. */
  spellId?: string
}>) {
  if (parent.type === 'spell') return
  const label = `About ${actionTitle(action)}`
  return (
    // Outside its name, so that a long one is cut short before it, and as tall as the name's line.
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      title={label}
      onClick={() =>
        rows.about({
          activity: spellId ? { ...activity, spellId } : activity,
          action,
          item: parent,
          foundry: !usedFromApp(activity),
        })
      }
      className='-my-1 shrink-0 rounded-full p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary'
    >
      <Info aria-hidden className='size-4' />
    </button>
  )
}

/** One of an action's other activities, beneath it. */
export type OtherActivity = {
  activity: SheetActivity
  /** The activity as an action of its own, rolled and used as that activity alone. */
  action: SheetAction
  /**
   * What it's called: its own name, or for one of a spell an item casts, the spell's and its own,
   * such as "Hex (Bonus Hex Damage)".
   */
  name: string
  /** For one of a spell an item casts, the copy of the spell the Spells tab lists it under. */
  spellId?: string
  /** Unique among them: its action's id and its own. */
  key: string
}

/**
 * An action's other activities, after its first, which the action is, each with itself as an
 * action of its own, rolled and used as that activity alone. After each Cast, the action itself
 * where it's one, come the other activities of its spell, as the Spells tab lists the spell under
 * the item, while the item can cast it: those used after it's cast, such as Hex's Bonus Hex Damage,
 * each named for the spell too, and used as the copy's. So do those of a Cast that says nothing of
 * how it's cast, such as one whose spell summons first. None is ever one of the action's own.
 */
export function otherActivities(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): OtherActivity[] {
  const own = (action.activities ?? []).slice(1).flatMap(activity => [
    {
      activity,
      action: activityAction(action, activity),
      name: activity.name,
    },
    ...(activity.type === 'cast'
      ? spellActivities(activity.spellId, spellbook)
      : []),
  ])
  return [...spellActivities(action.spellId, spellbook), ...own].map(other => ({
    ...other,
    key: `${other.action.id}:${other.activity.id}`,
  }))
}

/**
 * The other activities of a spell an item casts, after its first, which its Cast is, as the copy of
 * it the Spells tab lists under the item has them; none while the item can't cast it.
 */
function spellActivities(
  spellId: string | null | undefined,
  spellbook: SheetSpellSection[],
): Omit<OtherActivity, 'key'>[] {
  if (!spellId) return []
  const copy = spellbook
    .flatMap(section => section.spells)
    .find(spell => spell.id === spellId && spell.castFrom?.usable !== false)
  const spell = copy && spellAction(copy)
  if (!spell) return []
  return (spell.activities ?? []).slice(1).map(activity => {
    const used = activityAction(spell, activity)
    return { activity, action: used, name: used.name, spellId }
  })
}

/** The kinds of activity the app rolls or uses; others, such as a summoning, are Foundry's. */
const FROM_APP = new Set(['attack', 'save', 'damage', 'heal', 'utility'])

/**
 * Is this an activity the app rolls or uses: one of a kind it does, or one the module says it can
 * roll or use, such as a spell a staff casts?
 */
export function usedFromApp(activity: SheetActivity): boolean {
  return (
    FROM_APP.has(activity.type) || !!(activity.attackId || activity.activity)
  )
}

/**
 * Is an activity shown faded: one used only in Foundry, a spell cast from charges not left, as
 * `castOf` says how it's cast, or one that uses another without the uses left it spends?
 */
export function dimmed(
  activity: SheetActivity,
  cast: SheetCast | null | undefined,
): boolean {
  return (
    !usedFromApp(activity) ||
    cast?.short === true ||
    activity.forward?.short === true
  )
}

/**
 * An activity's uses, beside it: none for a spell cast from its item's charges, or one that uses
 * another with the item's own uses, such as a spell's free casting, which are shown by the item
 * already.
 */
export function ownUses(
  activity: SheetActivity,
  parent: SheetAction,
): SheetAction['uses'] | undefined {
  const { uses } = activity
  const same =
    !!uses &&
    !!parent.uses &&
    uses.value === parent.uses.value &&
    uses.max === parent.uses.max
  return (activity.cast || activity.forward) && same ? undefined : uses
}

/**
 * How a row's spent recharge is rolled, from module 0.36.0, where its Recharge chip shows: uses
 * that recharge, something spent of them, and the game taking a recharge rolled from here. None
 * otherwise, as with Send to the table off, or at a gone companion's pane, which takes nothing.
 */
export function rechargeOf(
  rows: Pick<ActionRows, 'recharges' | 'formula'>,
  uses: SheetUses | null | undefined,
): ((roll: SheetFormulaRoll) => void) | undefined {
  return rows.recharges && rechargeable(uses) ? rows.formula : undefined
}

/**
 * What a spell cast from an item costs, as `castOf` says how it's cast, such as "1 charge"; for one
 * cast higher for more, what it may cost of what's left, such as "1–3 charges"; or that the item
 * hasn't enough left. Nothing for one that costs none, or a formula.
 */
export function castNote(
  cast: SheetCast | null | undefined,
): string | undefined {
  if (!cast?.charges) return undefined
  if (!cast.levels) return cast.short ? 'No charges left' : castCost(cast)
  const left = cast.levels.filter(({ short }) => !short)
  if (left.length === 0) return 'No charges left'
  const counts = left.flatMap(({ charges }) =>
    charges === null ? [] : [charges],
  )
  if (counts.length === 0) return castCost(cast)
  const [low, high] = [Math.min(...counts), Math.max(...counts)]
  return low === high ? chargesOf(low) : `${low}–${high} charges`
}

/**
 * What an activity that uses another spends, such as a spell's free casting, as `forward` says:
 * such as "1 use", or that not as many are left. Nothing for one that spends none, or what the
 * sheet can't count, such as a formula.
 */
export function forwardNote(
  forward: SheetForward | undefined,
): string | undefined {
  if (!forward?.charges) return undefined
  if (forward.short) return 'No uses left'
  return forward.charges === 1 ? '1 use' : `${forward.charges} uses`
}

/** How many more activities an action has than it shows while it's closed, such as "3 more". */
export function moreNote(count: number): string | undefined {
  return count > 0 ? `${count} more` : undefined
}

/**
 * How an action is activated, but where its section of the Actions tab says it already, as one
 * action does under Actions, or a reaction under Reactions.
 */
export function activationIn(
  action: Pick<SheetAction, 'activation' | 'activationType'>,
  section?: string,
): string | null | undefined {
  return section && action.activationType === section
    ? undefined
    : action.activation
}

/**
 * An action's name for its rolls: an item's, and the activity it's listed for, where it isn't the
 * item's first, such as "Staff (Silvery Barbs)".
 */
export function actionTitle(
  action: Pick<SheetAction, 'name' | 'activityName'>,
): string {
  return action.activityName
    ? `${action.name} (${action.activityName})`
    : action.name
}

/**
 * What the count an action's row shows is called, as the game's chat names it once it's spent:
 * one of the item's activities' own by the activity too, as the row is, such as "Staff of Stars
 * (Starry Wisp)"; the item's own, or a resource's, by the item, whichever of its activities the
 * row is listed for, such as "Channel Divinity", not "Channel Divinity (Divine Sense)".
 */
export function usesName(
  action: Pick<SheetAction, 'name' | 'activityName'>,
  uses: SheetUses,
): string {
  const { counter } = uses
  return counter && 'item' in counter && counter.activity
    ? actionTitle(action)
    : action.name
}

/**
 * Is an action with more than one activity first one the app can't use, such as Flaming Sphere's
 * summoning, with the rest beneath it?
 */
export function firstInFoundry(action: SheetAction): boolean {
  const [first] = action.activities ?? []
  return !!first && !usedFromApp(first)
}

/**
 * What to say of one of an action's activities beneath it: how it's used and how far it reaches,
 * where that differs from the action, its kinds of damage, and whether it's out of slots, or used
 * only in Foundry.
 */
export function activityDetail(
  activity: SheetActivity,
  parent: SheetAction,
  spent: boolean,
  {
    section,
    range = true,
    cast,
  }: {
    /** The section of the Actions tab it's listed in. */
    section?: string
    /** Whether to say how far it reaches, which a table has a column for. */
    range?: boolean
    /** For a spell cast from an item, how, as `castOf` says. */
    cast?: SheetCast | null
  } = {},
): (string | false | null | undefined)[] {
  return [
    activity.activation !== parent.activation &&
      activationIn(activity, section),
    range && activity.range !== parent.range && activity.range,
    [
      ...new Set(
        activity.damage.flatMap(part => (part.type ? [part.type] : [])),
      ),
    ].join(', '),
    castNote(cast),
    forwardNote(activity.forward),
    spent && 'No slots left',
    !usedFromApp(activity) && 'Used in Foundry',
  ]
}

/**
 * An action's uses beside what it rolls, which in a narrow list are listed when it opens; unless
 * they're to be shown `always`, such as a resource's count among the favorites, or it's used with
 * a plain Use, which leaves room for them, and whose count is what it's there for. Where the game
 * takes charges spent from here, they're a button that spends them.
 */
function ChipUses({
  uses,
  view,
  action,
  always = false,
}: Readonly<{
  uses: NonNullable<SheetAction['uses']>
  view: ReturnType<typeof viewOf>
  action: SheetAction
  always?: boolean
}>) {
  const folds = foldsUses(action, view) && !always
  return (
    // Beside what the action rolls, in a narrow list, its uses would leave its name too little
    // room; they're listed when it opens. A count shown always cuts the name short instead.
    <span data-uses className={clsx('shrink-0', folds && 'hidden @md:inline')}>
      <UsesButton
        uses={uses}
        name={usesName(action, uses)}
        spends={action.activity?.spends}
      />
    </span>
  )
}

/**
 * Does an action roll something beside its uses, which in a narrow list folds them away until it
 * opens: an attack, a saving throw, damage or healing, an enchantment, a check or a formula? Not a
 * plain Use, which leaves room for them.
 */
function foldsUses(
  action: SheetAction,
  view: ReturnType<typeof viewOf>,
): boolean {
  return (
    action.toHit !== null ||
    !!action.save ||
    !!view.formula ||
    (!!view.uses.chip && !!enchantOf(action.activity)) ||
    !!action.check ||
    !!action.rollFormula
  )
}

/**
 * What an action rolls, each a button of its own: its attack's bonus, its saving throw, its
 * damage or healing, its own formula, or using it in the game.
 */
export function ActionChips({
  action,
  view,
  rows,
  uses,
}: Readonly<{
  action: SheetAction
  view: ReturnType<typeof viewOf>
  rows: ActionRows
  /** The uses its row shows, which a Use spending them, with none left, can't be. */
  uses?: SheetUses | null
}>) {
  const { toHit, save } = action
  const name = actionTitle(action)
  return (
    <>
      {toHit !== null && (
        <AttackChip
          name={name}
          toHit={toHit}
          d20={rows.d20}
          source={attackSource(action)}
        />
      )}
      {save && <SaveChip name={name} save={save} onUse={view.uses.save} />}
      {view.formula && (
        <DamageChip
          name={name}
          formula={view.formula}
          healing={view.healing}
          target={view.target}
          damage={rows.damage}
          onUse={view.uses.damage}
          verb={verbOf(action)}
        />
      )}
      {action.rollFormula && (
        <FormulaChip action={action} onRoll={rows.formula} />
      )}
      <UsingChip action={action} view={view} rows={rows} uses={uses} />
    </>
  )
}

/**
 * Using an action in the game, as a chip: its check's, for an activity that asks for one, such as
 * Fast Hands' Sleight of Hand; for one that enchants, as `EnchantChip` has it; or else, while the
 * game takes spells and features, one that uses it.
 */
export function UsingChip({
  action,
  view,
  rows,
  uses,
}: Readonly<{
  action: SheetAction
  view: ReturnType<typeof viewOf>
  rows: ActionRows
  /** The uses its row shows. */
  uses?: SheetUses | null
}>) {
  if (action.check) {
    return (
      <CheckChip
        action={action}
        check={action.check}
        rows={rows}
        onUse={view.uses.chip}
      />
    )
  }
  const enchant = enchantOf(action.activity)
  if (enchant && view.uses.chip) {
    return (
      <EnchantChip
        action={action}
        enchant={enchant}
        onUse={view.uses.chip}
        uses={uses}
      />
    )
  }
  return (
    view.uses.chip && (
      <UseChip action={action} onUse={view.uses.chip} uses={uses} />
    )
  )
}

/**
 * Using an enchant activity in the game, while the game takes spells and features: for one that
 * enchants its own item and spends nothing, such as a Flame Tongue's Engulf in Flames, a switch,
 * on while it's enchanted, that applies it or ends it, as dnd5e uses it again to end it; for one
 * that enchants its own item in every way it may already, such as Dagger of Venom's Coat Blade
 * once the blade is coated, a button that ends it, as using it again would only end it at a cost,
 * saying the item as the sheet lists it, not as the activity's row is named, such as "Dagger of
 * Venom (Coat Blade)" beneath the dagger; or else one that uses it, as any other.
 */
function EnchantChip({
  action,
  enchant,
  onUse,
  uses,
}: Readonly<{
  action: SheetAction
  enchant: SheetEnchant
  onUse: (modifiers?: DamageModifiers) => void
  uses?: SheetUses | null
}>) {
  const { belongings } = useEnchanting()
  if (enchant.toggle) {
    return <EnchantSwitch action={action} enchant={enchant} onUse={onUse} />
  }
  const [applied] = enchant.applied
  if (applied && action.activity && allApplied(enchant)) {
    return (
      <EndButton
        item={applied.item}
        itemName={belongings?.get(applied.item)?.name ?? action.name}
        enchantment={{
          id: applied.effect,
          name: profileName(enchant, applied.profile, action),
        }}
        source={{ item: action.id, activity: action.activity.id }}
        className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/20'
      />
    )
  }
  return <UseChip action={action} onUse={onUse} uses={uses} />
}

/** What a way an enchant activity enchants is called, or else the action's name. */
function profileName(
  enchant: SheetEnchant,
  id: string,
  action: SheetAction,
): string {
  return (
    enchant.profiles.find(profile => profile.id === id)?.name ??
    actionTitle(action)
  )
}

/**
 * An enchant activity that enchants its own item and spends nothing, such as Engulf in Flames, as
 * a switch: on while the item is enchanted by it, as the sheet says, or as the game said it left
 * it once it used it or ended it, until the sheet says otherwise than it did then; turned on, it's
 * used in the game, in the way chosen, where there's more than one; turned off, what it applied is
 * ended, with nothing to say so, as it costs nothing. While it's on its way, it can't be turned.
 */
function EnchantSwitch({
  action,
  enchant,
  onUse,
}: Readonly<{
  action: SheetAction
  enchant: SheetEnchant
  onUse: (modifiers?: DamageModifiers) => void
}>) {
  const { end, latestFor } = useEnchanting()
  const source = { item: action.id, activity: action.activity?.id ?? '' }
  const latest = latestFor?.(source)
  const pending = latest?.status === 'sending' || latest?.status === 'rolling'
  // What the game left it as: on where it applied it, off where it ended it.
  const outcome = latest?.status === 'done' ? latest.enchantment : undefined
  const told = outcome?.enchanted ?? undefined
  let said: boolean | undefined
  if (told) said = true
  else if (outcome?.ended) said = false
  const sheetOn = enchant.applied.length > 0
  const on = useHeld(
    said === undefined ? undefined : `${latest?.requestId}:${said}`,
    said,
    sheetOn,
    JSON.stringify(enchant.applied),
  )
  const [applied] = enchant.applied
  const effect = told?.effect ?? applied?.effect
  const turn = () => {
    if (!on) {
      onUse()
      return
    }
    if (!effect) return
    end?.(
      action.id,
      {
        id: effect,
        name:
          told?.name ?? profileName(enchant, applied?.profile ?? '', action),
      },
      source,
    )
  }
  return (
    <button
      type='button'
      role='switch'
      aria-checked={on}
      aria-label={actionTitle(action)}
      title={on ? 'On: tap to end it' : 'Off: tap to use it'}
      disabled={pending || (on && (!end || !effect))}
      onClick={turn}
      className='flex shrink-0 items-center rounded-lg p-1.5 transition-colors hover:bg-primary/5 disabled:opacity-40'
    >
      <span
        aria-hidden
        className={clsx(
          'relative h-5 w-9 rounded-full transition-colors',
          on ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
            on ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

/**
 * What the game said of something, held from when it said it until the sheet changes from how it
 * was then, as the sheet may come after it; and then, or with nothing said, as the sheet has it.
 * @param key - Which saying it is: another is held afresh.
 */
function useHeld(
  key: string | undefined,
  said: boolean | undefined,
  sheet: boolean,
  sheetKey: string,
): boolean {
  const [held, setHeld] = useState<{
    key: string
    said: boolean
    sheetKey: string
    /** Whether the sheet has changed since, and is followed from then on. */
    letGo?: boolean
  }>()
  if (key !== held?.key) {
    setHeld(
      key === undefined || said === undefined
        ? undefined
        : { key, said, sheetKey },
    )
  } else if (held && !held.letGo && held.sheetKey !== sheetKey) {
    setHeld({ ...held, letGo: true })
  }
  return held && !held.letGo && held.sheetKey === sheetKey ? held.said : sheet
}

/** The mark that an action opens, turned while it's open. */
export function Chevron({ open }: Readonly<{ open: boolean }>) {
  return (
    <ChevronDown
      aria-hidden
      className={clsx(
        'size-3.5 shrink-0 text-text-secondary transition-transform',
        open && 'rotate-180',
      )}
    />
  )
}

/**
 * What an action's attack is, for the Gamemaster's game to make it: its item and attack activity.
 * None for an action whose attack the module didn't name, as before module 0.11.0.
 */
export function attackSource(action: SheetAction): RollSource | undefined {
  return action.attackId
    ? { kind: 'attack', item: action.id, activity: action.attackId }
    : undefined
}

/** An attack's bonus, as a button that rolls it, or offers advantage and the like. */
export function AttackChip({
  name,
  toHit,
  d20,
  source,
}: Readonly<{
  name: string
  toHit: number
  d20: RollActions
  source?: RollSource
}>) {
  return (
    <RollButton
      target={{ label: `${name} attack`, modifier: toHit, mode: 0, source }}
      {...d20}
      label={`${name} attack, ${formatModifier(toHit)}`}
      className='shrink-0 rounded-lg bg-attack/15 px-2 py-1 text-sm font-bold text-attack tabular-nums transition-colors hover:bg-attack/25'
    >
      {formatModifier(toHit)}
    </RollButton>
  )
}

/**
 * The saving throw an action calls for, such as DEX 14: while the Gamemaster's game takes spells
 * and features, a button that uses it there, calling for it.
 */
export function SaveChip({
  name,
  save,
  onUse,
}: Readonly<{
  name: string
  save: NonNullable<SheetAction['save']>
  onUse?: (modifiers?: DamageModifiers) => void
}>) {
  const chip =
    'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
  const title = `${save.ability.toUpperCase()} saving throw`
  const content = (
    <>
      <span className='text-text-secondary uppercase'>{save.ability}</span>
      {save.dc !== null && ` ${save.dc}`}
    </>
  )
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={`${name}, ${title}${save.dc === null ? '' : ` DC ${save.dc}`}`}
        title={title}
        onClick={() => onUse()}
        className={clsx(chip, 'transition-colors hover:bg-primary/5')}
      >
        {content}
      </button>
    )
  }
  return (
    <span className={chip} title={title}>
      {content}
    </span>
  )
}

/**
 * A spell or feature that rolls nothing of its own, such as Bless, Shield or Action Surge, as a
 * button that casts or uses it in the Gamemaster's game. Where the module says it spends the very
 * counter its row shows, from 0.29.0, and none of it is left, it can't be: it says so, and a tap
 * does nothing, as the game would only turn it down.
 * @param uses - The uses its row shows.
 */
export function UseChip({
  action,
  onUse,
  uses,
}: Readonly<{
  action: SheetAction
  onUse: (modifiers?: DamageModifiers) => void
  uses?: SheetUses | null
}>) {
  const verb = verbOf(action)
  const spent =
    !!uses &&
    uses.value === 0 &&
    spendsToo(action.activity?.spends, uses.counter)
  return (
    <button
      type='button'
      aria-label={`${verb} ${actionTitle(action)}`}
      aria-disabled={spent || undefined}
      title={spent ? NONE_LEFT : undefined}
      onClick={() => {
        if (!spent) onUse()
      }}
      className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/20 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary/10'
    >
      {verb}
    </button>
  )
}

/**
 * The check an activity asks for, such as Fast Hands' Sleight of Hand, a tool's, or Maze's
 * Investigation: its one way's name, or "Check" for several, and its DC, where it has one, cut
 * short where it's long, but never the DC. For one the character makes, its menu: to ask the
 * table for it, by using the activity in the game, which posts dnd5e's card with a button for each
 * way, saying what that spends, or why it can't be used now; or to roll the player's own, against
 * its DC, which spends nothing and uses nothing, as the card's buttons don't: for each way the
 * character can make it, and for one, with advantage, with disadvantage, or modified first. For one
 * another creature makes, such as a spell's, a tap uses it in the game, as a saving throw's chip
 * does; and while the game doesn't take spells and features, it's only shown.
 */
export function CheckChip({
  action,
  check,
  rows,
  onUse,
}: Readonly<{
  action: SheetAction
  check: SheetCheck
  rows: ActionRows
  /** Uses it in the game, while the game takes spells and features. */
  onUse?: (modifiers?: DamageModifiers) => void
}>) {
  const actions = useDescriptionActions()
  // A gone companion's pane rolls nothing, its own check among them (module 0.36.0).
  const locked = useRollsLocked()
  const name = actionTitle(action)
  const dc = check.dc ?? undefined
  const title = checkTitle(
    check.checks.map(option => checkOptionName(option, actions)),
    { dc },
  )
  const [first] = check.checks
  const label =
    check.checks.length === 1 && first ? checkWayName(first, actions) : 'Check'
  const Icon = check.checks.every(option => option.type === 'tool')
    ? Hammer
    : Search
  const chip =
    'inline-flex max-w-36 shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
  const content = (
    <>
      <Icon aria-hidden className='size-3.5 shrink-0' />
      <span className='min-w-0 truncate'>{label}</span>
      {dc !== undefined && <span className='shrink-0'>DC {dc}</span>}
    </>
  )
  const named = `${name}, ${title}`
  if (check.own) {
    const { activity } = action
    const open = (anchor: HTMLElement) =>
      rows.menus.open({
        anchor,
        ...checkMenuItems({
          checks: check.checks,
          dc,
          title,
          ask: {
            items: tableUseItems(
              tableUseHint(action, rows),
              onUse ? undefined : (actions?.useBlocked ?? REASONS.activity),
              actions,
            ),
            choose: id => {
              if (id === 'ask') onUse?.()
              else if (id === 'send') actions?.sendRolls?.()
            },
          },
          own: true,
          actions,
          menus: rows.menus,
          // For the game to make it against the activity, as its card's button does.
          ...(activity && { from: { item: action.id, activity: activity.id } }),
          hint: 'Spends nothing',
          nameOf: option => checkWayName(option, actions),
        }),
      })
    return (
      <button
        type='button'
        aria-haspopup='menu'
        aria-label={named}
        title={title}
        disabled={locked}
        onClick={event => open(event.currentTarget)}
        className={clsx(
          chip,
          'bg-primary/10 text-primary-text transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary/10',
        )}
      >
        {content}
      </button>
    )
  }
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={named}
        title={title}
        onClick={() => onUse()}
        className={clsx(
          chip,
          'border border-border transition-colors hover:bg-primary/5',
        )}
      >
        {content}
      </button>
    )
  }
  return (
    <span className={clsx(chip, 'border border-border')} title={title}>
      {content}
    </span>
  )
}

/**
 * What using an action in the game does, as a check's menu says it, which spends whatever dnd5e
 * spends: such as "Uses Manacles (Bind)", and what it costs where the sheet says, such as "Casts
 * Maze · 8th-level slot", a spell cast from an item's charges, or an activity's that uses another.
 */
export function tableUseHint(
  action: SheetAction,
  rows: Pick<ActionRows, 'spellbook' | 'casts'>,
): string {
  const verb = verbOf(action) === 'Cast' ? 'Casts' : 'Uses'
  const pool =
    action.consumesSlot !== false && slotPools(action, rows.spellbook)
      ? defaultPool(action, rows.spellbook)
      : undefined
  let slot: string | undefined
  if (pool?.id === 'pact') slot = 'Pact slot'
  else if (pool?.level) slot = `${ordinal(pool.level)}-level slot`
  return (
    joinParts(
      `${verb} ${actionTitle(action)}`,
      castNote(castOf(action, rows.casts)),
      forwardNote(action.forward),
      slot,
    ) ?? ''
  )
}

/**
 * An activity's own formula, such as a light's radius or a fall's distance, as a button that
 * rolls it any time, apart from using the activity: in the Gamemaster's game too, while it may be
 * used there. A formula the app can't read is shown, but not rolled.
 */
export function FormulaChip({
  action,
  onRoll,
}: Readonly<{
  action: SheetAction
  onRoll?: (roll: SheetFormulaRoll) => void
}>) {
  // A gone companion's pane rolls nothing (module 0.36.0).
  const locked = useRollsLocked()
  const own = action.rollFormula
  if (!own) return
  const roll = formulaRollOf(action)
  const chip =
    'inline-flex max-w-36 shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm font-semibold tabular-nums'
  const content = (
    <>
      <Dices aria-hidden className='size-3.5 shrink-0 text-primary' />
      <span className='truncate'>{own.formula}</span>
    </>
  )
  const title = own.name ?? undefined
  if (!roll || !onRoll) {
    return (
      <span className={chip} title={title ?? own.formula}>
        {content}
      </span>
    )
  }
  return (
    <button
      type='button'
      aria-label={`Roll ${roll.label}, ${own.formula}`}
      title={title}
      disabled={locked}
      onClick={() => onRoll(roll)}
      className={clsx(
        chip,
        'transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      {content}
    </button>
  )
}

/**
 * An activity's own formula as it's rolled: named for the action and what dnd5e calls it, such as
 * "Eternal Flame: Light radius", and, while the game may use the activity, for the game to roll it
 * too. Nothing for a formula the app can't read, or of an item not identified.
 */
export function formulaRollOf(
  action: SheetAction,
): SheetFormulaRoll | undefined {
  const own = action.rollFormula
  const terms = own && action.identified ? formulaTerms(own.formula) : undefined
  if (!own || !terms) return undefined
  const title = actionTitle(action)
  return {
    label: own.name ? `${title}: ${own.name}` : `${title} roll`,
    terms,
    ...(action.activity && {
      source: {
        kind: 'formula',
        item: action.id,
        activity: action.activity.id,
      },
    }),
  }
}

/**
 * The damage or healing an action rolls, as a button that rolls it, which a right-click or
 * long-press offers other ways to roll: as a critical hit's, at its highest, or changed. A formula
 * the app can't read is shown, but not rolled. While the Gamemaster's game takes the spell or
 * feature it's of, it uses it there, and its damage or healing follows; its menu then uses it
 * with its damage changed. Where it will go to the table on its own, from module 0.36.0, it looks
 * the same, but its name says so.
 */
export function DamageChip({
  name,
  formula,
  healing,
  target,
  damage,
  onUse,
  verb = 'Use',
}: Readonly<{
  name: string
  formula: string
  healing: boolean
  target: DamageTarget | undefined
  damage: DamageActions
  onUse?: (modifiers?: DamageModifiers) => void
  /** What using it is called, such as "Cast" for a spell. */
  verb?: string
}>) {
  const chip = clsx(
    'max-w-36 shrink-0 truncate rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
    healing ? 'bg-primary/10 text-primary-text' : 'bg-damage/15 text-damage',
  )
  const alone = !!target && damage.goesAlone(target)
  const label = `${name} ${healing ? 'healing' : 'damage'}, ${formula}${alone ? ', goes to the table on its own' : ''}`
  const hover = clsx(
    'transition-colors',
    healing ? 'hover:bg-primary/20' : 'hover:bg-damage/25',
  )
  if (onUse && target) {
    return (
      <RollButton
        target={target}
        onRoll={() => onUse()}
        onMenu={(anchor, at, point) =>
          damage.onMenu(anchor, at, point, { verb, onUse })
        }
        label={label}
        className={clsx(chip, hover)}
      >
        {formula}
      </RollButton>
    )
  }
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={label}
        title={formula}
        onClick={() => onUse()}
        className={clsx(chip, hover)}
      >
        {formula}
      </button>
    )
  }
  if (!target) {
    return (
      <span className={chip} title={formula}>
        {formula}
      </span>
    )
  }
  return (
    <RollButton
      target={target}
      onRoll={damage.onRoll}
      onMenu={damage.onMenu}
      label={label}
      className={clsx(chip, hover)}
    >
      {formula}
    </RollButton>
  )
}

/**
 * What using an action in the game is called: casting, for a spell, or one an item casts, but for
 * one of a spell's activities used after it's cast, without spending a slot or the item's uses,
 * such as Spirit Guardians' save each turn; and casting, for a spell cast through an activity that
 * uses another, such as its free casting.
 */
export function verbOf(action: SheetAction): 'Cast' | 'Use' {
  // A spell cast through an activity that uses another, such as its free casting, spends no slot,
  // but is cast all the same.
  if (action.forward) return action.type === 'spell' ? 'Cast' : 'Use'
  if (action.consumesSlot === false) return 'Use'
  return action.type === 'spell' || !!action.cast ? 'Cast' : 'Use'
}

/**
 * All there is to know of an action once it's open: what it is, its facts, its description. An
 * item listed for a spell it casts opens to the spell: in full, as the Spells tab has it, where it
 * lists it under the item.
 */
export function ActionDetails({
  action,
  pools,
  characterId,
  spellbook,
  look = {},
  spending,
}: Readonly<{
  action: SheetAction
  pools: SlotPool[] | null
  characterId: string
  /** The character's spells, among which the spell an item is listed for is found. */
  spellbook: SheetSpellSection[]
  look?: EntryLook
  /** Where its row's count is folded away in a narrow list, how its uses are spent from here. */
  spending?: UsesSpending
}>) {
  const { cast } = action
  const spell = cast?.text
    ? itemSpellOf(spellbook, action.id, {
        name:
          action.activityName ?? action.activities?.[0]?.name ?? action.name,
        text: cast.text,
        casts: true,
        resolved: true,
      })
    : undefined
  const meta = look.meta ?? metaOf(action, spell)
  const text = cast?.text ?? action.text
  return (
    <>
      {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
      {look.lead}
      <Facts
        action={spell ? castAs(action, spell) : action}
        uses={look.uses}
        pools={pools}
        spending={spending}
        casting={!!spell}
        more={[
          ...(spell ? spellFacts(spell, cast) : []),
          ...(look.facts ?? []),
        ]}
      />
      <EnchantmentList
        item={action.id}
        itemName={action.name}
        enchantments={action.enchantments}
      />
      {look.moves}
      {text && (
        <SheetText
          characterId={characterId}
          hash={text}
          origin={originOf(action, spell)}
        />
      )}
    </>
  )
}

/**
 * Where the description an action opens to is from, as what's rolled from it is named: the spell
 * an item is listed for, and the item, such as "Starry Wisp (Worn Bardic Eternal Flame)"; a spell
 * and the item it's cast from, if any; or else the item.
 */
function originOf(action: SheetAction, spell?: SheetSpell): DescriptionOrigin {
  const { cast } = action
  if (cast?.text) {
    const name =
      spell?.name ??
      action.activityName ??
      action.activities?.[0]?.name ??
      action.name
    return {
      name: spellOrigin({
        name,
        castFrom: { name: action.castFrom?.name ?? action.name },
      }),
      item: action.id,
    }
  }
  if (action.type === 'spell') {
    return { name: spellOrigin(action), item: action.id }
  }
  return { name: action.name, item: action.id }
}

/**
 * What an action is, over its facts: for an item listed for a spell it casts, the spell's level,
 * and its school where the Spells tab lists it, and whom it's cast from; or else a spell's level,
 * or the item's type.
 */
function metaOf(action: SheetAction, spell?: SheetSpell): string | undefined {
  const { cast } = action
  if (!cast?.text) {
    return joinParts(kindOf(action), !action.identified && 'Not identified')
  }
  const from = action.castFrom?.name ?? action.name
  if (spell) {
    return joinParts(
      spellKind(spell),
      cast.concentration && 'Concentration',
      `From ${from}`,
    )
  }
  return joinParts(
    cast.level === 0 ? 'Cantrip' : `Level ${cast.level} spell`,
    cast.concentration && 'Concentration',
    `Cast from ${from}`,
  )
}

/** What an action is: a spell's level, or else the item's type. */
function kindOf(action: SheetAction): string | undefined {
  if (action.type === 'spell') {
    return joinParts(
      action.level === 0 ? 'Cantrip' : `Level ${action.level ?? '?'} spell`,
      action.concentration && 'Concentration',
    )
  }
  return joinParts(KINDS[action.type], action.concentration && 'Concentration')
}

/**
 * An action's damage or healing, read for rolling: each part's formula as dice and numbers, its
 * dice with what Foundry does with them, such as Great Weapon Fighting's 2d6r<=2. Unset when
 * there's none, or a formula is beyond reading, such as one with a function in it. From module
 * 0.36.0, where the game plans it on its own, its item and activity and that plan too.
 */
function damageTarget(
  action: SheetAction,
  healing: boolean,
): DamageTarget | undefined {
  if (action.damage.length === 0) return undefined
  const parts: DamageTarget['parts'] = []
  for (const part of action.damage) {
    // A part with no formula throws nothing, as before.
    const terms = part.formula.trim() === '' ? [] : formulaTerms(part.formula)
    if (!terms) return undefined
    parts.push({ terms, type: part.type })
  }
  // Its attack's activity, or else the one its row uses.
  const activity = action.attackId ?? action.activity?.id
  return {
    label: `${actionTitle(action)} ${healing ? 'healing' : 'damage'}`,
    parts,
    healing,
    formula: action.damage.map(part => part.formula).join(' + '),
    ...(action.attackId && {
      source: { item: action.id, activity: action.attackId },
    }),
    ...(action.tableDamage &&
      activity && {
        alone: { item: action.id, activity, plan: action.tableDamage },
        // Its row, for its choices, from module 0.41.0.
        action,
      }),
  }
}

/**
 * Damage on its own as the row the picker showed has it once its choices are picked, from module
 * 0.41.0: rolled from the plans the game sends for it then, as its chips were drawn from them; as
 * it was where the row has none.
 */
function pickedTarget(target: DamageTarget, row: SheetAction): DamageTarget {
  const plan = row.tableDamage
  if (!target.alone || !plan) return target
  return { ...target, action: row, alone: { ...target.alone, plan } }
}
