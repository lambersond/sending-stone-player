import clsx from 'clsx'
import { Swords } from 'lucide-react'
import { EmptyState } from './empty-state'
import type { Side, TableCombat, TableCombatant } from '@/types/table'

const INITIATIVE: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-foe/15 text-foe',
}

const ROLE: Record<Side, string | undefined> = {
  me: 'You',
  party: 'Ally',
  other: undefined,
}

export function CombatTracker({ combat }: Readonly<{ combat?: TableCombat }>) {
  if (!combat) {
    return (
      <EmptyState icon={Swords} title='No combat right now'>
        The initiative order appears here when your Gamemaster starts an
        encounter.
      </EmptyState>
    )
  }

  // The turn stays in view above the initiative order as it scrolls, at any width. Its strip has
  // the page's background, so rows pass out of sight behind it. Padding follows the pane's width,
  // which beside the sheet on a wide screen is narrow.
  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col'>
      <div className='sticky top-0 z-10 bg-page px-4 pt-4 pb-3 @xl:px-8 @xl:pt-6'>
        <TurnPanel combat={combat} />
      </div>
      <section
        aria-labelledby='initiative-heading'
        className='flex min-w-0 flex-col gap-2 px-4 pb-4 @xl:px-8 @xl:pb-6'
      >
        <div className='flex items-baseline justify-between gap-2 px-0.5'>
          <h2
            id='initiative-heading'
            className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            Initiative
          </h2>
          {combat.name && (
            <span className='truncate text-xs text-text-secondary'>
              {combat.name}
            </span>
          )}
        </div>
        {combat.combatants.length > 0 ? (
          <ol className='flex flex-col gap-2'>
            {combat.combatants.map(combatant => (
              <CombatantRow
                key={combatant.id}
                combatant={combatant}
                current={combatant.id === combat.currentId}
              />
            ))}
          </ol>
        ) : (
          <p className='rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-secondary'>
            No one has joined this encounter yet.
          </p>
        )}
      </section>
    </div>
  )
}

function CombatantRow({
  combatant,
  current,
}: Readonly<{ combatant: TableCombatant; current: boolean }>) {
  const { name, initiative, defeated, side, hp } = combatant
  const role = ROLE[side]
  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-2xl border p-3',
        current ? 'border-primary bg-primary/5' : 'border-border bg-card',
        defeated && 'opacity-60',
      )}
    >
      <span
        className={clsx(
          // Wide enough for a tiebreaker such as 18.25, so every row's box lines up.
          'flex h-10 w-15 shrink-0 items-center justify-center rounded-[10px] font-bold tabular-nums',
          INITIATIVE[side],
        )}
      >
        <span className='sr-only'>Initiative </span>
        {formatInitiative(initiative)}
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <span
            className={clsx(
              'truncate font-semibold',
              side === 'me' && 'text-primary',
              defeated && 'line-through',
            )}
          >
            {name}
          </span>
          {current && (
            <span className='rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tracking-wide text-on-primary'>
              NOW
            </span>
          )}
        </div>
        {role && <span className='text-xs text-text-secondary'>{role}</span>}
      </div>
      <div className='flex shrink-0 flex-col items-end gap-1.5'>
        {hp && <HitPoints hp={hp} />}
        {defeated && (
          <span className='text-xs font-semibold text-text-secondary'>
            Defeated
          </span>
        )}
      </div>
    </li>
  )
}

function HitPoints({
  hp,
}: Readonly<{ hp: NonNullable<TableCombatant['hp']> }>) {
  const percent = hp.max
    ? Math.min(100, Math.max(0, Math.round((hp.value / hp.max) * 100)))
    : undefined
  let bar = 'bg-primary'
  if (percent !== undefined && percent <= 50) bar = 'bg-warning'
  if (percent === 0) bar = 'bg-danger'
  return (
    <>
      <span className='text-sm font-semibold tabular-nums'>
        <span className='sr-only'>Hit points </span>
        {hp.value}
        {hp.max !== null && (
          <span className='font-normal text-text-secondary'> / {hp.max}</span>
        )}
        {hp.temp > 0 && <span className='text-party'> +{hp.temp} temp</span>}
      </span>
      {percent !== undefined && (
        <span
          aria-hidden
          className='block h-1.5 w-24 overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx('block h-full rounded-full', bar)}
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </>
  )
}

function TurnPanel({ combat }: Readonly<{ combat: TableCombat }>) {
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  const next = nextUp(combat)
  const myTurn = current?.side === 'me'

  let heading = 'Waiting for the next turn'
  if (!combat.started) heading = 'Getting ready'
  else if (myTurn) heading = 'Your turn'
  else if (current) heading = `${current.name} is acting`

  return (
    <section
      aria-labelledby='turn-heading'
      className={clsx(
        'flex flex-col gap-2 rounded-2xl border bg-card p-4',
        myTurn ? 'border-primary' : 'border-border',
      )}
    >
      <div className='flex items-baseline justify-between gap-2 text-xs text-text-secondary'>
        <span className='font-semibold tracking-wider uppercase'>
          {combat.started ? `Round ${combat.round}` : 'Not started'}
        </span>
        {next && (
          <span className='truncate'>
            Next: {next.side === 'me' ? 'you' : next.name}
          </span>
        )}
      </div>
      <h2
        id='turn-heading'
        aria-live='polite'
        className={clsx(
          'text-2xl font-semibold tracking-tight',
          myTurn && 'text-primary',
        )}
      >
        {heading}
      </h2>
      {!combat.started && (
        <p className='text-sm text-text-secondary'>
          The Gamemaster is setting up this encounter.
        </p>
      )}
      {!myTurn && next?.side === 'me' && (
        <p className='text-sm text-text-secondary'>You are up next.</p>
      )}
    </section>
  )
}

/**
 * An initiative as Foundry shows it. Systems break ties with decimals, such as D&D's dexterity
 * tiebreaker giving 18.14, which are rounded to two places to hide floating-point noise.
 */
export function formatInitiative(initiative: number | null): string {
  if (initiative === null) return '–'
  return String(Math.round(initiative * 100) / 100)
}

/** Who acts after the current combatant, skipping the defeated. */
function nextUp(combat: TableCombat): TableCombatant | undefined {
  const { combatants, currentId } = combat
  const index = combatants.findIndex(({ id }) => id === currentId)
  if (!combat.started || index === -1) return undefined
  for (let step = 1; step < combatants.length; step++) {
    const candidate = combatants[(index + step) % combatants.length]
    if (!candidate.defeated) return candidate
  }
  return undefined
}
