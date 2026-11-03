'use client'

import { useId, useState } from 'react'
import clsx from 'clsx'
import { Sparkles } from 'lucide-react'
import { ActionChips } from '../action-chips/action-chips'
import { UsesChips } from '../action-chips/uses-chips'
import { EnchantedMark } from '../enchantments/enchanted-mark'
import { useFavorite } from '../favorite-mark/use-favorite'
import { usePressMenu } from '../press-menu/press-menu'
import { RowName } from '../row-name/row-name'
import { WildShapeRowControls } from '../wild-shape/wild-shape-row-controls'
import { WildShapeRowLine } from '../wild-shape/wild-shape-row-line'
import { ActionDetails } from './action-details'
import { ActivityEntry } from './activity-entry'
import { FALLBACKS } from './constants'
import { useActionMenu } from './use-action-menu'
import {
  entryDetail,
  foldsUses,
  otherActivities,
  usesName,
  viewOf,
} from './utils'
import { Chevron } from '@/components/chevron/chevron'
import { EntryIcon } from '@/components/entry-icon/entry-icon'
import { castOf } from '@/utils/casts'
import type { ActionRows, EntryLook } from './types'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'

/*
 * An action as the Actions tab shows it, and the favorites too, and the spells, features and
 * inventory items that roll: its name, opening to the rest, and beside it what it rolls, each a
 * button of its own.
 */

/**
 * An action in a list: its name, how it's activated and its reach, opening to the rest; and
 * beside it what it rolls, each a button of its own. A note, such as the item an activity is one
 * of, comes first. A tab that lists it otherwise shows it as it shows the rest it lists. From
 * module 0.37.0, its name opens a menu of its own, Add to favorites or Remove from favorites, where
 * the pane offers them and the tab gives it none of its own. From module 0.42.1, a spell's menu
 * prepares or unprepares it, where the pane offers that, however the spell is listed.
 */
export function ActionEntry({
  action,
  rows,
  note,
  look = {},
  section,
  favorite: target = { type: 'item', id: action.id },
}: Readonly<{
  action: SheetAction
  rows: ActionRows
  note?: string
  look?: EntryLook
  /** The section of the Actions tab it's listed in, whose kind of action goes without saying. */
  section?: string
  /**
   * What its row's favorites entry adds or removes, from module 0.37.0: its item, unless said; null
   * for none on its own row, as where the tab's menu has its own, or among the favorites for a
   * resource's feature. Its other activities keep theirs.
   */
  favorite?: FavoriteTarget | null
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const { name } = action
  const own = useActionMenu(action, target)
  // Its name opens its own menu, where it has one; what it rolls keeps the roll's.
  const press = usePressMenu(look.onMenu ?? own.onMenu)
  const view = viewOf(action, rows.spellbook, rows.use)
  const cast = castOf(action, rows.casts)
  const others = otherActivities(action, rows.spellbook)
  const uses = look.uses === undefined ? action.uses : look.uses
  const detail =
    look.detail ??
    entryDetail(action, {
      note,
      section,
      view,
      cast,
      more: open ? 0 : others.length,
      uses,
    })

  return (
    <li>
      {/* Where its chips don't fit beside its name, they wrap under it, rather than cutting the
          name short, as on a narrow phone. */}
      <div className='flex flex-wrap items-center gap-x-2 gap-y-0 rounded-xl py-1.5 pr-1.5 pl-1'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          onClick={() => setOpen(!open)}
          {...press.props}
          className={clsx(
            'flex min-w-[8.5rem] flex-1 items-center gap-3 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-primary/5',
            (view.spent ||
              look.muted ||
              cast?.short ||
              action.forward?.short) &&
              'opacity-60',
            press.className,
          )}
        >
          <EntryIcon
            src={action.img}
            fallback={FALLBACKS[action.type] ?? Sparkles}
          />
          <RowName name={name} favorite={favorite} detail={detail}>
            {!!action.enchantments?.length && <EnchantedMark />}
            <Chevron open={open} />
          </RowName>
        </button>
        <span className='ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1'>
          {look.marks}
          {uses && (
            <UsesChips
              name={usesName(action, uses)}
              uses={uses}
              rows={rows}
              spends={action.activity?.spends}
              fold={foldsUses(action, view) && look.uses === undefined}
            />
          )}
          <ActionChips action={action} view={view} rows={rows} uses={uses} />
          {/* Wild Shape's Change, Return and Known forms…, from module 0.40.0. */}
          <WildShapeRowControls id={action.id} knownForms={look.knownForms} />
        </span>
      </div>
      {/* And what Wild Shape does now, under its name, in a line of its own. */}
      <WildShapeRowLine id={action.id} />
      {open && (
        <div id={body} className='flex flex-col gap-2 pb-3'>
          {/* Its other activities, folded away with the rest until it's opened. */}
          {others.length > 0 && (
            <ul
              aria-label={`${name}: its other activities`}
              className='ml-[1.625rem] border-l border-border pl-[1.5rem]'
            >
              {others.map(other => (
                <ActivityEntry
                  key={other.key}
                  other={other}
                  parent={action}
                  rows={rows}
                  muted={look.muted}
                  section={section}
                />
              ))}
            </ul>
          )}
          <div className='flex flex-col gap-2 px-2.5 pt-1 pl-[3.25rem]'>
            <ActionDetails
              action={action}
              pools={view.pools}
              characterId={rows.characterId}
              spellbook={rows.spellbook}
              look={look}
              spending={
                uses && look.uses === undefined && foldsUses(action, view)
                  ? {
                      name: usesName(action, uses),
                      spends: action.activity?.spends,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
      {!look.onMenu && own.menu}
    </li>
  )
}
