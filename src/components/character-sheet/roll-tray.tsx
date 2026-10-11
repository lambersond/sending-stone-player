import clsx from 'clsx'
import {
  BellRing,
  Dices,
  EyeOff,
  HeartPulse,
  LoaderCircle,
  Send,
  Sparkles,
  Swords,
  TriangleAlert,
} from 'lucide-react'
import { useDamageMenu } from './damage-menu'
import { RollButton } from './roll-button'
import {
  choicesOf,
  damageRollOf,
  type DueDamage,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import { firstDie, type DamageModifiers } from '@/utils/damage-modifiers'
import { formatModifier } from '@/utils/format-modifier'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalExtra,
  LocalFormula,
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
   * damage chosen, if any, and changed as the player chose, if they did.
   */
  rollDamage?: RollDue
  /** Whether the game takes damage the player changed. */
  modifies?: boolean
}

/** Roll the damage the game waits for, as the kind chosen, changed as chosen. */
type RollDue = (
  name: string,
  due: DueDamage,
  type?: string,
  modifiers?: DamageModifiers,
) => void

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
  } else if (latest) {
    status = <LatestResult roll={latest} table={table} />
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
                      roll.kind === 'formula' ||
                      (roll.kind === 'damage' && !byTheGame(roll))) && (
                      <>
                        {' = '}
                        <span className='text-sm font-semibold text-text-primary'>
                          {roll.total}
                        </span>
                      </>
                    )}
                    <TableMark state={table?.states.get(roll.id)} roll={roll} />
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

/** The latest roll, in full, and its way to the game. */
function LatestResult({
  roll,
  table,
}: Readonly<{ roll: LocalRoll; table?: TableRolls }>) {
  const state = table?.states.get(roll.id)
  switch (roll.kind) {
    case 'damage': {
      return <DamageResult roll={roll} state={state} />
    }
    case 'formula': {
      return <FormulaResult roll={roll} state={state} />
    }
    case 'ask': {
      return <AskResult roll={roll} state={state} />
    }
    case 'use': {
      return (
        <UseResult
          roll={roll}
          state={state}
          onRollDamage={table?.rollDamage}
          modifies={table?.modifies}
        />
      )
    }
    case 'check': {
      return (
        <CheckResult
          roll={roll}
          state={state}
          onRollDamage={table?.rollDamage}
          modifies={table?.modifies}
        />
      )
    }
  }
}

/** Whether the player's rolls reach the Gamemaster's game, and which. */
function reachOf(table: TableRolls): string {
  if (!table.sending) {
    return 'Only you see these rolls. They aren’t sent to your Gamemaster’s game.'
  }
  const casts = table.takes?.('use') === true
  const spends = table.takes?.('hitDie') === true
  const kinds = ['Checks', 'saves']
  if (casts || table.takes?.('attack')) kinds.push('attacks')
  if (casts) kinds.push('spells')
  if (spends) kinds.push('hit dice')
  const verbs = [
    'roll',
    ...(casts ? ['cast'] : []),
    ...(spends ? ['spend'] : []),
  ]
  return `${listed(kinds)} you ${listed(verbs, 'or')} here are made in your Gamemaster’s game too, with the same dice.`
}

/** Words listed as a sentence has them: "a, b and c". */
function listed(words: string[], last = 'and'): string {
  return words.length > 1
    ? `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`
    : words.join('')
}

/** What the game said of a roll, in words: why it wasn't made, mostly. */
export const REASONS: Record<string, string> = {
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
  'self-test': 'your Gamemaster’s game can’t make it with your dice',
  item: 'your character in the game hasn’t that item',
  activity: 'it can’t be used from Sending Stone',
  area: 'your Gamemaster’s game can’t make that area attack from here',
  ammo: 'you have none of that ammunition left',
  mode: 'the weapon can’t attack that way',
  target: 'a target can’t be picked, or there are too many',
  scene: 'your Gamemaster isn’t viewing that target’s level or scene',
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
  link: 'your Gamemaster’s game doesn’t find that in its description',
  secret: 'it’s in a secret part of the description',
  'not-waiting': 'its damage was rolled in the game',
  'no-damage': 'no damage follows it',
  damaged: 'its damage is rolled already',
  dice: 'the dice weren’t those the game said',
  invalid: 'your Gamemaster’s game couldn’t make it',
  prompt: 'your Gamemaster’s game isn’t asking for it any more',
  'no-hit-dice': 'you have no hit dice of that size left',
}

/** Why the table wasn't asked, in words, where it differs from why a roll wasn't made. */
const ASK_REASONS: Record<string, string> = {
  ...REASONS,
  busy: 'the table was asked a moment ago. Wait a little before asking again',
}

/** Where a roll ends without the game having made it. */
const NOT_MADE = new Set<TableRollState['status']>([
  'failed',
  'expired',
  'lost',
  'refused',
])

/**
 * Where a roll is on its way to the game, or what the game made of it: for a saving throw or check
 * against a DC a description names, whether it was made, by the game's total where it doesn't say.
 */
function TableStatus({
  state,
  dc,
  verdict,
}: Readonly<{
  state: TableRollState
  dc?: number
  verdict?: LocalCheck['verdict']
}>) {
  const line = 'mt-1 flex items-center gap-1.5 text-xs'
  // Of dice sent one after another, as hit dice spent at once, which is on its way.
  const die = state.together
    ? ` die ${state.together.made + 1} of ${state.together.count}`
    : ''
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
            ? `Sending${die} to your Gamemaster’s game…`
            : `Rolling${die} in your Gamemaster’s game…`}
          {/* Each is sent from this page once the one before is made: leaving it, none more is. */}
          {state.together && ' Keep this page open until they’re all sent.'}
        </p>
      )
    }
    case 'done': {
      return state.visible ? (
        <>
          <p className={clsx(line, 'text-text-secondary')}>
            <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
            <span>
              At the table:{' '}
              <span className='font-semibold text-text-primary tabular-nums'>
                {state.total ?? '?'}
              </span>
              {outcomeOf(state, dc, verdict) && (
                <span className='font-semibold text-text-primary'>
                  {' · '}
                  {outcomeOf(state, dc, verdict)}
                </span>
              )}
            </span>
          </p>
          <AreaOutcomes state={state} />
        </>
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
          {state.together?.made ? (
            <PartlyMade state={state} together={state.together} />
          ) : (
            'Not made at the table'
          )}
          {reason ? `: ${reason}` : ''}
        </p>
      )
    }
  }
}

/**
 * Of dice sent one after another, as hit dice spent at once, those the game made before one it
 * didn't: how many, and the hit points they gave back, where the player may see them, before why
 * the rest weren't made.
 */
function PartlyMade({
  state,
  together: { count, made },
}: Readonly<{
  state: TableRollState
  together: NonNullable<TableRollState['together']>
}>) {
  return (
    <span>
      {made} of {count} made at the table
      {state.healed !== undefined && (
        <span className='font-semibold text-text-primary'>
          {' · '}
          {state.healed} HP regained
        </span>
      )}
      . Not the rest
    </span>
  )
}

/**
 * What came at the table of an attack, or a save the game asked for or made against a DC, or a
 * check made against one, as the game shows players: against a DC it doesn't say of, by its total.
 */
function outcomeOf(
  state: TableRollState,
  dc?: number,
  verdict?: LocalCheck['verdict'],
): string | undefined {
  const saved = savedAt(state, dc)
  if (saved !== undefined) return verdictWord(saved, verdict)
  if (state.healed !== undefined) return `${state.healed} HP regained`
  const { attack } = state
  if (!attack) return undefined
  // An area attack at more than one: how many it hit, of those the game says of.
  const told = (attack.targets ?? []).filter(({ outcome }) => outcome !== null)
  if (attack.targets && attack.targets.length > 1 && told.length > 0) {
    const hits = told.filter(({ outcome }) => outcome === 'hit').length
    const hit = `Hit ${hits} of ${told.length}`
    return attack.critical ? `Critical hit · ${hit}` : hit
  }
  if (attack.outcome === 'hit') return attack.critical ? 'Critical hit' : 'Hit'
  if (attack.outcome === 'miss') return 'Miss'
  return attack.critical ? 'Critical hit' : undefined
}

/**
 * Whether a save the game asked for, or a save or check made against a DC a description names,
 * succeeded there: as the game says, or else by its total against that DC.
 */
function savedAt(state: TableRollState, dc?: number): boolean | undefined {
  if (state.outcome) return state.outcome === 'success'
  if (dc !== undefined && state.total !== undefined) return state.total >= dc
}

/**
 * Whom an area attack at more than one hit, and whom it missed, by name, as the game shows
 * players; nothing of one the game says nothing of.
 */
function AreaOutcomes({ state }: Readonly<{ state: TableRollState }>) {
  const targets = state.attack?.targets ?? []
  if (targets.length < 2 || targets.every(({ outcome }) => outcome === null)) {
    return
  }
  return (
    <ul aria-label='Targets' className='mt-0.5 flex flex-wrap gap-x-3 text-xs'>
      {targets.map(({ combatantId, outcome }) => (
        <li key={combatantId} className='text-text-secondary'>
          {state.targetNames?.[combatantId] ?? 'A target'}
          {outcome && (
            <span
              className={clsx(
                'font-semibold',
                outcome === 'hit' ? 'text-text-primary' : 'text-text-secondary',
              )}
            >
              {': '}
              {outcome === 'hit' ? 'Hit' : 'Miss'}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Roll the damage or healing of an attack or use the game made, while the game waits for it: as
 * one of the kinds of damage it offers, a button each, where it offers a choice. Where the game
 * takes damage the player changed, a right-click or long-press offers to roll it at its highest,
 * or with its dice changed first.
 */
function DamageButton({
  name,
  state,
  onRollDamage,
  modifies = false,
}: Readonly<{
  name: string
  state: TableRollState
  onRollDamage: RollDue
  modifies?: boolean
}>) {
  const { open, dialogs } = useDamageMenu()
  const { damage, requestId } = state
  if (state.status !== 'done' || !damage || state.damaged || !requestId) return
  const due: DueDamage = {
    use: requestId,
    damage,
    ...(state.modifiers && { modifiers: state.modifiers }),
  }
  const Icon = damage.healing ? HeartPulse : Swords
  const kind = damage.healing ? 'healing' : 'damage'
  const button = clsx(
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
    damage.healing
      ? 'bg-primary/10 text-primary hover:bg-primary/20'
      : 'bg-damage/15 text-damage hover:bg-damage/25',
  )
  // Its dice as the game will throw them, for its menu to change them.
  const game = damageRollOf(name, due)
  const formula = damage.rolls.map(roll => roll.formula).join(' + ')
  const roll = (type?: string, modifiers?: DamageModifiers) => {
    if (modifiers) onRollDamage(name, due, type, modifiers)
    else if (type) onRollDamage(name, due, type)
    else onRollDamage(name, due)
  }
  // A button that rolls it, which a right-click or long-press offers to change first.
  const rollButton = (
    text: string,
    label: string,
    type: string | undefined,
    className: string,
  ) =>
    modifies ? (
      <RollButton
        target={type}
        onRoll={() => roll(type)}
        onMenu={(anchor, _, point) =>
          open(
            anchor,
            {
              label: game.label,
              formula,
              parts: game.parts,
              healing: damage.healing === true,
              perDie: game.perDie,
              // Damage the game rolls itself has no dice here to change, but can be its highest.
              choices: firstDie(game.parts)
                ? ['maximize', 'modify-damage']
                : ['maximize'],
              onChoose: ({ modifiers }) => roll(type, modifiers),
            },
            point,
          )
        }
        label={label}
        className={className}
      >
        <Icon aria-hidden className='size-4' />
        {text}
      </RollButton>
    ) : (
      <button
        type='button'
        aria-label={label}
        onClick={() => roll(type)}
        className={className}
      >
        <Icon aria-hidden className='size-4' />
        {text}
      </button>
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
            <span key={key} className='contents'>
              {rollButton(
                label,
                // A kind of healing names itself, such as Temporary Hit Points.
                damage.healing ? `Roll ${label}` : `Roll ${label} ${kind}`,
                key,
                button,
              )}
            </span>
          ))}
        </div>
        {dialogs}
      </div>
    )
  }
  const text = damage.critical ? `Roll critical ${kind}` : `Roll ${kind}`
  return (
    <>
      {rollButton(text, text, undefined, clsx(button, 'mt-2'))}
      {dialogs}
    </>
  )
}

/**
 * A roll's way to the game, in brief, among the earlier rolls: for a saving throw or check against
 * a DC a description names that the game didn't make, whether this roll made it, as when it was
 * the latest.
 */
function TableMark({
  state,
  roll,
}: Readonly<{ state?: TableRollState; roll: LocalRoll }>) {
  const here = roll.kind === 'check' ? savedHere(roll, state) : undefined
  const mine = here && (
    <span className='ml-1.5'>
      · DC {dcOf(roll)}, {here.toLowerCase()}
    </span>
  )
  if (!state) return mine
  const asked = roll.kind === 'ask'
  if (state.status === 'done') {
    if (asked) return <span className='ml-1.5'>· posted</span>
    if (roll.kind === 'use') {
      return <span className='ml-1.5'>· at the table</span>
    }
    const saved = state.visible ? savedAt(state, dcOf(roll)) : undefined
    const verdict = roll.kind === 'check' ? roll.verdict : undefined
    return (
      <span className='ml-1.5'>
        {state.visible ? `· table ${state.total ?? '?'}` : '· hidden'}
        {saved !== undefined &&
          `, ${verdictWord(saved, verdict).toLowerCase()}`}
      </span>
    )
  }
  if (state.status === 'sending' || state.status === 'rolling') {
    return <span className='ml-1.5'>· sending</span>
  }
  // Of dice sent one after another, those the game made before one it didn't.
  const made = state.together?.made
  if (made) {
    return (
      <span className='ml-1.5'>
        · {made} of {state.together?.count} at the table
      </span>
    )
  }
  return (
    <>
      {mine}
      <span className='ml-1.5'>
        {asked ? '· not posted' : '· not at the table'}
      </span>
    </>
  )
}

/** The DC a description names for a saving throw or check rolled against it, if any. */
function dcOf(roll: LocalRoll): number | undefined {
  return roll.kind === 'check' ? roll.dc : undefined
}

/**
 * Whether a saving throw or check against a DC a description names was made, by this roll, where
 * the game didn't make it: none where there's no DC, or the game made it, which its status says.
 */
function savedHere(
  roll: LocalCheck,
  state?: TableRollState,
): string | undefined {
  if (roll.dc === undefined || (state && !NOT_MADE.has(state.status))) return
  return verdictWord(roll.total >= roll.dc, roll.verdict)
}

/**
 * Whether a roll against a DC made it, in a word: a saving throw saved, a check passed, or either
 * failed.
 */
function verdictWord(made: boolean, verdict?: LocalCheck['verdict']): string {
  if (!made) return 'Failed'
  return verdict === 'check' ? 'Passed' : 'Saved'
}

/** Said of a roll from a description the game didn't take, which no one else sees. */
function OnlyYou() {
  return (
    <p className='mt-1 flex items-center gap-1.5 text-xs text-text-secondary'>
      <EyeOff aria-hidden className='size-3.5 shrink-0' />
      Only you see this roll
    </p>
  )
}

function CheckResult({
  roll,
  state,
  onRollDamage,
  modifies,
}: Readonly<{
  roll: LocalCheck
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
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
          {roll.dc !== undefined && ` · DC ${roll.dc}`}
          {savedHere(roll, state) && (
            <span className='font-semibold text-text-primary'>
              {' · '}
              {savedHere(roll, state)}
            </span>
          )}
        </p>
        {state && (
          <TableStatus state={state} dc={roll.dc} verdict={roll.verdict} />
        )}
        {!state && roll.described && <OnlyYou />}
        {state && onRollDamage && (
          <DamageButton
            name={roll.label.replace(/ attack$/, '')}
            state={state}
            onRollDamage={onRollDamage}
            modifies={modifies}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Damage or healing: the total, and each part of it with its dice and kind. Damage the game rolls
 * itself, which throws no dice here, shows the game's total; so does a critical hit's whose dice
 * the game's rules change as only it can add them up, once it says.
 */
function DamageResult({
  roll,
  state,
}: Readonly<{ roll: LocalDamage; state?: TableRollState }>) {
  const rolledThere = byTheGame(roll)
  const told = state?.status === 'done' && state.visible
  let total: number | string = roll.total
  if (rolledThere) {
    total = told ? (state.total ?? '?') : '…'
  } else if (roll.gameTotal && told) {
    total = state.total ?? '?'
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
                <Terms terms={part.terms} />
                {part.type && ` ${part.type}`}
              </span>
            ))}
          {roll.critical && ' · Critical hit'}
          {roll.maximized && ' · Maximum'}
        </p>
        {state && <TableStatus state={state} />}
        {!state && roll.described && <OnlyYou />}
      </div>
    </div>
  )
}

/**
 * A hit die spent, or a formula rolled: the total, and each of its terms with its dice, and the
 * least it comes to, where its dice came to less. Hit dice spent at once are one roll, every die
 * among its terms, and the least each gives back said where one gave back its least.
 */
function FormulaResult({
  roll,
  state,
}: Readonly<{ roll: LocalFormula; state?: TableRollState }>) {
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary tabular-nums'>
        {roll.total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Terms terms={roll.terms} />
          {roll.minimum !== undefined && ` · ${leastOf(roll)}`}
        </p>
        {state && <TableStatus state={state} />}
        {!state && roll.described && <OnlyYou />}
      </div>
    </div>
  )
}

/**
 * The least a roll with no d20 came to, as it says when its dice came to less: "at least 1", or
 * "at least 1 each" of several thrown together.
 */
function leastOf({ minimum, times }: LocalFormula): string {
  return `at least ${minimum}${times ? ' each' : ''}`
}

/** Each term of a roll with no d20, with its dice: 1d10 (7) +2. */
function Terms({ terms }: Readonly<{ terms: LocalExtra[] }>) {
  return terms.map(({ text, values }, at) => (
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
  ))
}

/**
 * A spell or feature used in the game: its way there, and once it's made, the damage or healing
 * that follows it, rolled at once, unless its kind is to be chosen first.
 */
function UseResult({
  roll,
  state,
  onRollDamage,
  modifies,
}: Readonly<{
  roll: LocalUse
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
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
              modifies={modifies}
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

/**
 * The table asked for a saving throw or check a description calls for: on dnd5e's own card in the
 * game's chat, for the Gamemaster to roll for those it names; its way there, or why it wasn't
 * posted.
 */
function AskResult({
  roll,
  state,
}: Readonly<{ roll: LocalAsk; state?: TableRollState }>) {
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
        <BellRing aria-hidden className='size-6' />
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <AskStatus state={state} />
      </div>
    </div>
  )
}

/** Where an ask is on its way to the game's chat, or why it isn't there. */
function AskStatus({ state }: Readonly<{ state?: TableRollState }>) {
  const line = 'mt-1 flex items-center gap-1.5 text-xs'
  switch (state?.status) {
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
            : 'Posting it in your Gamemaster’s game…'}
        </p>
      )
    }
    case 'done': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          Posted to the table’s chat
        </p>
      )
    }
    default: {
      const reason = state && ASK_REASONS[state.reason ?? state.status]
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          Not posted to the table
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
  if (roll.kind === 'ask') return 'asked'
  if (roll.kind === 'formula') {
    const terms = roll.terms
      .map(({ value }, index) =>
        index === 0 ? String(value) : formatModifier(value),
      )
      .join(' ')
    return roll.minimum === undefined ? terms : `${terms}, ${leastOf(roll)}`
  }
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
