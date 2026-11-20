'use client'

import { useRef } from 'react'
import { Backpack, Package } from 'lucide-react'
import { ActionEntry } from '../action-entry/action-entry'
import { enchantedEntry } from '../enchantments/enchanted-entry'
import { useFavoriteChoice } from '../favoriting/use-favorite-choice'
import { useItemMenu } from '../item-menu/use-item-menu'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { UsesButton } from '../uses-button/uses-button'
import { itemWords } from './utils'
import { useTransferring } from '@/features/transfers/hooks/use-transferring'
import { useFocusHandedOn } from '@/hooks/use-focus-handed-on'
import { itemAction } from '@/utils/sheet-actions'
import type { ActionRows } from '../action-entry/types'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetItem, SheetContainer } from '@/types/sending-stone'

/**
 * An item, or a container that opens to what it holds. Given the rows actions are in, one that
 * rolls shows what it rolls beside it, as an action does. Where the sheet gives a way to move it
 * (module 0.31.0), and there's any of it, that's beside it or in it once open; and from module
 * 0.32.0's feedback, "Send to…" in its own menu, on a right-click or long-press of its row, beside
 * "Remove…" from module 0.33.0, after "Add to favorites" or "Remove from favorites" from module
 * 0.37.0. An item that holds activities offers each of them its own entry on the activity's row.
 * As it goes from the sheet with focus in it, as once given whole, focus goes to the row beside it,
 * else to its container's (ROADMAP item 85).
 */
export function ItemEntry({
  characterId,
  item,
  rows,
  favorite: target = { type: 'item', id: item.id },
  open,
  onOpenChange,
}: Readonly<{
  characterId: string
  item: SheetItem | SheetContainer
  rows?: ActionRows
  /**
   * What its favorites entry adds or removes, from module 0.37.0: the item, unless said; null for
   * none, as among the favorites for a resource's feature.
   */
  favorite?: FavoriteTarget | null
  /**
   * Whether it's open, and its change, where its owner keeps that, as the favorites do; passed to
   * the row it's drawn as.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>) {
  const transfers = useTransferring()
  const moves = item.quantity >= 1 ? transfers.item?.(item) : undefined
  const send = item.quantity >= 1 ? transfers.send?.(item) : undefined
  // From module 0.33.0, a stack of none too, which goes whole.
  const remove = transfers.remove?.(item)
  // Its row, which hands focus on as it goes, where it has a move or Remove… (item 85).
  const row = useRef<HTMLElement>(null)
  useFocusHandedOn(row, !!(moves || send || remove))
  const favorite = useFavoriteChoice(target, item.name)
  const { onMenu, menu } = useItemMenu(item.name, { send, remove, favorite })
  const container = 'contents' in item ? item : undefined
  const { uses } = item
  const { detail, facts, meta } = itemWords(item)
  const quantity = item.quantity !== 1 && (
    <span className='text-sm font-semibold text-text-secondary tabular-nums'>
      ×{item.quantity}
    </span>
  )
  const action = rows && !container ? itemAction(item) : undefined
  if (rows && action) {
    return (
      <>
        {/* Its menu is the item's own, so its row's names none of its own. */}
        <ActionEntry
          action={action}
          rows={rows}
          favorite={null}
          open={open}
          onOpenChange={onOpenChange}
          look={{
            // What it is to carry, rather than how it's used, which it opens to; or nothing.
            detail: detail ?? '',
            marks: quantity,
            meta,
            facts,
            moves: moves?.body,
            onMenu,
            rowRef: row,
          }}
        />
        {menu}
      </>
    )
  }
  // On a party's sheet, from module 0.33.0's feedback: one spinner by its name while it's on its
  // way, its buttons disabled without their own.
  const waiting = transfers.waiting?.has(item.id) === true
  // Only something to open makes it open.
  const opened = (moves?.body || container) && (
    <>
      {moves?.body}
      {container && (
        <Contents characterId={characterId} container={container} rows={rows} />
      )}
    </>
  )
  return (
    <>
      <SheetEntry
        characterId={characterId}
        name={item.name}
        img={item.img}
        fallback={container ? Backpack : Package}
        favoriteKey={`item:${item.id}`}
        onMenu={onMenu}
        favorite={null}
        open={open}
        onOpenChange={onOpenChange}
        busy={waiting}
        detail={detail}
        aside={
          (item.quantity !== 1 || uses || moves?.aside) && (
            <span className='flex shrink-0 items-center gap-1.5'>
              {quantity}
              {uses && <UsesButton uses={uses} name={item.name} />}
              {moves?.aside}
            </span>
          )
        }
        meta={meta}
        facts={facts}
        text={item.text}
        origin={{ name: item.name, item: item.id }}
        rowRef={row}
        {...enchantedEntry(item)}
      >
        {opened || undefined}
      </SheetEntry>
      {menu}
    </>
  )
}

function Contents({
  characterId,
  container,
  rows,
}: Readonly<{
  characterId: string
  container: SheetContainer
  rows?: ActionRows
}>) {
  if (container.contents === null) {
    return (
      <p className='text-sm text-text-secondary'>
        What it holds isn&apos;t known yet.
      </p>
    )
  }
  if (container.contents.length === 0) {
    return <p className='text-sm text-text-secondary'>It&apos;s empty.</p>
  }
  return (
    <ul
      aria-label={`In the ${container.name}`}
      className='@container -ml-2.5 rounded-xl border border-border'
    >
      {container.contents.map(item => (
        <ItemEntry
          key={item.id}
          characterId={characterId}
          item={item}
          rows={rows}
        />
      ))}
    </ul>
  )
}
