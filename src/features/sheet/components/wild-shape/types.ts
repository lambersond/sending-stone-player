import type { SeatRole } from '@/types/seats'
import type {
  BeastEntry,
  KnownForm,
  SheetForm,
  SheetWildShape,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { RefObject } from 'react'

/** What a command sent from here asked. */
export type Asked =
  | { op: 'transform'; form: string }
  | { op: 'revert' }
  | { op: 'learn'; uuid: string; replace: string | null }

/** A command sent from here, by its local id, and what it asked. */
export type Sent = Asked & { id: string }

export type Op = Sent['op']

/** Why the last command of an op from here wasn't made, by the reason's key. */
export type Refusal = { op: Op; key: string }

/** What the pane's one Wild Shape dialog shows: the picker, the manager, or a Beast to learn. */
export type View =
  | { kind: 'picker' }
  | { kind: 'known' }
  | { kind: 'learn'; replace?: KnownForm }

/** The Beasts to learn, as the game lists them, while it does, or why it didn't. */
export type Beasts =
  | { status: 'loading' }
  | { status: 'failed'; reason: string }
  | { status: 'done'; forms: BeastEntry[]; more: boolean }

/**
 * Where focus goes next: the ribbon's heading, the tab's panel, an element, or one in a dialog,
 * else, where that one isn't drawn any more, the one standing in for it.
 */
export type Focus =
  'heading' | 'panel' | HTMLElement | { selector: string; or?: string }

/** What the Wild Shape row says and offers, by the state it's in (round 0.40.0 §5.7). */
export type RowState = { line: string; change?: 'on' | 'off'; back: boolean }

/** What a pane knows of its character's Wild Shape, and does with it. */
export type WildShapeValue = {
  /** Whether its player may use Wild Shape from here now. */
  on: boolean
  /** Whether it's the character's own pane, not a creature's. */
  pane: boolean
  role: SeatRole
  /** The character's name, which every word of it names. */
  name: string
  sheet?: TableSheet
  block?: SheetWildShape
  form?: SheetForm
  /** Whether the game takes the character's own effects from here. */
  effects: boolean
  /** The known forms that can be taken from here now: usable, and not the one the druid is in. */
  offered: KnownForm[]
  /** What's on its way from here, while it waits. */
  waiting?: Op
  /** Why the last command of an op wasn't made, where it wasn't. */
  refusal?: Refusal
  view?: View
  /** Whether the manager was opened from the picker, which its Back goes to. */
  fromPicker: boolean
  /** The card checked in the picker, the default where none is picked. */
  checked?: string
  pick: (id: string) => void
  /** Change into the checked form. */
  change: () => void
  /** The Beast chosen to learn, by its uuid. */
  beast?: string
  pickBeast: (uuid: string) => void
  learn: (beast: BeastEntry, replace?: KnownForm) => void
  beasts?: Beasts
  loadBeasts: () => void
  openPicker: (opener: HTMLElement) => void
  openKnown: (opener: HTMLElement) => void
  /** From the picker: Known forms…, or Choose forms… where the druid knows none. */
  showKnown: (from: 'known' | 'choose') => void
  /** From the manager: Learn a form… at an empty place, or Replace… a known form. */
  showLearn: (from: string, replace?: KnownForm) => void
  back: () => void
  close: () => void
  /** The Return whose confirm is open. */
  returnAnchor?: HTMLElement
  openReturn: (opener: HTMLElement) => void
  /** Closes Return's confirm, returning the character where `confirm`. */
  closeReturn: (confirm: boolean) => void
  heading: RefObject<HTMLHeadingElement | null>
  /** What's inside the dialog, for focus to be found in it. */
  body: RefObject<HTMLDivElement | null>
  /** The shown tab's panel. */
  panel: () => HTMLElement | null
}
