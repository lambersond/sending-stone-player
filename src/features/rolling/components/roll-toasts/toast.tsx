'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { AreaOutcomes } from '../roll-tray/area-outcomes'
import { DamageDue } from '../roll-tray/damage-due'
import { GmPill } from '../roll-tray/gm-pill'
import { SpentLines } from '../roll-tray/spent-lines'
import { Badge } from './badge'
import { InPortalRoot } from '@/components/modal/in-portal-root'
import { ICON_TARGET } from '@/constants/buttons'
import type { RollBrief, RollDue } from '../../types'
import type { LocalRoll, TableRollState } from '@/types/roll'

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
 * A roll's toast, as a card edged and tinted by how it came out. One that waits for the player
 * holds the damage to roll, as the tray does, its menu and dialog opening in the toast, over the
 * page and the other toasts; tapping it elsewhere does nothing, so that a tap meant for a button
 * never closes it, as its × does. Any other goes when tapped.
 */
export function Toast({
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
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  return (
    <div
      data-roll-toast={roll.id}
      data-gm={brief.gm}
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
        <p className='flex items-center gap-1.5'>
          <span className='truncate text-base font-semibold'>
            {brief.label}
          </span>
          {brief.gm && <GmPill />}
        </p>
        {/* One line, but two for a roll a die offered was added to, from module 0.42.1, so that
            its last term, such as "Bardic Inspiration +1d6 (5)", isn't cut off on a phone. */}
        {brief.dice && (
          <p
            className={clsx(
              'text-sm text-text-secondary tabular-nums',
              roll.kind === 'check' && roll.spends
                ? 'line-clamp-2'
                : 'truncate',
            )}
          >
            {brief.dice}
          </p>
        )}
        {/* Kept to two lines, but for the Gamemaster's: the line names whom an area attack of
            theirs hit, with no list of its targets after it, so it's said whole, however many. */}
        {brief.table && (
          <p
            className={clsx(
              'text-sm',
              !brief.gm && 'line-clamp-2',
              TONES[brief.table.tone],
            )}
          >
            {brief.table.text}
          </p>
        )}
        {/* Whom an area attack hit, by the names picked here; the Gamemaster picked theirs. */}
        {!brief.gm && state?.status === 'done' && state.visible && (
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
        <SpentLines roll={roll} state={state} />
      </div>
      {waits && (
        <button
          type='button'
          aria-label='Dismiss'
          title='Dismiss'
          onClick={onDismiss}
          className={`${ICON_TARGET} size-8 rounded-lg text-text-secondary transition-colors hover:bg-text-primary/5 hover:text-text-primary`}
        >
          <X aria-hidden className='size-4' />
        </button>
      )}
    </div>
  )
}
