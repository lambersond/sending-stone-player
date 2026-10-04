import clsx from 'clsx'
import { Lock, MessageSquare } from 'lucide-react'
import { EmptyState } from './empty-state'
import { LocalTime } from './local-time'
import type { Side, TableMessage, TableRoll } from '@/types/table'

const AVATAR: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-whisper/15 text-whisper',
}

/** A message's bubble, its pointed corner toward the speaker's avatar. */
const bubble = (whisper: boolean, mine: boolean) =>
  clsx(
    'max-w-full border px-3 py-2.5',
    mine ? 'rounded-[14px_4px_14px_14px]' : 'rounded-[4px_14px_14px_14px]',
    whisper && 'border-dashed border-whisper/60 bg-whisper/5',
    !whisper &&
      (mine ? 'border-primary/30 bg-primary/10' : 'border-border bg-card'),
  )

export function ChatLog({ messages }: Readonly<{ messages: TableMessage[] }>) {
  if (messages.length === 0) {
    return (
      <EmptyState icon={MessageSquare} title='No messages yet'>
        Chat and rolls from the table appear here as they happen.
      </EmptyState>
    )
  }
  return (
    <ol
      aria-label='Chat log'
      className='mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:px-8 md:py-6'
    >
      {messages.map(message => (
        <li key={message.id}>
          <ChatMessage message={message} />
        </li>
      ))}
    </ol>
  )
}

function ChatMessage({ message }: Readonly<{ message: TableMessage }>) {
  const { speaker, side, whisper, kind, label, text, rolls, targets } = message
  // The player's own messages sit on the other side, as in a messaging app.
  const mine = side === 'me'
  return (
    <article
      data-side={side}
      className={clsx('flex items-start gap-2.5', mine && 'flex-row-reverse')}
    >
      <span
        aria-hidden
        className={clsx(
          'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold',
          AVATAR[side],
        )}
      >
        {initials(speaker)}
      </span>
      <div
        className={clsx(
          'flex max-w-[85%] min-w-0 flex-1 flex-col gap-1.5',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <header
          className={clsx(
            'flex flex-wrap items-baseline gap-x-2 gap-y-0.5',
            mine && 'flex-row-reverse',
          )}
        >
          <span className='font-semibold'>{speaker}</span>
          {whisper && (
            <span className='inline-flex items-center gap-1 text-[11px] font-semibold text-whisper'>
              <Lock aria-hidden className='size-3' />
              Whisper
            </span>
          )}
          <LocalTime
            value={message.sentAt}
            className='text-xs text-text-secondary'
          />
        </header>
        {kind === 'text' && (
          <>
            {label && text && (
              <span className='text-xs font-semibold text-text-secondary'>
                {label}
              </span>
            )}
            {(text ?? label) && (
              <p
                className={clsx(
                  bubble(whisper, mine),
                  'break-words whitespace-pre-wrap',
                )}
              >
                {text ?? label}
              </p>
            )}
          </>
        )}
        {kind === 'card' && (
          <p className={clsx(bubble(whisper, mine), 'flex flex-col')}>
            <span className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
              Used
            </span>
            <span className='font-semibold'>
              {label ?? 'An item or ability'}
            </span>
          </p>
        )}
        {kind === 'roll' &&
          rolls.map((roll, index) => (
            <RollCard
              key={index}
              roll={roll}
              label={label}
              whisper={whisper}
              mine={mine}
            />
          ))}
        {targets.length > 0 && (
          <p
            className={clsx(
              'text-xs text-text-secondary',
              mine && 'text-right',
            )}
          >
            {targets.length === 1 ? 'Target' : 'Targets'}: {targets.join(', ')}
          </p>
        )}
      </div>
    </article>
  )
}

function RollCard({
  roll,
  label,
  whisper,
  mine,
}: Readonly<{
  roll: TableRoll
  label?: string
  whisper: boolean
  mine: boolean
}>) {
  return (
    <div
      className={clsx(
        bubble(whisper, mine),
        'flex w-full max-w-sm flex-col gap-2 p-3',
        roll.critical && 'border-solid border-gold',
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='text-sm font-semibold'>{label ?? 'Roll'}</span>
        <div className='flex shrink-0 flex-wrap justify-end gap-1'>
          {roll.critical && (
            <Badge className='bg-gold text-on-gold'>Critical</Badge>
          )}
          {roll.fumble && (
            <Badge className='bg-danger/15 text-danger'>Nat 1</Badge>
          )}
          {roll.advantage && (
            <Badge className='bg-primary text-on-primary'>Advantage</Badge>
          )}
          {roll.disadvantage && (
            <Badge className='bg-ruby text-on-ruby'>Disadvantage</Badge>
          )}
        </div>
      </div>
      <div className='flex items-end justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='font-mono text-sm break-all text-text-secondary'>
            {roll.formula}
          </span>
          {roll.dice.length > 0 && (
            <ul aria-label='Dice' className='flex flex-wrap gap-1'>
              {roll.dice.map((die, index) => (
                <li
                  key={index}
                  className={clsx(
                    'inline-flex h-6.5 min-w-6.5 items-center justify-center rounded-md border border-border bg-card px-1 font-mono text-xs',
                    !die.active && 'text-text-secondary line-through',
                  )}
                >
                  {die.value}
                  {!die.active && <span className='sr-only'> (dropped)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <span
          className={clsx(
            'text-3xl leading-none font-semibold tabular-nums',
            roll.critical && 'text-gold-text',
            roll.fumble && 'text-danger',
          )}
        >
          <span className='sr-only'>Total </span>
          {roll.total ?? '–'}
        </span>
      </div>
      {roll.damageType && (
        <span className='text-xs text-text-secondary capitalize'>
          {roll.damageType} damage
        </span>
      )}
    </div>
  )
}

function Badge({
  className,
  children,
}: Readonly<{ className: string; children: string }>) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Up to two letters from a speaker's name, for their avatar. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
  return letters || '?'
}
