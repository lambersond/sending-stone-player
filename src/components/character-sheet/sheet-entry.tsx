'use client'

import { Fragment, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { SheetText } from './sheet-text'

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
  /** Shown when open, after the description, such as what a container holds. */
  children?: ReactNode
  muted?: boolean
  /** What it's listed by among favorites, such as "item:<id>", to be marked if it's one. */
  favoriteKey?: string
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
  children,
  muted = false,
  favoriteKey,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const favorite = useFavorite(favoriteKey)
  const row = (
    <>
      <EntryIcon src={img} fallback={fallback} />
      <span className='min-w-0 flex-1'>
        <span className='flex items-center gap-1'>
          <span className='truncate font-medium'>{name}</span>
          {favorite && <FavoriteStar />}
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

  if (!text && !meta && facts.length === 0 && !children) {
    return (
      <li>
        <div className={rowClass}>
          {row}
          <span aria-hidden className='size-4 shrink-0' />
        </div>
      </li>
    )
  }
  return (
    <li>
      <details onToggle={event => setOpen(event.currentTarget.open)}>
        <summary
          className={clsx(
            rowClass,
            'cursor-pointer list-none transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden',
          )}
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
            {text && <SheetText characterId={characterId} hash={text} />}
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
