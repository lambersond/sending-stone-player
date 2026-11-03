import type { MenuPoint, DueDamage, RollActions } from '../../../rolling/types'
import type { ActivityInfo } from '../action-info/action-info'
import type { LinkMenus } from '../description-link/description-link'
import type { AloneChoice } from '@/features/sheet/utils/damage-alone'
import type {
  SheetDamageRoll,
  AloneRow,
  SheetFormulaRoll,
  DamageModifiers,
} from '@/types/roll'
import type {
  SheetAction,
  SheetSpellSection,
  CastIndex,
} from '@/types/sending-stone'

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
