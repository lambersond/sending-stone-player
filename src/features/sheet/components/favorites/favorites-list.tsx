'use client'

import { useRef } from 'react'
import clsx from 'clsx'
import { useActionRows } from '../action-entry/use-action-rows'
import { NO_MARKS } from '../favorite-mark/constants'
import { FavoriteMarks } from '../favorite-mark/favorite-marks'
import { hitDieSpending } from '../hit-dice/utils'
import { FavoriteRow } from './favorite-row'
import { useWidth } from '@/features/sheet/hooks/use-width'
import type { FavoritesProps } from './types'

/**
 * How wide the favorites' card must be, in pixels, for them to be in two lists side by side, each
 * about as wide as a phone's.
 */
const SPLIT_FROM = 592

/**
 * The favorites, in the player's order, each shown as the sheet shows it elsewhere: an action
 * rolls its attack and damage, as on the Actions tab; a skill or tool rolls a check, as on the
 * Character tab; and each opens to its description. Inside them, nothing is marked a favorite, as
 * every one is. Where they're wide enough, they're in two lists side by side.
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
  // Side by side, the first half is in the first list and the rest in the second, so that each
  // stays in its list as favorites open and close.
  const half = Math.ceil(entries.length / 2)
  const lists =
    width >= SPLIT_FROM && entries.length > 1
      ? [entries.slice(0, half), entries.slice(half)]
      : [entries]
  return (
    <FavoriteMarks keys={NO_MARKS}>
      <div
        ref={card}
        className={clsx(
          'rounded-2xl border border-border bg-card p-1.5',
          lists.length > 1 && 'grid grid-cols-2 gap-x-3',
        )}
      >
        {lists.map((list, index) => (
          // A container, so that each row fits the list it's in.
          <ul key={index} className='@container min-w-0'>
            {list.map(entry => (
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
      {dialogs}
    </FavoriteMarks>
  )
}
