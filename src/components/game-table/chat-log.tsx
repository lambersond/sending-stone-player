import { useState } from 'react'
import clsx from 'clsx'
import {
  BellRing,
  Crosshair,
  Droplet,
  HeartPulse,
  Lock,
  MessageSquare,
  Sparkles,
  Swords,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from './empty-state'
import { LocalTime } from './local-time'
import { askTitle } from '@/utils/table-view'
import type {
  Side,
  TableAction,
  TableAsk,
  TableMessage,
  TableRoll,
  TableTarget,
} from '@/types/table'

const AVATAR: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-whisper/15 text-whisper',
}

/** How each kind of combat roll is marked: a chip naming it, and an accent down the card's edge. */
const ACTIONS: Record<
  TableAction,
  { label: string; icon: LucideIcon; chip: string; accent: string }
> = {
  attack: {
    label: 'Attack',
    icon: Swords,
    chip: 'bg-attack/15 text-attack',
    accent: 'border-l-attack',
  },
  'spell-attack': {
    label: 'Spell attack',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell',
    accent: 'border-l-spell',
  },
  damage: {
    label: 'Damage',
    icon: Droplet,
    chip: 'bg-damage/15 text-damage',
    accent: 'border-l-damage',
  },
  healing: {
    label: 'Healing',
    icon: HeartPulse,
    chip: 'bg-primary/15 text-primary',
    accent: 'border-l-primary',
  },
  spell: {
    label: 'Spell',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell',
    accent: 'border-l-spell',
  },
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
      className='mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 @xl:px-8 @xl:py-6'
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
  const { speaker, side, whisper, kind, label, action, text, rolls, targets } =
    message
  // The player's own messages sit on the other side, as in a messaging app.
  const mine = side === 'me'
  return (
    <article
      data-side={side}
      className={clsx('flex items-start gap-2.5', mine && 'flex-row-reverse')}
    >
      <SpeakerAvatar
        name={speaker}
        src={message.avatar}
        className={AVATAR[side]}
      />
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
        {message.ask && (
          <AskBubble
            ask={message.ask}
            speaker={speaker}
            whisper={whisper}
            mine={mine}
          />
        )}
        {kind === 'text' && !message.ask && (
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
          <div
            className={clsx(
              bubble(whisper, mine),
              'flex flex-col gap-1.5',
              action && ['border-l-4', ACTIONS[action].accent],
            )}
          >
            {action ? (
              <ActionChip action={action} />
            ) : (
              <span className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
                Used
              </span>
            )}
            <span className='font-semibold'>
              {label ?? 'An item or ability'}
            </span>
            <Targets targets={targets} />
          </div>
        )}
        {kind === 'roll' &&
          rolls.map((roll, index) => (
            <RollCard
              key={index}
              roll={roll}
              label={label}
              action={action}
              // Who it was aimed at, called out once, on the first roll.
              targets={index === 0 ? targets : []}
              whisper={whisper}
              mine={mine}
            />
          ))}
        {kind === 'text' && targets.length > 0 && (
          <div className={clsx(mine && 'self-end')}>
            <Targets targets={targets} />
          </div>
        )}
      </div>
    </article>
  )
}

/** What a roll request card's chip calls what it asks for. */
const CHIPS: Record<TableAsk['type'], string> = {
  save: 'Saving throw',
  concentration: 'Concentration',
  check: 'Check',
}

/**
 * A roll request card: who asks the table for which saving throw or check, with its DC where
 * players may see it, and what asks for it, such as the asker's item. It's for the Gamemaster, who
 * rolls it for the creatures it names.
 */
function AskBubble({
  ask,
  speaker,
  whisper,
  mine,
}: Readonly<{
  ask: TableAsk
  speaker: string
  whisper: boolean
  mine: boolean
}>) {
  const title = askTitle(ask)
  return (
    <div
      className={clsx(
        bubble(whisper, mine),
        'flex flex-col gap-1.5 border-l-4 border-l-primary',
      )}
    >
      {/* The sentence below says what it is; the chip only marks it, for the eye. */}
      <span
        aria-hidden
        className='inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary uppercase'
      >
        <BellRing className='size-3' />
        {CHIPS[ask.type]}
      </span>
      <p className='font-semibold break-words'>
        {speaker} asks for {/^[AEIOU]/.test(title) ? 'an' : 'a'} {title}
      </p>
      {ask.label && (
        <p className='text-xs break-words text-text-secondary'>
          <span className='sr-only'>From </span>
          {ask.label}
        </p>
      )}
    </div>
  )
}

function RollCard({
  roll,
  label,
  action,
  targets,
  whisper,
  mine,
}: Readonly<{
  roll: TableRoll
  label?: string
  action?: TableAction
  targets: TableTarget[]
  whisper: boolean
  mine: boolean
}>) {
  return (
    <div
      className={clsx(
        bubble(whisper, mine),
        'flex w-full max-w-sm flex-col gap-2 p-3',
        roll.critical && 'border-solid border-gold',
        action && ['border-l-4', ACTIONS[action].accent],
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          {action && <ActionChip action={action} />}
          {(label ?? !action) && (
            <span className='text-sm font-semibold'>{label ?? 'Roll'}</span>
          )}
        </span>
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
      <Targets targets={targets} />
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
      {damageLabel(roll.damageType) && (
        <span className='text-xs text-text-secondary capitalize'>
          {damageLabel(roll.damageType)}
        </span>
      )}
    </div>
  )
}

/** What a damage roll dealt. Healing is already marked as such, so says nothing more. */
function damageLabel(damageType: string | undefined): string | undefined {
  if (!damageType || damageType === 'healing') return undefined
  if (damageType === 'temphp') return 'Temporary hit points'
  return `${damageType} damage`
}

function ActionChip({ action }: Readonly<{ action: TableAction }>) {
  const { label, icon: Icon, chip } = ACTIONS[action]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        chip,
      )}
    >
      <Icon aria-hidden className='size-3' />
      {label}
    </span>
  )
}

/** Who a roll or card was aimed at, and whether an attack hit when their armor class is known. */
function Targets({ targets }: Readonly<{ targets: TableTarget[] }>) {
  if (targets.length === 0) return
  return (
    <p className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
      <Crosshair aria-hidden className='size-4 shrink-0 text-text-secondary' />
      <span className='sr-only'>
        {targets.length === 1 ? 'Target: ' : 'Targets: '}
      </span>
      {targets.map((target, index) => (
        <span key={index} className='inline-flex items-center gap-1.5'>
          <span className='font-semibold'>{target.name}</span>
          {target.ac !== undefined && (
            <span className='text-xs text-text-secondary'>AC {target.ac}</span>
          )}
          {target.outcome && (
            <span
              className={clsx(
                'rounded-full px-1.5 py-px text-[11px] font-bold uppercase',
                target.outcome === 'hit'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-text-secondary/15 text-text-secondary',
              )}
            >
              {target.outcome === 'hit' ? 'Hit' : 'Miss'}
            </span>
          )}
          {index < targets.length - 1 && (
            <span aria-hidden className='text-text-secondary'>
              ,
            </span>
          )}
        </span>
      ))}
    </p>
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

/** The speaker's portrait, or their initials when they have none or it won't load. */
function SpeakerAvatar({
  name,
  src,
  className,
}: Readonly<{ name: string; src?: string; className: string }>) {
  const [failed, setFailed] = useState<string>()
  const box = 'size-9 shrink-0 rounded-[10px]'
  if (src && failed !== src) {
    return (
      // A portrait from the Gamemaster's game, which Next's image optimizer doesn't know.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=''
        className={clsx(box, 'border border-border object-cover object-top')}
        onError={() => setFailed(src)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={clsx(
        box,
        'flex items-center justify-center text-xs font-bold',
        className,
      )}
    >
      {initials(name)}
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
