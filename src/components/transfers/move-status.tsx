'use client'

import { useEffect, type Ref } from 'react'
import clsx from 'clsx'
import { LoaderCircle, Send, TriangleAlert, X } from 'lucide-react'
import { reasons } from '@/components/character-sheet/roll-tray'
import { useTableRole } from '@/hooks/use-table-api'
import { moveWords } from '@/utils/move-words'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

/** How long a move made is told of, in milliseconds, before it clears itself. */
export const MADE_SHOWN_FOR = 6000

/**
 * Where the latest move from a sheet with no tray stands, such as a party's in its side panel,
 * over which the page's toasts can't show (module 0.31.0): on its way, made, which clears itself a
 * while after, or not made, and why, which stays until dismissed or the next move. It may be given
 * focus, as when the dialog a move is sent from closes on a control that waits for it.
 */
export function MoveStatus({
  ref,
  latest,
  onDismiss,
}: Readonly<{
  /** The status, to be given focus. */
  ref?: Ref<HTMLDivElement>
  latest?: { move: LocalMove; state: TableRollState }
  onDismiss: () => void
}>) {
  const role = useTableRole()
  const status = latest?.state.status
  useEffect(() => {
    if (status !== 'done') return
    const timer = setTimeout(onDismiss, MADE_SHOWN_FOR)
    return () => clearTimeout(timer)
  }, [latest, status, onDismiss])
  if (!latest) return
  const { move, state } = latest
  const onItsWay = status === 'sending' || status === 'rolling'
  let icon = (
    <TriangleAlert aria-hidden className='size-3.5 shrink-0 text-warning' />
  )
  if (onItsWay) {
    icon = (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  } else if (status === 'done') {
    icon = <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
  }
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className='flex items-start justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2'
    >
      <p
        role='status'
        aria-live='polite'
        className={clsx(
          'flex items-center gap-1.5 text-xs',
          status === 'done' || onItsWay
            ? 'text-text-secondary'
            : 'text-warning',
        )}
      >
        {icon}
        <span>{moveWords(move, state, role, reasons(role))}</span>
      </p>
      {!onItsWay && (
        <button
          type='button'
          aria-label='Dismiss'
          onClick={onDismiss}
          className='-my-1 -mr-1.5 shrink-0 rounded-lg p-1 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
        >
          <X aria-hidden className='size-4' />
        </button>
      )}
    </div>
  )
}
