import clsx from 'clsx'
import { Dices, EyeOff, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import { formatModifier } from '@/utils/format-modifier'
import type {
  LocalCheck,
  LocalDamage,
  LocalRoll,
} from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

/** The player's rolls' way to the Gamemaster's game. */
export type TableRolls = {
  /** Each roll sent, by its id. */
  states: ReadonlyMap<string, TableRollState>
  /** Whether the game takes any of the player's rolls now. */
  available: boolean
  /** Whether the player sends them from this device. */
  sending: boolean
  setSending: (sending: boolean) => void
}

/**
 * The player's rolls, newest first: the latest in full, the rest on request. The tray says
 * whether they reach the table, so no one expects one to have reached it that didn't: when the
 * Gamemaster's game takes the player's rolls, it makes them too, with the same dice, and the tray
 * says what it made of each.
 */
export function RollTray({
  rolls,
  rolling,
  table,
}: Readonly<{ rolls: LocalRoll[]; rolling: boolean; table?: TableRolls }>) {
  const [latest, ...earlier] = rolls
  let status = (
    <p className='flex items-center gap-2 text-sm text-text-secondary'>
      <Dices aria-hidden className='size-5 shrink-0 text-primary' />
      <span>
        Tap an ability, skill or attack to roll it. Right-click or long-press it
        for more ways to roll.
      </span>
    </p>
  )
  if (rolling) {
    status = (
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <Dices
          aria-hidden
          className='size-5 shrink-0 text-primary motion-safe:animate-spin'
        />
        Rolling…
      </p>
    )
  } else if (latest?.kind === 'damage') {
    status = <DamageResult roll={latest} />
  } else if (latest) {
    status = <CheckResult roll={latest} state={table?.states.get(latest.id)} />
  }

  return (
    <section
      aria-label='Your rolls'
      className='shrink-0 border-t border-border bg-card px-4 py-3 md:px-8'
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-2'>
        <div role='status' aria-live='polite'>
          {status}
        </div>
        {earlier.length > 0 && (
          <details className='group text-sm'>
            <summary className='cursor-pointer text-xs font-semibold text-text-secondary hover:text-text-primary'>
              Earlier rolls ({earlier.length})
            </summary>
            <ol className='mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto'>
              {earlier.map(roll => (
                <li
                  key={roll.id}
                  className='flex items-baseline justify-between gap-3'
                >
                  <span className='truncate'>{roll.label}</span>
                  <span className='shrink-0 text-xs text-text-secondary tabular-nums'>
                    {breakdown(roll)} ={' '}
                    <span className='text-sm font-semibold text-text-primary'>
                      {roll.total}
                    </span>
                    <TableMark state={table?.states.get(roll.id)} />
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        {table?.available ? (
          <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1'>
            <p className='text-[11px] text-text-secondary'>
              {table.sending
                ? 'Checks and saves you roll here are made in your Gamemaster’s game too, with the same dice.'
                : 'Only you see these rolls. They aren’t sent to your Gamemaster’s game.'}
            </p>
            <label className='flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold'>
              <input
                type='checkbox'
                role='switch'
                checked={table.sending}
                onChange={event => table.setSending(event.target.checked)}
                className='peer sr-only'
              />
              <span
                aria-hidden
                className={clsx(
                  'relative h-4 w-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
                  table.sending ? 'bg-primary' : 'bg-border',
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 size-3 rounded-full bg-card shadow-sm transition-[left]',
                    table.sending ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
              Send to the table
            </label>
          </div>
        ) : (
          <p className='text-[11px] text-text-secondary'>
            Only you see these rolls for now. They aren&apos;t sent to your
            Gamemaster&apos;s game.
          </p>
        )}
      </div>
    </section>
  )
}

/** What the game said of a roll, in words: why it wasn't made, mostly. */
const REASONS: Record<string, string> = {
  unavailable: 'your Gamemaster’s game isn’t taking rolls now',
  off: 'your Gamemaster’s game isn’t taking rolls now',
  unknown: 'your character in the game can’t make it',
  'not-dying': 'you aren’t dying',
  'not-in-combat': 'you aren’t in the combat',
  'already-rolled': 'you have rolled initiative already',
  busy: 'too many rolls at once. Wait a moment',
  timeout: 'the game took too long',
  network: 'Sending Stone couldn’t be reached',
  expired: 'your Gamemaster’s game didn’t pick it up',
  lost: 'no answer from your Gamemaster’s game',
}

/** Where a roll is on its way to the game, or what the game made of it. */
function TableStatus({ state }: Readonly<{ state: TableRollState }>) {
  const line = 'mt-1 flex items-center gap-1.5 text-xs'
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <LoaderCircle
            aria-hidden
            className='size-3.5 shrink-0 motion-safe:animate-spin'
          />
          {state.status === 'sending'
            ? 'Sending to your Gamemaster’s game…'
            : 'Rolling in your Gamemaster’s game…'}
        </p>
      )
    }
    case 'done': {
      return state.visible ? (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          <span>
            At the table:{' '}
            <span className='font-semibold text-text-primary tabular-nums'>
              {state.total ?? '?'}
            </span>
          </span>
        </p>
      ) : (
        <p className={clsx(line, 'text-text-secondary')}>
          <EyeOff aria-hidden className='size-3.5 shrink-0' />
          Rolled at the table, hidden by your Gamemaster
        </p>
      )
    }
    default: {
      const reason = REASONS[state.reason ?? state.status]
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          Not made at the table
          {reason ? `: ${reason}` : ''}
        </p>
      )
    }
  }
}

/** A roll's way to the game, in brief, among the earlier rolls. */
function TableMark({ state }: Readonly<{ state?: TableRollState }>) {
  if (!state) return
  if (state.status === 'done') {
    return (
      <span className='ml-1.5'>
        {state.visible ? `· table ${state.total ?? '?'}` : '· hidden'}
      </span>
    )
  }
  if (state.status === 'sending' || state.status === 'rolling') {
    return <span className='ml-1.5'>· sending</span>
  }
  return <span className='ml-1.5'>· not at the table</span>
}

function CheckResult({
  roll,
  state,
}: Readonly<{ roll: LocalCheck; state?: TableRollState }>) {
  const critical = roll.natural === 20
  const fumble = roll.natural === 1
  let extra = ''
  if (roll.advantage === 'adv') extra = 'Advantage'
  if (roll.advantage === 'dis') extra = 'Disadvantage'
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          critical && 'bg-gold text-on-gold',
          fumble && 'bg-ruby text-on-ruby',
          !critical && !fumble && 'bg-primary/10 text-primary',
        )}
      >
        {roll.total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Dice roll={roll} /> {formatModifier(roll.modifier)}
          {roll.extras.map(({ text, values }, index) => (
            <span key={index}>
              {' '}
              {text}
              {values.length > 0 && ` (${values.join(', ')})`}
            </span>
          ))}
          {extra && ` · ${extra}`}
          {critical && ' · Natural 20'}
          {fumble && ' · Natural 1'}
        </p>
        {state && <TableStatus state={state} />}
      </div>
    </div>
  )
}

/** Damage or healing: the total, and each part of it with its dice and kind. */
function DamageResult({ roll }: Readonly<{ roll: LocalDamage }>) {
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          roll.healing
            ? 'bg-primary/10 text-primary'
            : 'bg-damage/15 text-damage',
        )}
      >
        {roll.total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          {roll.parts.map((part, index) => (
            <span key={index}>
              {index > 0 && ' '}
              {part.terms.map(({ text, values }, at) => (
                <span key={at}>
                  {at > 0 && ' '}
                  {text}
                  {values.length > 0 && (
                    <>
                      {' ('}
                      <span className='font-semibold text-text-primary'>
                        {values.join(', ')}
                      </span>
                      )
                    </>
                  )}
                </span>
              ))}
              {part.type && ` ${part.type}`}
            </span>
          ))}
          {roll.critical && ' · Critical hit'}
        </p>
      </div>
    </div>
  )
}

/** The d20s thrown, the one that didn't count struck through. */
function Dice({ roll }: Readonly<{ roll: LocalCheck }>) {
  const kept = roll.d20s.indexOf(roll.natural)
  return (
    <>
      d20{' '}
      {roll.d20s.map((value, index) => (
        <span key={index}>
          {index > 0 && ' '}
          {index === kept ? (
            <span className='font-semibold text-text-primary'>{value}</span>
          ) : (
            <s>{value}</s>
          )}
        </span>
      ))}
    </>
  )
}

function breakdown(roll: LocalRoll): string {
  if (roll.kind === 'damage') {
    return roll.parts
      .map(part => (part.type ? `${part.total} ${part.type}` : part.total))
      .join(' + ')
  }
  return [
    roll.natural,
    formatModifier(roll.modifier),
    ...roll.extras.map(({ value }) => formatModifier(value)),
  ].join(' ')
}
