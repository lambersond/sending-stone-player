'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Power, PowerOff, Send, Star, StarOff, Trash2 } from 'lucide-react'
import { ChoiceMenu, type MenuItem, type MenuPoint } from './roll-menu'
import { EFFECT_WORDS } from '@/utils/effect-words'
import type { EffectChoice } from './effect-controls'
import type { FavoriteChoice } from './favoriting'
import type { EffectOp } from '@/constants/sending-stone'

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
function effectItems(
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

/** Where the menu was opened: the row, and where on it, if a pointer opened it. */
type Opened = { anchor: HTMLElement; point?: MenuPoint }

/**
 * A row's own menu: what else is done with it, opened on a right-click or long-press of its row:
 * from module 0.37.0 Add to favorites or Remove from favorites, then for an item Send to…, and from
 * module 0.33.0 Remove…, and for one of the character's own effects from module 0.39.0 Turn off or
 * Turn on, then Delete…, each where it may be done. Nothing where none may.
 * @param send - Opens Send to… for it.
 * @param remove - Opens Remove… for it, and whether it waits, as while it's on its way.
 * @param favorite - Adds it to the favorites, or removes it, and whether it waits.
 * @param effect - Turns the effect off or on, as its `ops` say, and whether it waits.
 * @param onDelete - Opens the effect's Delete… confirmation, where its `ops` offer it.
 */
export function useItemMenu(
  name: string,
  {
    send,
    remove,
    favorite,
    effect,
    onDelete,
  }: Readonly<{
    send?: () => void
    remove?: { open: () => void; waiting: boolean }
    favorite?: FavoriteChoice
    effect?: EffectChoice
    onDelete?: () => void
  }>,
): {
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void
  menu: ReactNode
} {
  const [opened, setOpened] = useState<Opened>()
  const onMenu = useCallback(
    (anchor: HTMLElement, point?: MenuPoint) => setOpened({ anchor, point }),
    [],
  )
  const effects = effectItems(effect, onDelete)
  if (!send && !remove && !favorite && effects.length === 0) {
    // Nothing to do with it, as while the game takes none of it or once the last of it has gone:
    // a menu left open closes, rather than opening again by itself, at a row that may be gone, and
    // taking focus, once there is again.
    if (opened) setOpened(undefined)
    return { menu: undefined }
  }
  const items: MenuItem<'favorite' | 'send' | 'remove' | EffectOp>[] = [
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
    ...(send ? [SEND_TO] : []),
    // While it, what's in it or what it's in is on its way from here, it waits, saying why.
    ...(remove
      ? [remove.waiting ? { ...REMOVE, disabled: ON_ITS_WAY } : REMOVE]
      : []),
    // An effect's own, after its favorites entry: Turn off or Turn on, then Delete… (module
    // 0.39.0).
    ...effects,
  ]
  const menu = opened && (
    <ChoiceMenu
      anchor={opened.anchor}
      point={opened.point}
      title={name}
      items={items}
      onClose={() => setOpened(undefined)}
      onChoose={choice => {
        // The row has focus as the dialog opens, so that the browser gives it back to the row,
        // not to the menu item that's gone, once the dialog closes.
        opened.anchor.focus({ preventScroll: true })
        setOpened(undefined)
        switch (choice) {
          case 'favorite': {
            favorite?.choose()
            break
          }
          case 'send': {
            send?.()
            break
          }
          case 'remove': {
            remove?.open()
            break
          }
          case 'delete': {
            onDelete?.()
            break
          }
          default: {
            effect?.choose(choice)
          }
        }
      }}
    />
  )
  return { onMenu, menu }
}
