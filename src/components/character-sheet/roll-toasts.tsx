'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { BellRing, Sparkles, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  AreaOutcomes,
  briefOf,
  DamageDue,
  type RollBrief,
  type RollDue,
} from './roll-tray'
import { InPortalRoot } from '@/components/modal'
import { useHydrated } from '@/hooks/use-hydrated'
import { useRollToasts, useToastTop } from '@/hooks/use-roll-toasts'
import { useTableRole } from '@/hooks/use-table-api'
import { needsPlayer, type TableRollState } from '@/hooks/use-table-rolls'
import type { LocalRoll } from '@/hooks/use-sheet-roller'

/** Each kind of total's colours, as the tray's. */
const BADGES: Record<RollBrief['badge'], string> = {
  critical: 'bg-gold text-on-gold',
  fumble: 'bg-ruby text-on-ruby',
  plain: 'bg-primary/10 text-primary',
  damage: 'bg-damage/15 text-damage',
  healing: 'bg-primary/10 text-primary',
  use: 'bg-primary/10 text-primary',
  ask: 'bg-primary/10 text-primary',
}

/**
 * Each outcome's colours: the left edge, a border of it faintly round the rest, and a tint over the
 * card, a gradient of one colour on its background.
 */
const ACCENTS: Record<RollBrief['accent'], string> = {
  warning: 'border-warning/30 border-l-warning from-warning/10 to-warning/10',
  gold: 'border-gold/40 border-l-gold from-gold/15 to-gold/15',
  ruby: 'border-ruby/30 border-l-ruby from-ruby/10 to-ruby/10',
  damage: 'border-damage/30 border-l-damage from-damage/10 to-damage/10',
  primary: 'border-primary/30 border-l-primary from-primary/10 to-primary/10',
}

/** A roll's way to the game, coloured as the tray's: on its way, made, or not. */
const TONES: Record<NonNullable<RollBrief['table']>['tone'], string> = {
  pending: 'text-text-secondary',
  made: 'text-text-primary',
  not: 'text-warning',
}

/**
 * The player's rolls as toasts, near the top of the screen, whichever tab or pane is open, where
 * the player has them shown so rather than in the banner: each as its dice land, or a use or an ask
 * as it's sent, updated as the game answers, and popping up again as its way to the game ends, if
 * it had gone. Each goes after four seconds, or when tapped; the newest is on top, three at most.
 * One whose roll waits for the player, as an attack that hit waits for its damage, holds what the
 * tray would offer to roll, and stays until that's rolled or its × closes it; the cap drops the
 * others first, but never one popping up, which shows over those that wait. They take no focus, but
 * are announced, as a log. They start below the sheet's row of tabs, so that its tabs, the rolls'
 * button and the cog stay to hand, and below the game's prompts beneath it while it asks any, whose
 * buttons are the only way to answer them; or below the table's header where the row isn't shown;
 * else at the top of the screen. Those that don't fit in the room below that scroll, so that none
 * runs off the screen, as on a phone turned sideways. None while the player has the banner, nor
 * before the page has hydrated, as the setting is only known in the browser.
 */
export function RollToasts({
  rolls,
  states,
  on,
  rollDamage,
  modifies,
  tabs,
  prompts,
  header,
}: Readonly<{
  rolls: LocalRoll[]
  states: ReadonlyMap<string, TableRollState>
  on: boolean
  /** Roll the damage a roll waits for, as the tray does. */
  rollDamage?: RollDue
  /** Whether the game takes that damage changed, which its menu then offers. */
  modifies?: boolean
  /** The sheet's row of tabs, which the toasts start below. */
  tabs?: HTMLElement | null
  /** The game's prompts beneath the row, while it asks any, which they start below then. */
  prompts?: HTMLElement | null
  /** The table's header, which they start below where the row isn't shown. */
  header?: HTMLElement | null
}>) {
  const { shown, dismiss } = useRollToasts(rolls, states, on)
  const top = useToastTop(on, tabs, header, prompts)
  const hydrated = useHydrated()
  // In the tray's words for the seat at the sheet: the Gamemaster's game is their own (#156).
  const role = useTableRole()
  if (!on || !hydrated) return
  const toasts = shown.flatMap(toast => {
    const roll = rolls.find(({ id }) => id === toast.id)
    return roll ? [{ ...toast, roll }] : []
  })
  // Above the dice as they tumble, which are 100000; below the cog's settings and the rolls'
  // popover, which are 100002, and a dialog, in the top layer. It reaches down to the bottom of the
  // screen, and those that don't fit scroll there, by a finger or a wheel on them, so that a sticky
  // toast under two others on a phone turned sideways doesn't run off it. It starts the 8-pixel gap
  // above them, which their slide drops through, so that scrolled they go under the row's edge,
  // not over it; it leaves room below them for their shadow; and it shows no scrollbar, which would
  // sit at the screen's edge, far from them, and let taps through to what's under it.
  return createPortal(
    <div
      className='pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] bottom-0 z-[100001] -mt-2 flex items-start justify-center overflow-y-auto pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-8 pl-[max(1rem,env(safe-area-inset-left))] [scrollbar-width:none]'
      style={top === undefined ? undefined : { top }}
    >
      <div
        role='log'
        aria-label='Roll results'
        className='flex w-full flex-col gap-2 sm:max-w-md'
      >
        {/* Popping up again mounts it anew, so that it's announced again. */}
        {toasts.map(({ id, poppedAt, leaving, roll }) => {
          const state = states.get(id)
          return (
            <Toast
              key={`${id}:${poppedAt}`}
              roll={roll}
              state={state}
              brief={briefOf(roll, state, role)}
              leaving={leaving}
              waits={needsPlayer(roll, state)}
              onDismiss={() => dismiss(id)}
              rollDamage={rollDamage}
              modifies={modifies}
            />
          )
        })}
      </div>
    </div>,
    document.body,
  )
}

/**
 * A roll's toast, as a card edged and tinted by how it came out. One that waits for the player
 * holds the damage to roll, as the tray does, its menu and dialog opening in the toast, over the
 * page and the other toasts; tapping it elsewhere does nothing, so that a tap meant for a button
 * never closes it, as its × does. Any other goes when tapped.
 */
function Toast({
  roll,
  state,
  brief,
  leaving,
  waits,
  onDismiss,
  rollDamage,
  modifies,
}: Readonly<{
  roll: LocalRoll
  state?: TableRollState
  brief: RollBrief
  leaving: boolean
  waits: boolean
  onDismiss: () => void
  rollDamage?: RollDue
  modifies?: boolean
}>) {
  // eslint-disable-next-line unicorn/no-null -- floating-ui waits for a root that's null
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  return (
    <div
      data-roll-toast={roll.id}
      data-accent={brief.accent}
      data-waits={waits || undefined}
      data-leaving={leaving || undefined}
      onClick={waits ? undefined : onDismiss}
      className={clsx(
        'pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 bg-card bg-linear-to-r py-2.5 pl-3 text-text-primary shadow-2xl motion-safe:animate-toast-in motion-safe:transition-opacity motion-safe:duration-200 motion-safe:data-leaving:opacity-0',
        waits ? 'pr-1.5' : 'cursor-pointer pr-3',
        ACCENTS[brief.accent],
      )}
    >
      <Badge brief={brief} />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-base font-semibold'>{brief.label}</p>
        {brief.dice && (
          <p className='truncate text-sm text-text-secondary tabular-nums'>
            {brief.dice}
          </p>
        )}
        {brief.table && (
          <p className={clsx('line-clamp-2 text-sm', TONES[brief.table.tone])}>
            {brief.table.text}
          </p>
        )}
        {state?.status === 'done' && state.visible && (
          <AreaOutcomes state={state} />
        )}
        {waits && (
          // Unannounced as its menu or dialog opens, which the log would otherwise read out.
          <div ref={setRoot} aria-live='off'>
            <InPortalRoot root={root}>
              <DamageDue
                roll={roll}
                state={state}
                onRollDamage={rollDamage}
                modifies={modifies}
                onTint
              />
            </InPortalRoot>
          </div>
        )}
      </div>
      {waits && (
        <button
          type='button'
          aria-label='Dismiss'
          title='Dismiss'
          onClick={onDismiss}
          className='flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-text-primary/5 hover:text-text-primary'
        >
          <X aria-hidden className='size-4' />
        </button>
      )}
    </div>
  )
}

/** A roll's total, coloured as the tray's; or a use's or an ask's icon. */
function Badge({ brief }: Readonly<{ brief: RollBrief }>) {
  let shown = <>{brief.total}</>
  if (brief.badge === 'use') shown = <Sparkles aria-hidden className='size-6' />
  if (brief.badge === 'ask') shown = <BellRing aria-hidden className='size-6' />
  return (
    <span
      className={clsx(
        'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
        BADGES[brief.badge],
      )}
    >
      {shown}
    </span>
  )
}
