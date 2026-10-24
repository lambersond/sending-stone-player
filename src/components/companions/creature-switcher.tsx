'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { CircleOff, PawPrint, Sparkles } from 'lucide-react'
import { initials } from '@/components/game-table/chat-log'
import { useImageFallback } from '@/hooks/use-image-fallback'
import { tintOf } from '@/utils/companion-row'
import { relationWords } from '@/utils/creature-words'
import { seatWords, type SeatRole } from '@/utils/seat-words'

/** One of the switcher's creatures, as its tab shows it (v5). */
export type SwitcherCreature = {
  /** 'self' for the character; else the companion's key. */
  key: string
  /** Its own name, as the game names it: the character's, or the companion's ("Bat"). */
  name: string
  /**
   * A repeated name's number, for its badge: its tab is then named, titled and described as
   * `${name} ${number}` ("Bat 2").
   */
  number?: number
  portrait?: string
  /** A companion's kind; none for the character. */
  kind?: 'owned' | 'summoned'
  /** For a summoned one, the item it was summoned with. */
  from?: string
  /** No longer listed: kept until it has been shown and left (§8.3). */
  gone?: boolean
  /**
   * Its marks' words, joined, as its accessible name ends: ", its turn" and the like; "" for none.
   */
  news: string
}

/** How far a tab is kept from either edge of the row as it's shown, clear of the fades. */
const CLEAR = 40

const TAB =
  'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-sm transition-colors'
const TAB_ON = 'bg-primary/10 font-semibold text-primary-text'
const TAB_OFF =
  'font-medium text-text-secondary hover:bg-primary/5 hover:text-text-primary'

/** A creature's name as its tab says it: numbered where the row repeats it. */
function shownName({ name, number }: SwitcherCreature): string {
  return number === undefined ? name : `${name} ${number}`
}

/**
 * The creatures above the character's sheet, the character first (module 0.36.0): a tab each while
 * every tab fits the row, and once they would overflow, avatars, the chosen one still a tab with
 * its name and kind icon. Whether they fit is measured on a hidden copy of the tabs, each drawn at
 * its widest, chosen and with a news dot, so that the mode depends only on the creatures and the
 * row's width, never on which is chosen or what news comes. Avatars that still overflow scroll
 * inside the row, with a fade at each edge a tab runs past; the chosen one is kept in view, clear
 * of them. Left and Right move between them, wrapping, and Home and End go to the first and last:
 * focus moves first, then the creature is chosen.
 * @param mounted - The creatures whose panes are mounted, which their tabs control.
 * @param character - The character's name, for the companions' descriptions.
 * @param role - The seat's, for whose game a gone companion has left.
 */
export function CreatureSwitcher({
  creatures,
  chosen,
  onChoose,
  mounted,
  character,
  role,
}: Readonly<{
  creatures: SwitcherCreature[]
  chosen: string
  onChoose: (key: string) => void
  mounted: ReadonlySet<string>
  character: string
  role: SeatRole
}>) {
  const box = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const [avatars, setAvatars] = useState(false)
  const [fades, setFades] = useState({ left: false, right: false })
  // As the latest render has them, for what the row's observer measures.
  const latest = useRef({ chosen, avatars })
  useLayoutEffect(() => {
    latest.current = { chosen, avatars }
  })
  // What the row's tabs draw, which their widths follow; not which is chosen, nor news.
  const faces = creatures
    .map(({ key, name, number, kind, gone }) =>
      [key, name, number, kind, gone].join(':'),
    )
    .join('|')

  // A fade at each edge a tab runs past, not where only the row's padding does.
  const measureFades = () => {
    const element = row.current
    const first = element?.firstElementChild
    const last = element?.lastElementChild
    if (
      !element ||
      !(first instanceof HTMLElement) ||
      !(last instanceof HTMLElement)
    ) {
      return
    }
    const left = first.offsetLeft < element.scrollLeft - 1
    const right =
      last.offsetLeft + last.offsetWidth >
      element.scrollLeft + element.clientWidth + 1
    setFades(held =>
      held.left === left && held.right === right ? held : { left, right },
    )
  }
  // A creature's tab, or its avatar, as drawn now.
  const tabOf = (key: string) =>
    [...(row.current?.querySelectorAll<HTMLElement>('[data-key]') ?? [])].find(
      each => each.dataset.key === key,
    )
  // The chosen tab scrolled into view, with room clear of either edge, at once.
  const reveal = (key: string) => {
    const element = row.current
    const tab = tabOf(key)
    if (!element || !tab) return
    const left = tab.offsetLeft - CLEAR
    const right = tab.offsetLeft + tab.offsetWidth + CLEAR
    if (left < element.scrollLeft) element.scrollLeft = left
    else if (right > element.scrollLeft + element.clientWidth) {
      element.scrollLeft = right - element.clientWidth
    }
  }

  // Avatars where the tabs at their widest are wider than the row: measured as the creatures
  // change, and as the row's width does.
  useLayoutEffect(() => {
    const measure = () => {
      if (!ghost.current || !box.current) return
      const next = ghost.current.offsetWidth > box.current.clientWidth
      setAvatars(next)
      // Where the mode changes, the effect below reveals the chosen once the new row is drawn.
      if (next === latest.current.avatars) reveal(latest.current.chosen)
      measureFades()
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (box.current) observer.observe(box.current)
    if (ghost.current) observer.observe(ghost.current)
    return () => observer.disconnect()
  }, [faces])
  // The chosen kept in view: as it's chosen, as the mode changes, and as creatures come and go.
  useLayoutEffect(() => {
    reveal(chosen)
    measureFades()
  }, [chosen, avatars, faces])

  // Focus in the row as it goes, as when the last gone tab is left for the character's, moves to
  // the character's sheet's chosen tab, never to the page. Not at once: React drops the row before
  // it shows the character's panel, in the same commit, and a browser focuses nothing hidden. So
  // once that commit is done, and only where focus has fallen to the page meanwhile.
  useLayoutEffect(() => {
    const element = box.current
    return () => {
      if (!element?.contains(document.activeElement)) return
      queueMicrotask(() => {
        const now = document.activeElement
        if (now && now !== document.body && now.isConnected) return
        document
          .querySelector<HTMLElement>(
            '[id^="sheet-tab-"][aria-selected="true"]',
          )
          ?.focus()
      })
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = creatures.findIndex(({ key }) => key === chosen)
    const count = creatures.length
    let next: number
    switch (event.key) {
      case 'ArrowRight': {
        next = (at + 1) % count
        break
      }
      case 'ArrowLeft': {
        next = (at - 1 + count) % count
        break
      }
      case 'Home': {
        next = 0
        break
      }
      case 'End': {
        next = count - 1
        break
      }
      default: {
        return
      }
    }
    event.preventDefault()
    const { key } = creatures[next]
    // Focus moves first, to a tab already drawn, so that it never drops as a gone tab leaves.
    tabOf(key)?.focus()
    onChoose(key)
  }

  const words = seatWords(role)
  return (
    <div
      ref={box}
      className='relative shrink-0 overflow-hidden border-b border-border bg-card'
    >
      {/* Every tab at its widest, chosen and with news, to measure whether they all fit. */}
      <div
        ref={ghost}
        aria-hidden
        inert
        className='pointer-events-none invisible absolute top-0 left-0 flex w-max gap-1.5 px-3 py-1.5 md:px-6'
      >
        {creatures.map((creature, index) => (
          <span key={creature.key} className={clsx(TAB, TAB_ON)}>
            <TabFace creature={creature} dot={index > 0} />
          </span>
        ))}
      </div>
      <div
        ref={row}
        role='tablist'
        aria-label='Character and companions'
        data-mode={avatars ? 'avatars' : 'tabs'}
        onKeyDown={onKeyDown}
        onScroll={measureFades}
        className={clsx(
          'flex overflow-x-auto px-3 py-1.5 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          avatars ? 'gap-1' : 'gap-1.5',
        )}
      >
        {creatures.map(creature => {
          const { key, kind, gone } = creature
          const on = key === chosen
          const shown = shownName(creature)
          // News is for a tab not shown; a gone companion has none.
          const news = on || gone ? '' : creature.news
          const description = kind && (
            <span id={`creature-desc-${key}`} hidden>
              {describe(creature, character, words.game)}
            </span>
          )
          const tab = {
            type: 'button' as const,
            role: 'tab',
            id: `creature-tab-${key}`,
            'data-key': key,
            'data-kind': kind && (gone ? 'gone' : kind),
            'aria-selected': on,
            tabIndex: on ? 0 : -1,
            'aria-controls':
              key === 'self' || mounted.has(key)
                ? `creature-panel-${key}`
                : undefined,
            'aria-label': `${shown}${news}`,
            'aria-describedby': kind ? `creature-desc-${key}` : undefined,
            onClick: () => onChoose(key),
          }
          if (avatars && !on) {
            return (
              <button
                key={key}
                {...tab}
                className='relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-1.5 transition-colors hover:bg-primary/5'
              >
                <AvatarFace creature={creature} dot={news !== ''} />
                {description}
              </button>
            )
          }
          return (
            <button
              key={key}
              {...tab}
              className={clsx(TAB, on ? TAB_ON : TAB_OFF)}
            >
              <TabFace creature={creature} dot={news !== ''} />
              {description}
            </button>
          )
        })}
      </div>
      {fades.left && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-card to-transparent'
        />
      )}
      {fades.right && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-card to-transparent'
        />
      )}
    </div>
  )
}

/**
 * Whose a companion is, as its tab's description says it: "Thorin’s companion", "Summoned by Thorin
 * with Find Familiar", or once gone, "No longer with Thorin in your Gamemaster’s game".
 */
function describe(
  { kind, from, gone }: SwitcherCreature,
  character: string,
  game: string,
): string {
  if (gone) return `No longer with ${character} in ${game}`
  return relationWords(
    kind === 'summoned'
      ? { kind, of: character, ...(from && { from }) }
      : { kind: 'owned', of: character },
  )
}

/** A companion's kind, as an icon its description says in words: owned, summoned, or gone. */
function KindIcon({
  kind,
  gone,
  className,
}: Readonly<{
  kind: 'owned' | 'summoned'
  gone?: boolean
  className: string
}>) {
  if (gone) return <CircleOff aria-hidden className={className} />
  if (kind === 'owned') return <PawPrint aria-hidden className={className} />
  return <Sparkles aria-hidden className={className} />
}

/** A tab's face: its picture, its name, its number where names repeat, its kind, and news. */
function TabFace({
  creature,
  dot,
}: Readonly<{ creature: SwitcherCreature; dot: boolean }>) {
  const { name, number, portrait, kind, gone } = creature
  return (
    <>
      <CreatureAvatar
        name={name}
        portrait={portrait}
        self={!kind}
        gone={gone}
      />
      <span className='max-w-[9rem] truncate' title={shownName(creature)}>
        {name}
      </span>
      {number !== undefined && (
        <span
          aria-hidden
          className='rounded bg-page px-1 text-[11px] font-bold text-text-secondary tabular-nums ring-1 ring-border'
        >
          {number}
        </span>
      )}
      {kind && <KindIcon kind={kind} gone={gone} className='size-3.5' />}
      {dot && <span aria-hidden className='size-2 rounded-full bg-primary' />}
    </>
  )
}

/** An avatar's face: its picture, with its number, its gone mark and its news at the corners. */
function AvatarFace({
  creature,
  dot,
}: Readonly<{ creature: SwitcherCreature; dot: boolean }>) {
  const { name, number, portrait, kind, gone } = creature
  return (
    <span className='relative' title={shownName(creature)}>
      <CreatureAvatar
        name={name}
        portrait={portrait}
        self={!kind}
        gone={gone}
        size='size-8'
      />
      {number !== undefined && (
        <span
          aria-hidden
          className='absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-card text-[10px] font-bold ring-1 ring-border'
        >
          {number}
        </span>
      )}
      {gone && (
        <span
          aria-hidden
          className='absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full bg-card text-text-secondary ring-1 ring-border'
        >
          <CircleOff className='size-3' />
        </span>
      )}
      {dot && (
        <span
          aria-hidden
          className='absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card'
        />
      )}
    </span>
  )
}

/**
 * A creature's picture in the switcher: its portrait, dimmed once it's gone; or its initials where
 * it has none or it won't load, always over the card, so that their tint reads the same on a
 * chosen tab: the character's in the accent, a companion's in a tint by its name, and a gone one's
 * muted, never dimmed, as its badge and description say it's gone.
 * @param self - The character's own.
 */
export function CreatureAvatar({
  name,
  portrait,
  self,
  gone,
  size = 'size-7',
}: Readonly<{
  name: string
  portrait?: string
  self?: boolean
  gone?: boolean
  /** 28 pixels on a tab, 32 as an avatar. */
  size?: 'size-7' | 'size-8'
}>): ReactNode {
  const { shown, ref, onError } = useImageFallback(portrait)
  if (shown) {
    return (
      // A portrait from the Gamemaster's game, which Next's image optimizer doesn't know.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={portrait}
        alt=''
        className={clsx(
          'shrink-0 rounded-full border border-border object-cover object-top',
          size,
          gone && 'opacity-60',
        )}
        onError={onError}
      />
    )
  }
  let tint: string = tintOf(name)
  if (gone) tint = 'bg-text-secondary/15 text-text-secondary'
  else if (self) tint = 'bg-primary text-on-primary'
  return (
    <span aria-hidden className='shrink-0 rounded-full bg-card'>
      <span
        className={clsx(
          'flex items-center justify-center rounded-full text-[11px] font-bold',
          size,
          tint,
        )}
      >
        {initials(name)}
      </span>
    </span>
  )
}
