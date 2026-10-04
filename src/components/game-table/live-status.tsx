import clsx from 'clsx'

export type LiveState = 'live' | 'reconnecting' | 'waiting'

const STATES: Record<LiveState, { label: string; dot: string }> = {
  live: { label: 'Live', dot: 'bg-primary motion-safe:animate-pulse' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warning' },
  waiting: { label: 'Waiting', dot: 'bg-text-secondary' },
}

export function LiveStatus({ state }: Readonly<{ state: LiveState }>) {
  const { label, dot } = STATES[state]
  return (
    <span
      role='status'
      className='inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-semibold'
    >
      <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
      {label}
    </span>
  )
}
