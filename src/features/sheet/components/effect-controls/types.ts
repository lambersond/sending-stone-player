import type { EffectOp, SheetEffect } from '@/types/sending-stone'
import type { RefObject } from 'react'

/** A row's effect controls: what may be done to it now, and whether a change of it waits. */
export type EffectChoice = {
  /** What may be done to it, as the sheet's `ops` say. */
  ops: EffectOp[]
  /** While a change of it is on its way, and once made until the sheet says so. */
  waiting: boolean
  /** The change on its way, whose button turns. */
  pending?: EffectOp
  choose: (op: EffectOp) => void
}

/** Where focus goes once a change chosen on a row is on the sheet. */
export type Focusing = {
  effect: string
  op: EffectOp
  /** The change's local id, by which its way is followed. */
  id: string
  /**
   * For a delete, what's beside its row as it's deleted: the next row, then the one before, then
   * the tab's panel, the first still there taking focus once it has gone.
   */
  after: (Element | undefined)[]
}

/** What a pane knows of its character's own effects. */
export type Effects = {
  /** The character's name, which Delete's dialog says it's removed from. */
  character?: string
  choiceFor: (effect: SheetEffect) => EffectChoice | undefined
  /** One of the character's effects, by the sheet's id for it, from 0.42.1: none once it's gone. */
  effectOf: (id: string) => SheetEffect | undefined
  /**
   * Sends a change of an effect, where it may be sent now: its local id; none where it isn't. From
   * 0.42.1, `at` is when its line among the rolls is kept, where a roll made it, before that roll.
   */
  send: (effect: SheetEffect, op: EffectOp, at?: number) => string | undefined
  /** Whether this change of an effect, by its local id, waits. */
  waitingOf: (effect: string, id: string, op: EffectOp) => boolean
  /** Whether the row drawn at this key is open; none where the pane keeps no rows' state. */
  openAt: (key: string) => boolean | undefined
  setOpenAt: (key: string, open: boolean) => void
  /** Where focus goes once each change chosen on a row, by its key, is on the sheet. */
  focusing: RefObject<Map<string, Focusing>>
}

/**
 * What became of an effect a die offered spent, from module 0.42.1, such as the Inspired that
 * Bardic Inspiration's die used up: gone from the sheet; or its removal on its way, or about to
 * be, waiting on another change of it; or whether the player may remove it at all, which they
 * can't where the campaign doesn't let them, at a companion's pane, or where its source isn't the
 * party's.
 */
export type Spent = { gone: boolean; removing: boolean; removable: boolean }

/** The last change of an effect's sent from here: which, its line's local id, and what it asked. */
export type SentEffect = { effect: string; id: string; op: EffectOp }
