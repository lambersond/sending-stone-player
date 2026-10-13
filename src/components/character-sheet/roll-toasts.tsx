'use client'

import clsx from 'clsx'
import { BellRing, Sparkles } from 'lucide-react'
import { createPortal } from 'react-dom'
import { briefOf, type RollBrief } from './roll-tray'
import { useHydrated } from '@/hooks/use-hydrated'
import { useRollToasts } from '@/hooks/use-roll-toasts'
import { useTableRole } from '@/hooks/use-table-api'
import type { LocalRoll } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

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

/** A roll's way to the game, coloured as the tray's: on its way, made, or not. */
const TONES: Record<NonNullable<RollBrief['table']>['tone'], string> = {
  pending: 'text-text-secondary',
  made: 'text-text-primary',
  not: 'text-warning',
}

/**
 * The player's rolls as toasts, at the top of the screen, whichever tab or pane is open: each as
 * its dice land, or a use or an ask as it's sent, updated as the game answers, and popping up
 * again as its way to the game ends, if it had gone. Each goes after four seconds, or when tapped;
 * the newest is on top, three at most. They hold nothing to tap but themselves, as they go: what
 * follows a roll, such as its damage, is rolled from the tray, which keeps every roll. They take no
 * focus, but are announced, as a log, while the tray's status isn't. None while the player has them
 * off, nor before the page has hydrated, as the setting is only known in the browser.
 */
export function RollToasts({
  rolls,
  states,
  on,
}: Readonly<{
  rolls: LocalRoll[]
  states: ReadonlyMap<string, TableRollState>
  on: boolean
}>) {
  const { shown, dismiss } = useRollToasts(rolls, states, on)
  const hydrated = useHydrated()
  // In the tray's words for the seat at the sheet: the Gamemaster's game is their own (#156).
  const role = useTableRole()
  if (!on || !hydrated) return
  const toasts = shown.flatMap(toast => {
    const roll = rolls.find(({ id }) => id === toast.id)
    return roll
      ? [{ ...toast, brief: briefOf(roll, states.get(toast.id), role) }]
      : []
  })
  // Above the dice as they tumble, which are 100000; below a dialog, in the top layer.
  return createPortal(
    <div className='pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[100001] flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]'>
      <div
        role='log'
        aria-label='Roll results'
        className='flex w-full max-w-sm flex-col gap-2'
      >
        {/* Popping up again mounts it anew, so that it's announced again. */}
        {toasts.map(({ id, poppedAt, leaving, brief }) => (
          <div
            key={`${id}:${poppedAt}`}
            data-roll-toast={id}
            data-leaving={leaving || undefined}
            onClick={() => dismiss(id)}
            className='pointer-events-auto flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 text-text-primary shadow-lg motion-safe:animate-toast-in motion-safe:transition-opacity motion-safe:duration-200 motion-safe:data-leaving:opacity-0'
          >
            <Badge brief={brief} />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-semibold'>{brief.label}</p>
              {brief.dice && (
                <p className='truncate text-xs text-text-secondary tabular-nums'>
                  {brief.dice}
                </p>
              )}
              {brief.table && (
                <p
                  className={clsx(
                    'line-clamp-2 text-xs',
                    TONES[brief.table.tone],
                  )}
                >
                  {brief.table.text}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** A roll's total, coloured as the tray's; or a use's or an ask's icon. */
function Badge({ brief }: Readonly<{ brief: RollBrief }>) {
  let shown = <>{brief.total}</>
  if (brief.badge === 'use') shown = <Sparkles aria-hidden className='size-5' />
  if (brief.badge === 'ask') shown = <BellRing aria-hidden className='size-5' />
  return (
    <span
      className={clsx(
        'flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold tabular-nums',
        BADGES[brief.badge],
      )}
    >
      {shown}
    </span>
  )
}
