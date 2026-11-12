'use client'

import { useRef } from 'react'
import clsx from 'clsx'
import { ArrowDownUp } from 'lucide-react'
import { useActionRows } from '../action-entry/use-action-rows'
import { NO_MARKS } from '../favorite-mark/constants'
import { FavoriteMarks } from '../favorite-mark/favorite-marks'
import { FavoriteMovesContext } from '../favoriting/use-favorite-choice'
import { hitDieSpending } from '../hit-dice/utils'
import { FavoriteRow } from './favorite-row'
import { FavoritesReorder } from './favorites-reorder'
import { useFavoriteList } from './use-favorite-list'
import { useWidth } from '@/features/sheet/hooks/use-width'
import type { FavoritesProps } from './types'

/**
 * How wide the favorites' card must be, in pixels, for them to be in two lists side by side, each
 * about as wide as a phone's.
 */
const SPLIT_FROM = 720

/**
 * The favorites, in the player's order, each shown as the sheet shows it elsewhere: an action
 * rolls its attack and damage, as on the Actions tab; a skill or tool rolls a check, as on the
 * Character tab; and each opens to its description. Inside them, nothing is marked a favorite, as
 * every one is. Where they're wide enough, they're in two lists side by side. From module 0.47.0,
 * where the game takes it, they're put in order: Reorder, beneath them, and Move up and Move down
 * in each one's menu, an order on its way shown at once.
 */
export function FavoritesList({
  characterId,
  sheet,
  entries,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<FavoritesProps>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    sheet,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  const spending = hitDieSpending(sheet, onRollFormula)
  const card = useRef<HTMLDivElement>(null)
  const width = useWidth(card)
  const reorder = useRef<HTMLButtonElement>(null)
  const list = useFavoriteList(entries, reorder)
  const { arranged } = list
  // Side by side, the first half is in the first list and the rest in the second, so that each
  // stays in its list as favorites open and close.
  const half = Math.ceil(arranged.length / 2)
  const lists =
    width >= SPLIT_FROM && arranged.length > 1
      ? [arranged.slice(0, half), arranged.slice(half)]
      : [arranged]
  return (
    <FavoriteMarks keys={NO_MARKS}>
      {list.reordering ? (
        <FavoritesReorder
          entries={list.moving}
          onSave={list.save}
          onCancel={list.close}
        />
      ) : (
        <FavoriteMovesContext value={list.movesOf}>
          <div
            ref={card}
            className={clsx(
              'rounded-2xl border border-border bg-card p-1.5',
              lists.length > 1 && 'grid grid-cols-2 gap-x-3',
            )}
          >
            {lists.map((each, index) => (
              // A container, so that each row fits the list it's in.
              <ul key={index} className='@container min-w-0'>
                {each.map(entry => (
                  <FavoriteRow
                    key={entry.key}
                    entry={entry}
                    rows={rows}
                    abilities={sheet.abilities}
                    spending={spending}
                  />
                ))}
              </ul>
            ))}
          </div>
          {list.offered && (
            <div className='mt-1.5 flex justify-end'>
              <button
                ref={reorder}
                type='button'
                onClick={list.open}
                aria-label='Reorder favorites'
                className='inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
              >
                <ArrowDownUp aria-hidden className='size-4' />
                Reorder
              </button>
            </div>
          )}
        </FavoriteMovesContext>
      )}
      {dialogs}
    </FavoriteMarks>
  )
}
