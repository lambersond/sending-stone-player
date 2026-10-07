import clsx from 'clsx'
import {
  Dices,
  EyeOff,
  HeartPulse,
  LoaderCircle,
  Send,
  Sparkles,
  Swords,
  TriangleAlert,
} from 'lucide-react'
import {
  choicesOf,
  type DueDamage,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import { formatModifier } from '@/utils/format-modifier'
import type {
  LocalCheck,
  LocalDamage,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'
import type { RollKind } from '@/types/roll'

/** The player's rolls' way to the Gamemaster's game. */
export type TableRolls = {
  /** Each roll sent, by its id. */
  states: ReadonlyMap<string, TableRollState>
  /** Whether the game takes any of the player's rolls now. */
  available: boolean
  /** Whether the player sends them from this device. */
  sending: boolean
  setSending: (sending: boolean) => void
  /** Whether the game takes this kind of roll from this device now. */
  takes?: (kind: RollKind) => boolean
  /**
   * Roll the damage of an attack or use the game made, as the game said it will, as the kind of
   * damage chosen, if any.
   */
  rollDamage?: (name: string, due: DueDamage, type?: string) => void
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
    status = <DamageResult roll={latest} state={table?.states.get(latest.id)} />
  } else if (latest?.kind === 'use') {
    status = (
      <UseResult
        roll={latest}
        state={table?.states.get(latest.id)}
        onRollDamage={table?.rollDamage}
      />
    )
  } else if (latest) {
    status = (
      <CheckResult
        roll={latest}
        state={table?.states.get(latest.id)}
        onRollDamage={table?.rollDamage}
      />
    )
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
                    {breakdown(roll)}
                    {(roll.kind === 'check' ||
                      (roll.kind === 'damage' && !byTheGame(roll))) && (
                      <>
                        {' = '}
                        <span className='text-sm font-semibold text-text-primary'>
                          {roll.total}
                        </span>
                      </>
                    )}
                    <TableMark
                      state={table?.states.get(roll.id)}
                      used={roll.kind === 'use'}
                    />
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        {table?.available ? (
          <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1'>
            <p className='text-[11px] text-text-secondary'>{reachOf(table)}</p>
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

/** Whether the player's rolls reach the Gamemaster's game, and which. */
function reachOf(table: TableRolls): string {
  if (!table.sending) {
    return 'Only you see these rolls. They aren’t sent to your Gamemaster’s game.'
  }
  if (table.takes?.('use')) {
    return 'Checks, saves, attacks and spells you roll or cast here are made in your Gamemaster’s game too, with the same dice.'
  }
  return table.takes?.('attack')
    ? 'Checks, saves and attacks you roll here are made in your Gamemaster’s game too, with the same dice.'
    : 'Checks and saves you roll here are made in your Gamemaster’s game too, with the same dice.'
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
  cancelled: 'it was called off in the game',
  timeout: 'the game took too long',
  network: 'Sending Stone couldn’t be reached',
  expired: 'your Gamemaster’s game didn’t pick it up',
  lost: 'no answer from your Gamemaster’s game',
  'attacks-off': 'your Gamemaster’s game isn’t taking attacks',
  'midi-off': 'your Gamemaster’s game isn’t taking attacks',
  'self-test': 'your Gamemaster’s game isn’t taking attacks',
  item: 'your character in the game hasn’t that item',
  activity: 'it can’t be used from Sending Stone',
  area: 'area attacks aren’t made from here yet',
  ammo: 'you have none of that ammunition left',
  mode: 'the weapon can’t attack that way',
  target: 'a target can’t be picked, or there are too many',
  scene: 'your Gamemaster isn’t looking at that target’s scene',
  consume: 'there’s nothing left to use it with',
  slots: 'you have no spell slots left for it',
  slot: 'that spell slot can’t cast it',
  'damage-type': 'its kind of damage is chosen in the game',
  type: 'it can’t deal that kind of damage',
  'active-defence': 'your Gamemaster’s targets defend themselves',
  reaction: 'you’ve used your reaction',
  'bonus-action': 'you’ve used your bonus action',
  'midi-dialog': 'your Gamemaster’s game asks how to roll it',
  midi: 'your Gamemaster’s game stopped it',
  'no-attack': 'the attack wasn’t made',
  gone: 'it can’t be found in the game any more',
  'not-waiting': 'its damage was rolled in the game',
  'no-damage': 'no damage follows it',
  damaged: 'its damage is rolled already',
  dice: 'the dice weren’t those the game said',
  invalid: 'your Gamemaster’s game couldn’t make it',
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
            {outcomeOf(state) && (
              <span className='font-semibold text-text-primary'>
                {' · '}
                {outcomeOf(state)}
              </span>
            )}
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

/** What came of an attack at the table, as the game shows players. */
function outcomeOf(state: TableRollState): string | undefined {
  const { attack } = state
  if (!attack) return undefined
  if (attack.outcome === 'hit') return attack.critical ? 'Critical hit' : 'Hit'
  if (attack.outcome === 'miss') return 'Miss'
  return attack.critical ? 'Critical hit' : undefined
}

/**
 * Roll the damage or healing of an attack or use the game made, while the game waits for it: as
 * one of the kinds of damage it offers, a button each, where it offers a choice.
 */
function DamageButton({
  name,
  state,
  onRollDamage,
}: Readonly<{
  name: string
  state: TableRollState
  onRollDamage: (name: string, due: DueDamage, type?: string) => void
}>) {
  const { damage, requestId } = state
  if (state.status !== 'done' || !damage || state.damaged || !requestId) return
  const due = { use: requestId, damage }
  const Icon = damage.healing ? HeartPulse : Swords
  const kind = damage.healing ? 'healing' : 'damage'
  const button = clsx(
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
    damage.healing
      ? 'bg-primary/10 text-primary hover:bg-primary/20'
      : 'bg-damage/15 text-damage hover:bg-damage/25',
  )
  const choices = choicesOf(damage)
  if (choices.length > 0) {
    return (
      <div className='mt-2'>
        <p className='text-xs text-text-secondary'>
          Choose its kind of {kind}:
        </p>
        <div className='mt-1 flex flex-wrap gap-1.5'>
          {choices.map(({ key, label }) => (
            <button
              key={key}
              type='button'
              // A kind of healing names itself, such as Temporary Hit Points.
              aria-label={
                damage.healing ? `Roll ${label}` : `Roll ${label} ${kind}`
              }
              onClick={() => onRollDamage(name, due, key)}
              className={button}
            >
              <Icon aria-hidden className='size-4' />
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <button
      type='button'
      onClick={() => onRollDamage(name, due)}
      className={clsx(button, 'mt-2')}
    >
      <Icon aria-hidden className='size-4' />
      {damage.critical ? `Roll critical ${kind}` : `Roll ${kind}`}
    </button>
  )
}

/** A roll's way to the game, in brief, among the earlier rolls. */
function TableMark({
  state,
  used = false,
}: Readonly<{ state?: TableRollState; used?: boolean }>) {
  if (!state) return
  if (state.status === 'done') {
    if (used) return <span className='ml-1.5'>· at the table</span>
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
  onRollDamage,
}: Readonly<{
  roll: LocalCheck
  state?: TableRollState
  onRollDamage?: (name: string, due: DueDamage, type?: string) => void
}>) {
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
        {state && onRollDamage && (
          <DamageButton
            name={roll.label.replace(/ attack$/, '')}
            state={state}
            onRollDamage={onRollDamage}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Damage or healing: the total, and each part of it with its dice and kind. Damage the game rolls
 * itself, which throws no dice here, shows the game's total.
 */
function DamageResult({
  roll,
  state,
}: Readonly<{ roll: LocalDamage; state?: TableRollState }>) {
  const rolledThere = byTheGame(roll)
  let total: number | string = roll.total
  if (rolledThere) {
    total =
      state?.status === 'done' && state.visible ? (state.total ?? '?') : '…'
  }
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
        {total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          {rolledThere && 'Its dice are rolled in your Gamemaster’s game'}
          {!rolledThere &&
            roll.parts.map((part, index) => (
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
        {state && <TableStatus state={state} />}
      </div>
    </div>
  )
}

/**
 * A spell or feature used in the game: its way there, and once it's made, the damage or healing
 * that follows it, rolled at once, unless its kind is to be chosen first.
 */
function UseResult({
  roll,
  state,
  onRollDamage,
}: Readonly<{
  roll: LocalUse
  state?: TableRollState
  onRollDamage?: (name: string, due: DueDamage, type?: string) => void
}>) {
  const status = state && <UseStatus roll={roll} state={state} />
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
        <Sparkles aria-hidden className='size-6' />
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        {status}
        {state &&
          onRollDamage &&
          state.damage &&
          choicesOf(state.damage).length > 0 && (
            <DamageButton
              name={roll.label}
              state={state}
              onRollDamage={onRollDamage}
            />
          )}
      </div>
    </div>
  )
}

/** Where a use is on its way to the game, or what became of it. */
function UseStatus({
  roll,
  state,
}: Readonly<{ roll: LocalUse; state: TableRollState }>) {
  const verb = roll.spell ? 'Cast' : 'Used'
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
            : `${roll.spell ? 'Casting' : 'Using'} it in your Gamemaster’s game…`}
        </p>
      )
    }
    case 'done': {
      const { damage } = state
      const follows = damage && !state.damaged && choicesOf(damage).length === 0
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          {verb} at the table
          {follows
            ? `, its ${damage.healing ? 'healing' : 'damage'} to follow`
            : ''}
        </p>
      )
    }
    default: {
      const reason = REASONS[state.reason ?? state.status]
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          Not {verb.toLowerCase()} at the table
          {reason ? `: ${reason}` : ''}
        </p>
      )
    }
  }
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

/** Is this damage the game's to roll, with no dice thrown here? */
function byTheGame(roll: LocalDamage): boolean {
  return roll.parts.every(part => part.terms.length === 0)
}

function breakdown(roll: LocalRoll): string {
  if (roll.kind === 'use') return roll.spell ? 'cast' : 'used'
  if (roll.kind === 'damage') {
    if (byTheGame(roll)) return 'rolled at the table'
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
