'use client'

import { Fragment, useState, type ReactNode, type Ref } from 'react'
import clsx from 'clsx'
import { ChevronDown, LoaderCircle, type LucideIcon } from 'lucide-react'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { useFavoriteChoice } from './favoriting'
import { useItemMenu } from './item-menu'
import { usePressMenu } from './press-menu'
import { SheetText } from './sheet-text'
import { useImageFallback } from '@/hooks/use-image-fallback'
import type { DescriptionOrigin } from './description-actions'
import type { EffectChoice } from './effect-controls'
import type { PrepareChoice } from './preparing'
import type { MenuPoint } from './roll-menu'
import type { FavoriteTarget } from '@/types/roll'

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
  /**
   * In a narrow list, the aside on a line of its own beneath the name, as a spell-slots favorite's
   * live dots are, round 0.42.1 §U: where the list it's in, a container, is under 28rem wide, as a
   * phone's Favorites strip, a desk's Favorites column and each of a tablet's two lists are, so
   * that many dots never squeeze the name to nothing.
   */
  asideBelow?: boolean
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
   * What its row's favorites entry adds or removes, from module 0.37.0, where it's given no menu:
   * unless said, the item or effect `favoriteKey` names, and nothing for anything else; null for
   * none.
   */
  favorite?: FavoriteTarget | null
  /**
   * From module 0.33.0's feedback, on a party's sheet: while it's on its way, one spinner right of
   * its name, and its row busy, in place of one on each of its buttons.
   */
  busy?: boolean
  /**
   * Whether it's open, where its owner keeps that, as one of the character's own effects does
   * (module 0.39.0), so that it opens again wherever it's drawn next; its own otherwise.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * In its own menu, after its favorites entry, from module 0.39.0: what may be done to one of the
   * character's own effects, Turn off or Turn on, and Delete…, which `onDelete` asks about.
   */
  effectChoice?: EffectChoice
  /** For a spell's row, from module 0.42.1: its own menu's Prepare or Unprepare. */
  prepareChoice?: PrepareChoice
  /**
   * For a row that opens, in a narrow list, where the list it's in, a container, is under 28rem
   * wide: its summary wraps, so that an aside that puts itself on a line of its own there goes
   * beneath the name, its chevron staying beside the name, as a spell's "Not prepared" mark does
   * (round 0.42.1 §P review).
   */
  wraps?: boolean
  onDelete?: () => void
  /**
   * A dialog it opens, held in its row but outside what opens, so that its menu opens it from a
   * closed row too, such as an effect's Delete… (module 0.39.0).
   */
  dialog?: ReactNode
  /** The row itself, which opens it, or takes focus for its menu: for focus to be given back. */
  rowRef?: Ref<HTMLElement>
}

/** What a row's favorites key names, as the app adds and removes it: an item or an effect alone. */
function keyTarget(key: string | undefined): FavoriteTarget | undefined {
  const [type, ...rest] = key?.split(':') ?? []
  const id = rest.join(':')
  if (!id) return undefined
  return type === 'item' || type === 'effect' ? { type, id } : undefined
}

/**
 * A row on the sheet, such as a feature or an effect, that opens to show its description, loaded
 * only once it is opened. With nothing to show, it doesn't open. From module 0.37.0, one given no
 * menu has its own, Add to favorites or Remove from favorites, where the pane offers them.
 */
export function SheetEntry({
  characterId,
  name,
  img,
  fallback,
  detail,
  aside,
  asideBelow = false,
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
  favorite: target = keyTarget(favoriteKey),
  busy = false,
  open: held,
  onOpenChange,
  effectChoice,
  prepareChoice,
  wraps = false,
  onDelete,
  dialog,
  rowRef,
}: Readonly<Props>) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = held ?? ownOpen
  const setOpen = onOpenChange ?? setOwnOpen
  const favorite = useFavorite(favoriteKey)
  const own = useItemMenu(name, {
    favorite: useFavoriteChoice(target, name),
    prepare: prepareChoice,
    effect: effectChoice,
    onDelete,
  })
  const menu = onMenu ?? own.onMenu
  const press = usePressMenu(menu)
  const opens = !!text || !!meta || facts.length > 0 || !!lead || !!children
  // Only a row that doesn't open, as a favorite of spell slots, puts its aside beneath its name.
  const below = asideBelow && !opens
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
      {/* Beneath the name in a narrow list, by the list's width rather than the screen's, lined up
          with it past the icon, so that the name keeps the width it has without the aside; its
          spacer stays beside the name. */}
      {below ? (
        <span className='@max-md:order-last @max-md:basis-full @max-md:pl-11'>
          {aside}
        </span>
      ) : (
        aside
      )}
    </>
  )
  const rowClass = clsx(
    'flex items-center gap-3 rounded-xl px-2.5 py-2',
    muted && 'opacity-60',
  )

  if (!opens) {
    return (
      <li aria-busy={busy || undefined}>
        <div
          ref={rowRef as Ref<HTMLDivElement>}
          className={clsx(
            rowClass,
            below && '@max-md:flex-wrap',
            press.className,
          )}
          // A row with a menu takes focus, so that Shift+F10 or the context menu key opens it, as
          // on a row that opens (module 0.33.0).
          tabIndex={menu ? 0 : undefined}
          {...press.props}
        >
          {row}
          <span aria-hidden className='size-4 shrink-0' />
        </div>
        {!onMenu && own.menu}
        {dialog}
      </li>
    )
  }
  return (
    <li aria-busy={busy || undefined}>
      <details
        open={open}
        onToggle={event => {
          const now = event.currentTarget.open
          if (now !== open) setOpen(now)
        }}
      >
        <summary
          ref={rowRef}
          className={clsx(
            rowClass,
            'cursor-pointer list-none transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden',
            wraps && '@max-md:flex-wrap',
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
      {!onMenu && own.menu}
      {dialog}
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
  const { shown, ref, onError } = useImageFallback(src)
  const box = 'size-8 shrink-0 rounded-lg border border-border'
  if (!src || !shown) {
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
      ref={ref}
      src={src}
      alt=''
      className={clsx(
        box,
        // The game's own SVG icons, such as its status icons, are white, made for its dark
        // controls.
        isSvg(src) ? 'bg-[#23232f] p-1' : 'bg-card object-cover',
      )}
      onError={onError}
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
