import clsx from 'clsx'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords, type SeatWords } from '@/utils/seat-words'

/**
 * live: the Gamemaster's game is sending. offline: it has not been heard from lately.
 * reconnecting: this app's server cannot be reached. waiting: the character is in no campaign.
 */
export type LiveState = 'live' | 'offline' | 'reconnecting' | 'waiting'

/** Each state, as the seat at the sheet reads it: the Gamemaster's game is their own (#156). */
const statesOf = ({
  connected,
  unheard,
}: SeatWords): Record<
  LiveState,
  { label: string; dot: string; hint: string }
> => ({
  live: {
    label: 'Live',
    dot: 'bg-primary motion-safe:animate-pulse',
    hint: connected,
  },
  offline: {
    label: 'Offline',
    dot: 'bg-text-secondary',
    hint: unheard,
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-warning',
    hint: 'Sending Stone cannot be reached. Trying again.',
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-text-secondary',
    hint: 'This character has not joined a campaign.',
  },
})

export function LiveStatus({ state }: Readonly<{ state: LiveState }>) {
  const { label, dot, hint } = statesOf(seatWords(useTableRole()))[state]
  return (
    <span
      role='status'
      title={hint}
      className='inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-semibold'
    >
      <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
      {label}
      <span className='sr-only'>. {hint}</span>
    </span>
  )
}
