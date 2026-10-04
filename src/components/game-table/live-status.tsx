import clsx from 'clsx'

/**
 * live: the Gamemaster's game is sending. offline: it has not been heard from lately.
 * reconnecting: this app's server cannot be reached. waiting: the character is in no campaign.
 */
export type LiveState = 'live' | 'offline' | 'reconnecting' | 'waiting'

const STATES: Record<LiveState, { label: string; dot: string; hint: string }> =
  {
    live: {
      label: 'Live',
      dot: 'bg-primary motion-safe:animate-pulse',
      hint: "Your Gamemaster's game is connected.",
    },
    offline: {
      label: 'Offline',
      dot: 'bg-text-secondary',
      hint: "Your Gamemaster's game hasn't been heard from in the last two minutes.",
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
  }

export function LiveStatus({ state }: Readonly<{ state: LiveState }>) {
  const { label, dot, hint } = STATES[state]
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
