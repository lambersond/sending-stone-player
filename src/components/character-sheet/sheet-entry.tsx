'use client'

import { Fragment, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown, LoaderCircle, type LucideIcon } from 'lucide-react'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { usePressMenu } from './press-menu'
import { SheetText } from './sheet-text'
import type { DescriptionOrigin } from './description-actions'
import type { MenuPoint } from './roll-menu'

type Props = {
  characterId: string
  name: string
  /** Its icon from the game, if it has one. */
  img?: string | null
  /** Shown when there is no icon, or it fails to load. */
  fallback: LucideIcon
  /** Under the name, such as how it is used. */
  detail?: string
  /** At the end of the row, such as uses left. */
  aside?: ReactNode
  /** Shown above the description when open, such as the kind of feature. */
  meta?: string
  /** Shown above the description when open, each with its label, such as a spell's range. */
  facts?: { label: string; value: string }[]
  /** Its description's hash, if it has one. */
  text?: string | null
  /**
   * Where its description is from, as what's rolled from it is named; its name, and nothing else,
   * unless said.
   */
  origin?: DescriptionOrigin
  /** Beside its name, such as the mark that it's enchanted. */
  badge?: ReactNode
  /** Shown when open, before the description, such as the enchantments on it. */
  lead?: ReactNode
  /** Shown when open, after the description, such as what a container holds. */
  children?: ReactNode
  muted?: boolean
  /** What it's listed by among favorites, such as "item:<id>", to be marked if it's one. */
  favoriteKey?: string
  /**
   * Opens what else is done with it, such as Send to…: on a right-click, a long-press, or the
   * keyboard's context menu key.
   */
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void
  /**
   * From module 0.33.0's feedback, on a party's sheet: while it's on its way, one spinner right of
   * its name, and its row busy, in place of one on each of its buttons.
   */
  busy?: boolean
}

/**
 * A row on the sheet, such as a feature or an effect, that opens to show its description, loaded
 * only once it is opened. With nothing to show, it doesn't open.
 */
export function SheetEntry({
  characterId,
  name,
  img,
  fallback,
  detail,
  aside,
  meta,
  facts = [],
  text,
  origin,
  badge,
  lead,
  children,
  muted = false,
  favoriteKey,
  onMenu,
  busy = false,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const favorite = useFavorite(favoriteKey)
  const press = usePressMenu(onMenu)
  const row = (
    <>
      <EntryIcon src={img} fallback={fallback} />
      <span className='min-w-0 flex-1'>
        <span className='flex items-center gap-1'>
          <span className='truncate font-medium'>{name}</span>
          {busy && (
            <LoaderCircle
              aria-hidden
              className='size-3.5 shrink-0 text-text-secondary motion-safe:animate-spin'
            />
          )}
          {favorite && <FavoriteStar />}
          {badge}
        </span>
        {detail && (
          <span className='block truncate text-xs text-text-secondary'>
            {detail}
          </span>
        )}
      </span>
      {aside}
    </>
  )
  const rowClass = clsx(
    'flex items-center gap-3 rounded-xl px-2.5 py-2',
    muted && 'opacity-60',
  )

  if (!text && !meta && facts.length === 0 && !lead && !children) {
    return (
      <li aria-busy={busy || undefined}>
        <div
          className={clsx(rowClass, press.className)}
          // A row with a menu takes focus, so that Shift+F10 or the context menu key opens it, as
          // on a row that opens (module 0.33.0).
          tabIndex={onMenu ? 0 : undefined}
          {...press.props}
        >
          {row}
          <span aria-hidden className='size-4 shrink-0' />
        </div>
      </li>
    )
  }
  return (
    <li aria-busy={busy || undefined}>
      <details onToggle={event => setOpen(event.currentTarget.open)}>
        <summary
          className={clsx(
            rowClass,
            'cursor-pointer list-none transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden',
            press.className,
          )}
          {...press.props}
        >
          {row}
          {/* By its own state: an entry can sit open inside another, such as a pouch in a
              backpack, and a closed one inside it mustn't look open. */}
          <ChevronDown
            aria-hidden
            className={clsx(
              'size-4 shrink-0 text-text-secondary transition-transform',
              open && 'rotate-180',
            )}
          />
        </summary>
        {open && (
          <div className='flex flex-col gap-2 px-2.5 pt-1 pb-3 pl-[3.25rem]'>
            {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
            {facts.length > 0 && (
              <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs'>
                {facts.map(fact => (
                  <Fragment key={fact.label}>
                    <dt className='font-semibold text-text-secondary'>
                      {fact.label}
                    </dt>
                    <dd>{fact.value}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            {lead}
            {text && (
              <SheetText
                characterId={characterId}
                hash={text}
                origin={origin ?? { name }}
              />
            )}
            {children}
          </div>
        )}
      </details>
    </li>
  )
}

/** A row's parts, such as a spell's casting time and range, joined by dots, or nothing for none. */
export function joinParts(
  ...parts: (string | false | null | undefined)[]
): string | undefined {
  const present = parts.filter(Boolean)
  return present.length > 0 ? present.join(' · ') : undefined
}

/** An entry's icon from the game, or its fallback when it has none or it fails to load. */
export function EntryIcon({
  src,
  fallback: Fallback,
}: Readonly<{ src?: string | null; fallback: LucideIcon }>) {
  const [failed, setFailed] = useState<string>()
  const box = 'size-8 shrink-0 rounded-lg border border-border'
  if (!src || failed === src) {
    return (
      <span
        aria-hidden
        className={clsx(
          box,
          'flex items-center justify-center bg-primary/10 text-primary',
        )}
      >
        <Fallback className='size-4' />
      </span>
    )
  }
  return (
    // An icon from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=''
      className={clsx(
        box,
        // The game's own SVG icons, such as its status icons, are white, made for its dark
        // controls.
        isSvg(src) ? 'bg-[#23232f] p-1' : 'bg-card object-cover',
      )}
      onError={() => setFailed(src)}
    />
  )
}

function isSvg(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith('.svg')
  } catch {
    return false
  }
}
