import type { LiveState } from './types'
import type { SeatWords } from '@/types/seats'

/** Each state, as the seat at the sheet reads it: the Gamemaster's game is their own (#156). */
export const statesOf = ({
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
