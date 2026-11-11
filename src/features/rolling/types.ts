import type { useCreature } from '@/hooks/use-creature'
import type {
  SheetDamageRoll,
  RollSource,
  EffectAsk,
  TableRollState,
  RollKind,
  DamageModifiers,
  CriticalAdds,
  SheetOffer,
  LocalGmRoll,
} from '@/types/roll'
import type {
  CriticalRule,
  RollMode,
  BeastEntry,
  DamagePreview,
  SheetEffectDie,
} from '@/types/sending-stone'
import type { TableDiceAsk, TablePrompt } from '@/types/table'
import type { DieSides } from '@lambersond/3d-dice-core'
import type { LucideIcon } from 'lucide-react'

/** What a part of the sheet that rolls a d20 does when tapped, or held for its menu. */
export type RollActions = {
  onRoll: (target: RollTarget) => void
  onMenu: (anchor: HTMLElement, target: RollTarget, point?: MenuPoint) => void
}

/** How damage or healing is to be rolled, as chosen from its menu. */
export type DamageChoice = { critical?: boolean; modifiers?: DamageModifiers }

/** What a damage menu opens for: damage or healing, and the ways it may be rolled. */
export type DamageSubject = {
  /** Such as "Warhammer damage". */
  label: string
  /** As the sheet or the game puts it, such as "1d8 + 4". */
  formula: string
  /** Its parts, as they'd be thrown unchanged: a critical hit's dice as the game doubled them. */
  parts: SheetDamageRoll['parts']
  healing: boolean
  /** The ways offered: a critical hit's, at its highest, or changed first. */
  choices: RollChoice[]
  /** How many dice are thrown for each die added, as a critical hit's doubled dice take two. */
  perDie?: number
  /** For a spell or feature used with it, what using it is called, such as "Cast". */
  verb?: string
  /**
   * For damage the game rolls too, how the world's rules make a critical hit's, which the dialog's
   * critical hit then is, rather than every die twice.
   */
  criticalRule?: CriticalRule
  /**
   * For a description's damage, what a critical hit adds to each of its parts, such as a weapon's
   * extra dice and critical damage, which the dialog's critical hit throws too.
   */
  criticalAdds?: CriticalAdds
  onChoose: (choice: DamageChoice) => void
}

/** Something on the sheet that rolls: a check or save, its modifier, and the character's mode. */
export type RollTarget = {
  /** Such as "Perception check". */
  label: string
  modifier: number
  /** Advantage or disadvantage from the character's conditions and features. */
  mode: RollMode
  /** What it is, for the Gamemaster's game to make it too; unset for a roll it can't make. */
  source?: RollSource
  /**
   * For a saving throw a description's link calls for, what the link asks, such as a concentration
   * check, for the dice effects add to it (module 0.42.0).
   */
  ask?: EffectAsk
}

/**
 * What the player chose: a roll with advantage or disadvantage, or to modify the roll first; or,
 * for damage or healing, a critical hit's, every die at its highest, or to change its dice first.
 */
export type RollChoice =
  'adv' | 'dis' | 'modify' | 'critical' | 'maximize' | 'modify-damage'

/** Where the player clicked or pressed for the menu, from the top-left corner of what they hit. */
export type MenuPoint = {
  x: number
  y: number
  /** A finger or pen, whose hand would hide a menu below it. */
  touch: boolean
}

/** One of a menu's items: what it says, its icon and the icon's colour, as a class. */
export type MenuItem<T extends string> = {
  id: T
  label: string
  icon: LucideIcon
  tint?: string
  /** Why it can't be chosen now, said under it; unset where it can be. */
  disabled?: string
  /** What else to know of it, said under it where it can be chosen, such as what it spends. */
  hint?: string
}

/** The player's rolls' way to the Gamemaster's game. */
export type TableRolls = {
  /** Each roll sent, by its id. */
  states: ReadonlyMap<string, TableRollState>
  /** Whether the game takes any of the player's rolls now. */
  available: boolean
  /** Whether the player sends them from this device, as the sheet's settings say. */
  sending: boolean
  /** Whether the game takes this kind of roll from this device now. */
  takes?: (kind: RollKind) => boolean
  /**
   * Roll the damage of an attack or use the game made, as the game said it will, as the kind of
   * damage chosen, if any, and changed as the player chose, if they did.
   */
  rollDamage?: RollDue
  /** Whether the game takes damage the player changed. */
  modifies?: boolean
}

/** Roll the damage the game waits for, as the kind chosen, changed as chosen. */
export type RollDue = (
  name: string,
  due: DueDamage,
  type?: string,
  modifiers?: DamageModifiers,
) => void

/**
 * The Beasts the druid may learn, as the game lists them (module 0.40.0): those it sent, whether
 * there are more than it sent, and the rules they were chosen by; or why it didn't list them.
 */
export type WildShapeForms =
  | {
      forms: BeastEntry[]
      more: boolean
      limits: { count: number; cr: number; fly: boolean }
    }
  | { reason: string }

/** An attack or a use made at the table whose damage is still to roll there. */
export type DueDamage = {
  /** The attack's or use's id at the table. */
  use: string
  damage: DamagePreview
  /** How the player chose to change it as they used it, if they did. */
  modifiers?: DamageModifiers
}

/**
 * A spent recharge rolled (module 0.36.0): what it's called, and the uses it recharges, as the
 * sheet names them: an item's own, or one of its activities'.
 */
export type RechargeRoll = {
  label: string
  counter: { item: string; activity?: string }
}

/** A die an effect adds, as the player typed it: no values where it was skipped. */
export type TypedEffect = { die: SheetEffectDie; values: number[] }

/** A die offered, as the player typed it: no values where they left it out. */
export type TypedOffer = { offer: SheetOffer; values: number[] }

/**
 * Throws so many more of a die, for one Foundry rerolls or explodes, which `throwTerm` asks for one
 * at a time.
 */
export type More = (sides: DieSides) => (count: number) => number[]

/** What a prompt a saving throw answers asks, as far as the dice effects add to it go. */
export type EffectPrompt = Pick<TablePrompt, 'type' | 'source'>

/**
 * A roll as the dice dialog is asked for it: what it is, for the game to make it too; and for a
 * saving throw a description's link calls for, what that link asks, which only the page showing
 * the description knows.
 */
export type EffectRoll = { source?: RollSource; ask?: EffectAsk }

/**
 * A change to the ways of the rolls sent to the game (`rollStates`): one's way as the game tells
 * it, with what was kept of it as it was sent; rolls sent one after another, as one, as each is
 * made; an attack's or use's damage on its way, or not made by the game after all; or a use's
 * damage left for the player to roll.
 */
export type RollStateAction =
  | {
      type: 'way'
      id: string
      kept: Partial<TableRollState>
      state: TableRollState
    }
  | { type: 'together'; id: string; each: TableRollState[]; count: number }
  | { type: 'damaged'; use: string }
  | { type: 'undamaged'; use: string }
  | { type: 'offer'; id: string }

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), each as a roll of
 * this page's, and their ways to the game, by their ids here (`gmRollsOf`).
 */
export type GmRolls = {
  rolls: LocalGmRoll[]
  states: ReadonlyMap<string, TableRollState>
}

/** The creature a pane is for, where it isn't the character (module 0.36.0). */
export type Creature = NonNullable<ReturnType<typeof useCreature>>

/** A roll in brief, as its toast says it: what it was, what it came to, and its way to the game. */
export type RollBrief = {
  label: string
  /**
   * How its total shows, as the tray's: a critical, a fumble, damage, healing, a use or an ask; and
   * for one of the Gamemaster's as the character (#156), hidden, or dice while there's no total.
   */
  badge:
    | 'critical'
    | 'fumble'
    | 'plain'
    | 'damage'
    | 'healing'
    | 'use'
    | 'ask'
    | 'hidden'
    | 'dice'
  /** The colour its toast is edged and tinted in, by how it came out (`accentOf`). */
  accent: 'warning' | 'gold' | 'ruby' | 'damage' | 'primary'
  /** None for a use or an ask, which show an icon; "…" while the game's total is awaited. */
  total?: number | string
  /** Its dice, in a line; none for a use or an ask. */
  dice?: string
  /** Its way to the game, in the tray's words; none for a roll never sent. */
  table?: { tone: 'pending' | 'made' | 'not'; text: string }
  /** Made by the Gamemaster as the player's character (#156), marked so. */
  gm?: true
}

/**
 * A command's way to the game, in words (`wayWords`): while it's on its way, once the game has
 * done it, and where it hasn't.
 */
export type WayWords = { doing: string; done: string; not: string }

/**
 * A roll's toast: its roll's id, when it popped up, and when it goes: never, while its roll waits
 * for the player (`needsPlayer`).
 */
export type RollToast = { id: string; poppedAt: number; until: number }

/** The toasts showing, and what's known of every roll met, to pop each up only as it should. */
export type ToastBook = {
  /** Newest first, at most `TOAST_CAP` but for those that wait for the player, or just popped. */
  shown: RollToast[]
  /** Every roll met, by its id, whether it popped up or not. */
  seen: ReadonlySet<string>
  /** The rolls met while toasts were off, which never pop up. */
  quiet: ReadonlySet<string>
  /** Of each roll, how its way to the game ended, as its toast last said (`settledMark`). */
  told: ReadonlyMap<string, string>
  /** Whether the page has met its rolls yet: those it opens with are met as it opens. */
  opened: boolean
}

/** The toasts as `popToasts` writes them, and the toasts popped up now (`draftOf`). */
export type ToastDraft = ToastBook & { popped: Set<RollToast> }

/**
 * One of the terms of the dice the game asks for, from module 0.44.0, as the dice dialog asks for
 * it: by its roll's place among the ask's rolls and its own among that roll's terms.
 */
export type AskTerm = {
  roll: number
  term: number
  faces: TableDiceAsk['rolls'][number]['terms'][number]['faces']
  count: number
  /** As its group is headed, and the tray writes it: such as "2d6 Cold". */
  label: string
  /** What its Skip names it by: its roll's kind of damage, its flavor, or the ask's label. */
  name: string
}
