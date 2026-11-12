import {
  ArrowDown,
  ArrowUp,
  Power,
  PowerOff,
  Send,
  Star,
  StarOff,
  Sun,
  SunDim,
  Trash2,
} from 'lucide-react'
import { EFFECT_WORDS } from '@/utils/effect-words'
import { PREPARE_WORDS } from '@/utils/prepare-words'
import type { EffectChoice } from '../effect-controls/types'
import type { FavoriteChoice, FavoriteChoiceId } from '../favoriting/types'
import type { PrepareChoice } from '../preparing/types'
import type { MenuItem } from '@/features/rolling/types'
import type { EffectOp, PrepareOp } from '@/types/sending-stone'

/** Add to favorites, in a row's menu, from module 0.37.0. */
const ADD_FAVORITE: MenuItem<'favorite'> = {
  id: 'favorite',
  label: 'Add to favorites',
  icon: Star,
  tint: 'text-gold-text',
}

/** Remove from favorites, in a row's menu, from module 0.37.0. */
const REMOVE_FAVORITE: MenuItem<'favorite'> = {
  id: 'favorite',
  label: 'Remove from favorites',
  icon: StarOff,
  tint: 'text-text-secondary',
}

/** Move up, in a favorite's menu among the favorites: from module 0.47.0. */
const MOVE_UP: MenuItem<'up'> = {
  id: 'up',
  label: 'Move up',
  icon: ArrowUp,
  tint: 'text-text-secondary',
}

/** Move down, in a favorite's menu among the favorites: from module 0.47.0. */
const MOVE_DOWN: MenuItem<'down'> = {
  id: 'down',
  label: 'Move down',
  icon: ArrowDown,
  tint: 'text-text-secondary',
}

/** Prepare, in the menu of a spell the character hasn't prepared: from module 0.42.1. */
const PREPARE: MenuItem<'prepare'> = {
  id: 'prepare',
  label: PREPARE_WORDS.prepare.menu,
  icon: Sun,
  tint: 'text-primary',
}

/** Unprepare, in the menu of a spell the character has prepared: from module 0.42.1. */
const UNPREPARE: MenuItem<'unprepare'> = {
  id: 'unprepare',
  label: PREPARE_WORDS.unprepare.menu,
  icon: SunDim,
  tint: 'text-text-secondary',
}

/** Send to…, in an item's menu: from module 0.32.0's feedback. */
const SEND_TO: MenuItem<'send'> = {
  id: 'send',
  label: 'Send to…',
  icon: Send,
  tint: 'text-primary',
}

/** Remove…, in an item's menu, on a character's sheet: from module 0.33.0. */
const REMOVE: MenuItem<'remove'> = {
  id: 'remove',
  label: 'Remove…',
  icon: Trash2,
  tint: 'text-danger',
}

/** Turn off, in one of the character's own effects' menu: from module 0.39.0. */
const TURN_OFF: MenuItem<'disable'> = {
  id: 'disable',
  label: EFFECT_WORDS.disable.button,
  icon: PowerOff,
  tint: 'text-text-secondary',
}

/** Turn on, in one of the character's own effects' menu: from module 0.39.0. */
const TURN_ON: MenuItem<'enable'> = {
  id: 'enable',
  label: EFFECT_WORDS.enable.button,
  icon: Power,
  tint: 'text-primary',
}

/** Delete…, in one of the character's own effects' menu: from module 0.39.0. */
const DELETE_EFFECT: MenuItem<'delete'> = {
  id: 'delete',
  label: EFFECT_WORDS.delete.button,
  icon: Trash2,
  tint: 'text-danger',
}

/** Why an item can't be chosen while what it changes is on its way. */
const ON_ITS_WAY = 'It’s on its way already'

/**
 * What a menu offers of one of the character's own effects (module 0.39.0): Turn off or Turn on,
 * then Delete…, as its `ops` say, each waiting while a change of it is on its way.
 */
export function effectItems(
  effect: EffectChoice | undefined,
  onDelete: (() => void) | undefined,
): MenuItem<EffectOp>[] {
  if (!effect) return []
  const offered: MenuItem<EffectOp>[] = []
  if (effect.ops.includes('disable')) offered.push(TURN_OFF)
  else if (effect.ops.includes('enable')) offered.push(TURN_ON)
  if (effect.ops.includes('delete') && onDelete) offered.push(DELETE_EFFECT)
  return effect.waiting
    ? offered.map(item => ({ ...item, disabled: ON_ITS_WAY }))
    : offered
}

/**
 * What a row's menu offers, in order: Add to favorites or Remove from favorites, first, as the one
 * that changes nothing in the game, and among the favorites Move up and Move down where it may
 * move so (module 0.47.0); for a spell, Prepare or Unprepare (module 0.42.1); Send to…; Remove…;
 * and an effect's own (module 0.39.0). Each waits, saying why, while it's on its way.
 */
export function menuItems({
  favorite,
  prepare,
  send,
  remove,
  effects,
}: {
  favorite?: FavoriteChoice
  prepare?: PrepareChoice
  send?: () => void
  remove?: { open: () => void; waiting: boolean }
  effects: MenuItem<EffectOp>[]
}): MenuItem<FavoriteChoiceId | PrepareOp | 'send' | 'remove' | EffectOp>[] {
  return [
    // First, as the one that changes nothing in the game but where the sheet lists it; while it's
    // on its way, it waits, saying why.
    ...(favorite
      ? [
          {
            ...(favorite.op === 'add' ? ADD_FAVORITE : REMOVE_FAVORITE),
            ...(favorite.waiting && { disabled: ON_ITS_WAY }),
          },
        ]
      : []),
    // Among the favorites, from module 0.47.0: where it may move, Move up and Move down.
    ...(favorite?.moves?.up ? [MOVE_UP] : []),
    ...(favorite?.moves?.down ? [MOVE_DOWN] : []),
    // A spell's, from module 0.42.1, after its favorites entry: Prepare or Unprepare, as the sheet
    // has it now, waiting the same way.
    ...(prepare
      ? [
          {
            ...(prepare.op === 'prepare' ? PREPARE : UNPREPARE),
            ...(prepare.waiting && { disabled: ON_ITS_WAY }),
          },
        ]
      : []),
    ...(send ? [SEND_TO] : []),
    // While it, what's in it or what it's in is on its way from here, it waits, saying why.
    ...(remove
      ? [remove.waiting ? { ...REMOVE, disabled: ON_ITS_WAY } : REMOVE]
      : []),
    // An effect's own, after its favorites entry: Turn off or Turn on, then Delete… (module
    // 0.39.0).
    ...effects,
  ]
}
