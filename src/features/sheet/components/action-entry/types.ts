import type { ActivityInfo } from '../action-info/types'
import type { LinkMenus } from '../description-link/types'
import type {
  MenuPoint,
  DueDamage,
  RollActions,
} from '@/features/rolling/types'
import type { AloneChoice } from '@/features/sheet/utils/types'
import type {
  SheetDamageRoll,
  AloneRow,
  SheetFormulaRoll,
  DamageModifiers,
} from '@/types/roll'
import type {
  SheetActivity,
  SheetUses,
  SheetAction,
  SheetSpellSection,
  CastIndex,
} from '@/types/sending-stone'
import type { ReactNode } from 'react'

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
type DamageUse = {
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
