'use client'

import { useLayoutEffect, useRef } from 'react'
import clsx from 'clsx'
import { Swords, TriangleAlert } from 'lucide-react'
import { EmptyState } from './empty-state'
import { EndTurnButton } from './end-turn-button'
import { turnFragment } from './turn-toast'
import { useTableRole } from '@/hooks/use-table-api'
import {
  END_TURN_HINT,
  TURN_OVER,
  turnKey,
  turnRefusedLine,
} from '@/utils/end-turn'
import { seatWords } from '@/utils/seat-words'
import type { useEndTurn } from '@/hooks/use-end-turn'
import type {
  EndableTurn,
  Side,
  TableCombat,
  TableCombatant,
} from '@/types/table'

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

/**
 * How one not of the party is drawn where the game has its token disposed, from module 0.29.0:
 * one marked Friendly as the party's allies are, and a neutral one in grey, not as a foe.
 */
const STANCES: Record<
  NonNullable<TableCombatant['stance']>,
  { initiative: string; role: string }
> = {
  ally: { initiative: INITIATIVE.party, role: 'Ally' },
  neutral: {
    initiative: 'bg-text-secondary/15 text-text-secondary',
    role: 'Neutral',
  },
}

/**
 * End Turn, as the turn panel offers it (module 0.36.0): the turn the seat may end and its way, as
 * `useEndTurn` has them; how the last End Turn was sent; why the last one wasn't made, by the turn
 * it was for and its way's reason, else its status; what ends a turn from the panel; and the page's
 * own place for focus on the turn, where the panel's heading has gone too.
 */
export type PanelEnding = {
  ending?: ReturnType<typeof useEndTurn>
  via?: 'button' | 'hold'
  refused?: { turn: EndableTurn; key: string }
  onEnd?: (turn: EndableTurn) => void
  focusTurn?: () => void
}

/**
 * The encounter as the character's player sees it: whose turn it is, above the initiative order.
 * From module 0.36.0, the character's companions are the player's own, and on a companion's turn
 * its panel says to roll for it on its tab, which it opens. And on the seat's turn, the panel
 * offers End Turn.
 * @param onOpen - Shows a companion's tab, by its key.
 * @param keys - The companions whose tabs the page shows.
 */
export function CombatTracker({
  combat,
  onOpen,
  keys,
  ...ending
}: Readonly<
  {
    combat?: TableCombat
    onOpen?: (key: string) => void
    keys?: ReadonlySet<string>
  } & PanelEnding
>) {
  const { noCombat } = seatWords(useTableRole())
  if (!combat) {
    return (
      <EmptyState icon={Swords} title='No combat right now'>
        {noCombat}
      </EmptyState>
    )
  }

  // The turn stays in view above the initiative order as it scrolls, at any width. Its strip has
  // the page's background, so rows pass out of sight behind it. Padding follows the pane's width,
  // which beside the sheet on a wide screen is narrow.
  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col'>
      <div className='sticky top-0 z-10 bg-page px-4 pt-4 pb-3 @xl:px-8 @xl:pt-6'>
        <TurnPanel combat={combat} onOpen={onOpen} keys={keys} {...ending} />
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
  const stance = combatant.stance && STANCES[combatant.stance]
  // One of the player's own creatures, as a companion of their character's (module 0.36.0).
  let role = ROLE[side]
  if (stance) role = stance.role
  else if (combatant.yours) role = 'Yours'
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
          stance ? stance.initiative : INITIATIVE[side],
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
              side === 'me' && 'text-primary-text',
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

function TurnPanel({
  combat,
  onOpen,
  keys,
  ending,
  via,
  refused,
  onEnd,
  focusTurn,
}: Readonly<
  {
    combat: TableCombat
    onOpen?: (key: string) => void
    keys?: ReadonlySet<string>
  } & PanelEnding
>) {
  const role = useTableRole()
  const { settingUp } = seatWords(role)
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  const next = nextUp(combat)
  // The turn of one of the player's own creatures: their character's, or from module 0.36.0 one of
  // its companions', which is rolled for on its own tab.
  const companion = current?.yours ? current.companion : undefined
  const mine =
    combat.started && (current?.side === 'me' || companion !== undefined)

  let heading = 'Waiting for the next turn'
  if (!combat.started) heading = 'Getting ready'
  else if (current?.side === 'me') heading = 'Your turn'
  else if (current && companion) heading = `${current.name}’s turn`
  else if (current) heading = `${current.name} is acting`

  // End Turn, on the seat's turn as the panel shows it (module 0.36.0).
  const turn =
    ending?.turn && ending.turn.combatantId === current?.id
      ? ending.turn
      : undefined
  const shown = turn && turnKey(turn)
  // Why the last End Turn wasn't made, while the panel still shows its turn.
  let line: string | undefined
  if (refused && shown === turnKey(refused.turn)) {
    const { key } = refused
    line = turnRefusedLine(
      refused.turn,
      turnFragment(key, role),
      !TURN_OVER.has(key),
    )
  }
  // The button's End Turn made, and the panel showing the turn moved on: focus on the button, or
  // lost to the page, goes to the heading, whoever acts now, never resting on an End Turn for the
  // next turn.
  const titled = useRef<HTMLHeadingElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const sent = ending?.sent
  const now =
    combat.started && current
      ? `${combat.id}:${combat.round}:${current.id}`
      : ''
  const moved =
    via === 'button' &&
    sent?.way.status === 'done' &&
    now !== turnKey(sent.turn)
      ? sent.way.requestId
      : undefined
  const handed = useRef<string>(undefined)
  useLayoutEffect(() => {
    if (moved === undefined || handed.current === moved) return
    handed.current = moved
    const active = document.activeElement
    if (!active || active === document.body || active === button.current) {
      titled.current?.focus({ preventScroll: true })
    }
  }, [moved])
  // The button gone from under focus: to the heading where the panel stays, else, as the encounter
  // ends and the panel goes with it, to the page's own place for the turn, never the page's body.
  const handOn = () => {
    const heading = titled.current
    if (heading?.isConnected) heading.focus({ preventScroll: true })
    else focusTurn?.()
  }

  return (
    <section
      aria-labelledby='turn-heading'
      className={clsx(
        'flex flex-col gap-2 rounded-2xl border bg-card p-4',
        mine ? 'border-primary' : 'border-border',
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
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
        <h2
          ref={titled}
          id='turn-heading'
          tabIndex={-1}
          aria-live='polite'
          className={clsx(
            'text-2xl font-semibold tracking-tight outline-none',
            mine && 'text-primary',
          )}
        >
          {heading}
        </h2>
        {turn && ending && (
          <EndTurnButton
            ref={button}
            turn={turn}
            offered={ending.offered}
            way={ending.way}
            onEnd={given => onEnd?.(given)}
            onGone={handOn}
          />
        )}
      </div>
      {line && (
        <p
          role='alert'
          className='flex items-start gap-1.5 text-[13px] text-warning'
        >
          <TriangleAlert aria-hidden className='mt-0.5 size-4 shrink-0' />
          <span>{line}</span>
        </p>
      )}
      {turn && <p className='text-xs text-text-secondary'>{END_TURN_HINT}</p>}
      {!combat.started && (
        <p className='text-sm text-text-secondary'>{settingUp}</p>
      )}
      {mine && companion && (
        <p className='text-sm text-text-secondary'>
          Roll for it on{' '}
          {onOpen && keys?.has(companion) ? (
            <button
              type='button'
              onClick={() => onOpen(companion)}
              className='inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-primary-text underline underline-offset-2'
            >
              its tab
            </button>
          ) : (
            'its tab'
          )}
          .
        </p>
      )}
      {!mine && next?.side === 'me' && (
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
