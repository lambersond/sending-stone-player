import { Fragment, useState } from 'react'
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
import { Chevron } from '@/components/character-sheet/action-entry'
import { askTitle } from '@/utils/table-view'
import type {
  DamagePool,
  Side,
  TableAction,
  TableAsk,
  TableDamage,
  TableDamageKind,
  TableMessage,
  TableRoll,
  TableTarget,
} from '@/types/table'

const AVATAR: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-whisper/15 text-whisper',
}

/**
 * How each kind of combat roll is marked: a chip naming it, and an accent down the card's edge.
 * Each chip's text is its colour's text token, deep enough to read at WCAG AA on its tint over
 * every bubble, the player's own and a whisper's too.
 */
const ACTIONS: Record<
  TableAction,
  { label: string; icon: LucideIcon; chip: string; accent: string }
> = {
  attack: {
    label: 'Attack',
    icon: Swords,
    chip: 'bg-attack/15 text-attack-text',
    accent: 'border-l-attack',
  },
  'spell-attack': {
    label: 'Spell attack',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell-text',
    accent: 'border-l-spell',
  },
  damage: {
    label: 'Damage',
    icon: Droplet,
    chip: 'bg-damage/15 text-damage-text',
    accent: 'border-l-damage',
  },
  healing: {
    label: 'Healing',
    icon: HeartPulse,
    chip: 'bg-primary/10 text-primary-text',
    accent: 'border-l-primary',
  },
  spell: {
    label: 'Spell',
    icon: Sparkles,
    chip: 'bg-spell/15 text-spell-text',
    accent: 'border-l-spell',
  },
}

/**
 * A message's bubble, its pointed corner toward the speaker's avatar; gold all round for a
 * critical. It sets one border colour only: of two, the one the stylesheet sets later wins,
 * whatever their order here, and gold comes before the player's own and a whisper's.
 */
const bubble = (whisper: boolean, mine: boolean, critical = false) =>
  clsx(
    'max-w-full border px-3 py-2.5',
    mine ? 'rounded-[14px_4px_14px_14px]' : 'rounded-[4px_14px_14px_14px]',
    critical ? 'border-gold' : edgeOf(whisper, mine),
    whisper && 'border-dashed bg-whisper/5',
    !whisper && (mine ? 'bg-primary/10' : 'bg-card'),
  )

/** A bubble's border colour, for a whisper, the player's own message or anyone else's. */
function edgeOf(whisper: boolean, mine: boolean): string {
  if (whisper) return 'border-whisper/60'
  return mine ? 'border-primary/30' : 'border-border'
}

/** The caption style of a card's small heading, such as "Used". */
const CAPTION =
  'text-[11px] font-semibold tracking-wider text-text-secondary uppercase'

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
  const {
    speaker,
    side,
    whisper,
    kind,
    label,
    action,
    text,
    rolls,
    attackRoll,
    targets,
  } = message
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
          {/* Made for the Gamemaster's roll as the character (#156), as this app knows it. */}
          {message.byGm && (
            <span
              title='Rolled by the Gamemaster'
              className='shrink-0 rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary-text'
            >
              GM<span className='sr-only'>, rolled by the Gamemaster</span>
            </span>
          )}
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
              <span className={CAPTION}>Used</span>
            )}
            <span className='font-semibold'>
              {label ?? 'An item or ability'}
            </span>
            <Targets targets={targets} />
          </div>
        )}
        {kind === 'roll' && (
          <>
            {rolls.map((roll, index) => (
              <RollCard
                key={index}
                roll={roll}
                label={label}
                // Only its attack is marked: its damage cards carry their own marks.
                action={
                  attackRoll?.index === index ? attackRoll.action : undefined
                }
                // Who it was aimed at, called out once, on the first card.
                targets={index === 0 ? targets : []}
                whisper={whisper}
                mine={mine}
              />
            ))}
            {/* By its section, so an open card stays open as Midi-QOL adds the other. */}
            {message.damage?.map((damage, index) => (
              <DamageCard
                key={damage.section}
                damage={damage}
                // Under its attack's card, the item's name isn't said again.
                label={attackRoll ? undefined : label}
                targets={rolls.length === 0 && index === 0 ? targets : []}
                whisper={whisper}
                mine={mine}
              />
            ))}
          </>
        )}
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
        className='inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary-text uppercase'
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
        bubble(whisper, mine, roll.critical),
        'flex w-full max-w-sm flex-col gap-2 p-3',
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
          <DiceList dice={roll.dice} />
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
    </div>
  )
}

/** A roll's dice, each as it came up, those it dropped struck through. */
function DiceList({ dice }: Readonly<{ dice: TableRoll['dice'] }>) {
  if (dice.length === 0) return
  return (
    <ul aria-label='Dice' className='flex flex-wrap gap-1'>
      {dice.map((die, index) => (
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
  )
}

/** What a creature that saves takes, as dnd5e's damage card says beneath its total. */
const ON_SAVE: Record<NonNullable<TableDamage['onSave']>, string> = {
  half: 'Half damage on a save',
  none: 'No damage on a save',
  full: 'Full damage on a save',
}

/**
 * A message's damage rolls in one card, as dnd5e's damage card adds them up: its formula, a chip
 * for each kind of damage with what it came to, and their total where they fill one pool. Its
 * rolls' dice open beneath it, or show inline where it has only the one roll.
 */
function DamageCard({
  damage,
  label,
  targets,
  whisper,
  mine,
}: Readonly<{
  damage: TableDamage
  label?: string
  targets: TableTarget[]
  whisper: boolean
  mine: boolean
}>) {
  const [open, setOpen] = useState(false)
  const { action, critical, rolls } = damage
  const formula = damage.formula && (
    <span className='font-mono text-xs break-words text-text-secondary'>
      {damage.formula}
    </span>
  )
  return (
    <div
      className={clsx(
        bubble(whisper, mine, critical),
        'flex w-full max-w-sm flex-col gap-2 p-3',
        'border-l-4',
        ACTIONS[action].accent,
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <ActionChip action={action} />
          {damage.section === 'other' && (
            <span className={CAPTION}>Other damage</span>
          )}
          {label && <span className='text-sm font-semibold'>{label}</span>}
        </span>
        {critical && (
          <div className='flex shrink-0 flex-wrap justify-end gap-1'>
            <Badge className='bg-gold text-on-gold'>Critical</Badge>
          </div>
        )}
      </div>
      <Targets targets={targets} />
      {rolls.length > 1 ? (
        <details onToggle={event => setOpen(event.currentTarget.open)}>
          {/* A hover rings it rather than tinting it: a tint under its chips and total would take
              them below WCAG AA on the player's own bubble, in the light theme. */}
          <summary className='-mx-1 flex min-h-11 cursor-pointer list-none items-end gap-2 rounded-lg px-1 hover:ring-1 hover:ring-primary/30 [&::-webkit-details-marker]:hidden'>
            <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
              {formula}
              {/* So its name reads "1d4 + 4 + 2d6, 5 Piercing + 7 Poison = 12". */}
              {formula && <span className='sr-only'>, </span>}
              <KindChips kinds={damage.kinds} />
            </span>
            <DamageTotal damage={damage} />
            <span className='mb-1 flex shrink-0'>
              <Chevron open={open} />
            </span>
          </summary>
          {open && (
            <ul
              aria-label='Rolls'
              className='mt-2 flex flex-col gap-1.5 border-t border-border pt-2'
            >
              {rolls.map((roll, index) => (
                <li
                  key={index}
                  className='flex items-end justify-between gap-3'
                >
                  <span className='flex min-w-0 flex-wrap items-center gap-1'>
                    {roll.tag && (
                      <>
                        <span className='text-[11px] font-semibold text-text-secondary'>
                          {roll.tag}
                        </span>{' '}
                      </>
                    )}
                    <span className='pr-1 font-mono text-xs break-words text-text-secondary'>
                      {roll.formula}
                    </span>{' '}
                    <DiceList dice={roll.dice} />
                  </span>
                  <span className='shrink-0 text-sm'>
                    <span className='font-semibold tabular-nums'>
                      {roll.total ?? '–'}
                    </span>
                    {roll.label && (
                      <>
                        {' '}
                        <span className='text-text-secondary'>
                          {roll.label}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <div className='flex items-end gap-2'>
          <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
            {formula}
            <DiceList dice={rolls[0]?.dice ?? []} />
            <KindChips kinds={damage.kinds} />
          </span>
          <DamageTotal damage={damage} />
        </div>
      )}
      {damage.onSave && (
        <p className='text-xs text-text-secondary'>{ON_SAVE[damage.onSave]}</p>
      )}
    </div>
  )
}

/** A chip of a kind of healing: each of its pools is the accent's. */
const HEALS = {
  chip: 'border-transparent bg-primary/10',
  word: 'text-primary-text',
}

/**
 * How each kind of damage's chip is coloured: its tint and edge, and its word's colour. Each has an
 * edge, if only a clear one, so that every chip is as tall as damage's.
 */
const KIND_TONES: Record<DamagePool, { chip: string; word: string }> = {
  harm: { chip: 'border-damage/30 bg-damage/10', word: 'text-damage-text' },
  healing: HEALS,
  temphp: HEALS,
  maximum: HEALS,
  none: {
    chip: 'border-transparent bg-text-secondary/10',
    word: 'text-text-secondary',
  },
}

/** A chip for each kind of damage, "5 Piercing", read as "5 Piercing + 7 Poison". */
function KindChips({ kinds }: Readonly<{ kinds: TableDamageKind[] }>) {
  return (
    <span className='flex flex-wrap gap-1'>
      {kinds.map((kind, index) => (
        <Fragment key={index}>
          {index > 0 && <span className='sr-only'> + </span>}
          <span
            className={clsx(
              'inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-xs',
              KIND_TONES[kind.pool].chip,
            )}
          >
            {/* Midi-QOL's damage of none is said in words, as it isn't counted. */}
            {kind.pool !== 'none' && (
              <span className='font-bold text-text-primary tabular-nums'>
                {kind.total ?? '–'}
              </span>
            )}
            {/* A space of its own, as the chip's gap isn't one to a screen reader. */}
            {kind.pool !== 'none' && kind.label && ' '}
            {kind.label && (
              <span className={KIND_TONES[kind.pool].word}>{kind.label}</span>
            )}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/** A damage card's total, where it has one: "–" while any of it is unknown. */
function DamageTotal({ damage }: Readonly<{ damage: TableDamage }>) {
  if (damage.total === undefined) return
  return (
    <span
      className={clsx(
        'text-3xl leading-none font-semibold tabular-nums',
        damage.critical && 'text-gold-text',
      )}
    >
      <span className='sr-only'>{' = '}</span>
      {damage.total ?? '–'}
    </span>
  )
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
                  ? 'bg-primary/10 text-primary-text'
                  : 'bg-text-secondary/10 text-text-secondary',
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
