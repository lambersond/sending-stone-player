'use client'

import { createPortal } from 'react-dom'
import { briefOf } from '../../utils/brief'
import { Toast } from './toast'
import {
  useRollToasts,
  useToastTop,
} from '@/features/rolling/hooks/use-roll-toasts'
import { needsPlayer } from '@/features/rolling/utils/damage-due'
import { belowTurn } from '@/features/rolling/utils/roll-toasts'
import { useCreature } from '@/hooks/use-creature'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTableRole } from '@/hooks/use-table-api'
import { useTurnToastFoot } from '@/hooks/use-turn-toast-foot'
import type { RollDue } from '../../types'
import type { LocalRoll, TableRollState } from '@/types/roll'

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
  const own = useToastTop(on, tabs, header, prompts)
  // From module 0.36.0, below the turn's toast while it shows, which sits under the header.
  const turnFoot = useTurnToastFoot()
  const top = belowTurn(own, turnFoot)
  const hydrated = useHydrated()
  // In the tray's words for the seat at the sheet: the Gamemaster's game is their own (#156); and
  // at a creature's pane, why its rolls weren't made as its own (module 0.36.0).
  const role = useTableRole()
  const creature = useCreature()
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
              brief={briefOf(roll, state, role, creature)}
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
