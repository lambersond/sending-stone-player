'use client'

import { ChoiceMenu } from '@/features/rolling/components/roll-menu/choice-menu'
import type { Opened } from './types'
import type { EffectChoice } from '../effect-controls/types'
import type { FavoriteChoice, FavoriteChoiceId } from '../favoriting/types'
import type { PrepareChoice } from '../preparing/types'
import type { MenuItem } from '@/features/rolling/types'
import type { EffectOp, PrepareOp } from '@/types/sending-stone'

/**
 * A row's own menu, opened where `useItemMenu` says: each item does what its row offers, the row
 * taking focus first, so that a dialog an item opens gives it back to the row once it closes.
 */
export function ItemMenu({
  opened,
  name,
  items,
  onClose,
  favorite,
  prepare,
  send,
  remove,
  effect,
  onDelete,
}: Readonly<{
  opened: Opened
  name: string
  items: MenuItem<FavoriteChoiceId | PrepareOp | 'send' | 'remove' | EffectOp>[]
  onClose: () => void
  favorite?: FavoriteChoice
  prepare?: PrepareChoice
  send?: () => void
  remove?: { open: () => void; waiting: boolean }
  effect?: EffectChoice
  onDelete?: () => void
}>) {
  return (
    <ChoiceMenu
      anchor={opened.anchor}
      point={opened.point}
      title={name}
      items={items}
      onClose={onClose}
      onChoose={choice => {
        // The row has focus as the dialog opens, so that the browser gives it back to the row,
        // not to the menu item that's gone, once the dialog closes.
        opened.anchor.focus({ preventScroll: true })
        onClose()
        switch (choice) {
          case 'favorite': {
            favorite?.choose()
            break
          }
          // Among the favorites, from module 0.47.0.
          case 'up': {
            favorite?.moves?.up?.()
            break
          }
          case 'down': {
            favorite?.moves?.down?.()
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
          case 'prepare':
          case 'unprepare': {
            prepare?.choose()
            break
          }
          default: {
            effect?.choose(choice)
          }
        }
      }}
    />
  )
}
