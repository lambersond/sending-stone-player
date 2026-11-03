'use client'

import clsx from 'clsx'
import { CircleOff, PawPrint, Sparkles } from 'lucide-react'
import { useSwitcherLayout } from '@/features/companions/hooks/use-switcher-layout'
import { describe, shownName } from '@/features/companions/utils'
import { useImageFallback } from '@/hooks/use-image-fallback'
import { tintOf } from '@/utils/companion-row'
import { initials } from '@/utils/initials'
import { seatWords } from '@/utils/seat-words'
import type { SwitcherCreature } from '@/features/companions/types'
import type { SeatRole } from '@/types/seats'
import type { KeyboardEvent, ReactNode } from 'react'

const TAB =
  'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-sm transition-colors'
const TAB_ON = 'bg-primary/10 font-semibold text-primary-text'
const TAB_OFF =
  'font-medium text-text-secondary hover:bg-primary/5 hover:text-text-primary'

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
  const { box, ghost, row, avatars, fades, measureFades, tabOf } =
    useSwitcherLayout(creatures, chosen)

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
            'aria-label': `${shown}${creature.shape ?? ''}${news}`,
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
function CreatureAvatar({
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
      // eslint-disable-next-line @next/next/no-img-element -- the game's portrait, as said above
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
