import { useId } from 'react'
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
  type LucideIcon,
} from 'lucide-react'
import { useSpent } from '../../../sheet/components/effect-controls/use-spent'
import { useDamageMenu } from '../damage-menu/use-damage-menu'
import { RollButton } from '../roll-button/roll-button'
import {
  rechargeTitle,
  breakdown,
  byTheGame,
  thrownAgainThere,
  outcomeOf,
  onItsWay,
  reasonOf,
  savedHere,
  gmShape,
  enchantmentNote,
  savedAt,
  verdictWord,
  rechargeWord,
  shownTotal,
  damageBadge,
  leastOf,
  usedWords,
  askedWords,
  GM_WORDS,
  GM_WORDS_AFTER,
  gmBadge,
  gmLine,
  gmOutcomeOf,
  gmHidden,
  type Creature,
  type RollBrief,
} from '@/features/rolling/utils/brief'
import {
  choicesOf,
  damageDue,
  damageRollOf,
} from '@/features/rolling/utils/damage-due'
import { useCreature } from '@/hooks/use-creature'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import { useTableRole } from '@/hooks/use-table-api'
import {
  damageChanges,
  diceTakenAway,
  unmaximizable,
} from '@/utils/damage-modifiers'
import { formatModifier } from '@/utils/format-modifier'
import { listed } from '@/utils/roll-reasons'
import { seatWords } from '@/utils/seat-words'
import type { Spent } from '../../../sheet/components/effect-controls/types'
import type { TableRolls, RollDue, DueDamage } from '@/features/rolling/types'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalExtra,
  LocalFormula,
  LocalGmRoll,
  LocalRoll,
  LocalUse,
  TableRollState,
  OfferSpend,
  DamageModifiers,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/**
 * What a pane's rolls are called, as its tray, its rolls' button and its popover name them: the
 * player's own at the character's pane, a creature's at its own (module 0.36.0).
 */
export function rollsName(creature?: Creature): string {
  return creature ? `${creature.name}’s rolls` : 'Your rolls'
}

/**
 * The player's rolls, newest first, in a banner at the bottom of the sheet, as `RollHistory` has
 * them, where the player has their rolls shown so rather than as toasts.
 */
export function RollTray({
  rolls,
  rolling,
  table,
  announce = true,
}: Readonly<{
  rolls: LocalRoll[]
  rolling: boolean
  table?: TableRolls
  announce?: boolean
}>) {
  const creature = useCreature()
  return (
    <section
      aria-label={rollsName(creature)}
      className='shrink-0 border-t border-border bg-card px-4 py-3 md:px-8'
    >
      <RollHistory
        rolls={rolls}
        rolling={rolling}
        table={table}
        announce={announce}
        className='mx-auto max-w-5xl'
      />
    </section>
  )
}

/**
 * The player's rolls, newest first: the latest in full, the rest on request. It says whether they
 * reach the table, so no one expects one to have reached it that didn't: when the Gamemaster's
 * game takes the player's rolls, it makes them too, with the same dice, and this says what it made
 * of each. Where each roll also pops up as a toast, which says it, its status is left unannounced
 * (`announce`), so that a screen reader hears each roll once.
 */
export function RollHistory({
  rolls,
  rolling,
  table,
  announce = true,
  className,
}: Readonly<{
  rolls: LocalRoll[]
  rolling: boolean
  table?: TableRolls
  announce?: boolean
  className?: string
}>) {
  const [latest, ...earlier] = rolls
  const role = useTableRole()
  // The roll whose damage is offered here: the latest's own, or the player's latest beneath one of
  // the Gamemaster's (`offersDamage`); none while dice roll in the latest's place.
  const offered = rolling ? undefined : offersDamage(rolls)
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
    <div className={clsx('flex flex-col gap-2', className)}>
      <div role='status' aria-live={announce ? 'polite' : 'off'}>
        {status}
      </div>
      {offered && offered !== latest && table && (
        <DamageBehind roll={offered} table={table} />
      )}
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
                <span className='flex min-w-0 items-baseline gap-1.5'>
                  <span className='truncate'>
                    {rechargeTitle(roll, table?.states.get(roll.id))}
                  </span>
                  {roll.kind === 'gm' && <GmPill />}
                </span>
                <span className='shrink-0 text-xs text-text-secondary tabular-nums'>
                  {breakdown(roll, table?.states.get(roll.id))}
                  {(roll.kind === 'check' ||
                    roll.kind === 'formula' ||
                    (roll.kind === 'damage' && !byTheGame(roll))) &&
                    !thrownAgainThere(roll, table?.states.get(roll.id)) && (
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
      {/* Where rolls go, said of none beneath items and coins moved alone. */}
      {!movesAlone(rolls) &&
        (table?.available ? (
          <p className='text-[11px] text-text-secondary'>
            {reachOf(table, role)}
          </p>
        ) : (
          <p className='text-[11px] text-text-secondary'>
            {seatWords(role).notSent}
          </p>
        ))}
    </div>
  )
}

/**
 * Whether all the tray lists is items and coins moved, from module 0.31.0, or items removed, from
 * module 0.33.0, the player's or the Gamemaster's as the character: each is sent to the game, and
 * made or turned down there, whatever the game takes of the player's rolls and whether this device
 * sends them, so that what's said of rolls reaching it, or not, isn't said of them.
 */
function movesAlone(rolls: readonly LocalRoll[]): boolean {
  return (
    rolls.length > 0 &&
    rolls.every(roll =>
      roll.kind === 'gm'
        ? roll.rolled === 'transfer' || roll.rolled === 'remove'
        : roll.kind === 'use' && !!roll.move,
    )
  )
}

/**
 * The roll whose damage the latest in full offers: the latest; or, where that's one of the
 * Gamemaster's as the character (#156), which has none, the player's own latest, as it offered
 * it before theirs came, so that the Gamemaster's arriving takes nothing from the player.
 */
export function offersDamage(
  rolls: readonly LocalRoll[],
): LocalRoll | undefined {
  return rolls.find(roll => roll.kind !== 'gm')
}

/**
 * The damage of the player's own latest roll, while it's due, beneath one of the Gamemaster's as
 * the character that came after it (#156): named by its roll, as the rolls' button names those it
 * offers, as their buttons all say "Roll damage".
 */
function DamageBehind({
  roll,
  table,
}: Readonly<{ roll: LocalRoll; table: TableRolls }>) {
  const name = useId()
  const state = table.states.get(roll.id)
  if (!table.rollDamage || !damageDue(roll, state)) return
  return (
    <div role='group' aria-labelledby={name}>
      <p id={name} className='truncate text-sm font-semibold'>
        {roll.label}
      </p>
      <DamageDue
        roll={roll}
        state={state}
        onRollDamage={table.rollDamage}
        modifies={table.modifies}
      />
    </div>
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
    case 'gm': {
      return <GmResult roll={roll} state={state} />
    }
  }
}

/**
 * Whether the player's rolls reach the Gamemaster's game, and which; or where to send them, while
 * the game takes them but this device doesn't send them.
 */
function reachOf(table: TableRolls, role: SeatRole): string {
  if (!table.sending) {
    return 'Only you see these rolls: Send to the table is off in Settings.'
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
  return `${listed(kinds)} you ${listed(verbs, 'or')} here are made in ${seatWords(role).game} too, with the same dice.`
}

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
  const role = useTableRole()
  const creature = useCreature()
  const line = 'mt-1 flex items-center gap-1.5 text-xs'
  const outcome = outcomeOf(state, role, dc, verdict)
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <LoaderCircle
            aria-hidden
            className='size-3.5 shrink-0 motion-safe:animate-spin'
          />
          {onItsWay(state, role)}
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
              {outcome && (
                <span className='font-semibold text-text-primary'>
                  {' · '}
                  {outcome}
                </span>
              )}
            </span>
          </p>
          <AreaOutcomes state={state} />
        </>
      ) : (
        <p className={clsx(line, 'text-text-secondary')}>
          <EyeOff aria-hidden className='size-3.5 shrink-0' />
          {seatWords(role).hidden}
        </p>
      )
    }
    default: {
      const reason = reasonOf(state, role, creature)
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          {/* As one, so that why reads on from what was made, rather than beside it. */}
          <span>
            {state.together?.made ? (
              <PartlyMade state={state} together={state.together} />
            ) : (
              'Not made at the table'
            )}
            {reason ? `: ${reason}` : ''}
          </span>
        </p>
      )
    }
  }
}

/**
 * Of hit dice spent at once, sent one after another or as one, those the game made before one it
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
 * Whom an area attack at more than one hit, and whom it missed, by name, as the game shows
 * players; nothing of one the game says nothing of.
 */
export function AreaOutcomes({ state }: Readonly<{ state: TableRollState }>) {
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
 * The damage or healing of an attack or use the game made, to roll while it's due (`damageDue`),
 * after a miss too, as the tray, the rolls' popover and a toast that waits for it all offer it:
 * nothing once it's rolled, nor where there's no way to roll it.
 */
export function DamageDue({
  roll,
  state,
  onRollDamage,
  modifies,
  onTint = false,
}: Readonly<{
  roll: LocalRoll
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
  /** On a toast's tint, which its buttons' own tint would make too dark to read. */
  onTint?: boolean
}>) {
  if (!state || !onRollDamage || !damageDue(roll, state)) return
  return (
    <DamageButton
      // An attack's damage is named after its weapon or spell: "Longsword", not "Longsword attack".
      name={
        roll.kind === 'check' ? roll.label.replace(/ attack$/, '') : roll.label
      }
      state={state}
      onRollDamage={onRollDamage}
      modifies={modifies}
      onTint={onTint}
    />
  )
}

/**
 * The colours of the buttons that roll damage or healing: tinted, on the tray's card; or, on a
 * toast's tint, the card's own colour, outlined in theirs, for their words to read as clearly.
 */
const DAMAGE_BUTTONS = {
  damage: 'bg-damage/15 text-damage hover:bg-damage/25',
  healing: 'bg-primary/10 text-primary-text hover:bg-primary/20',
  damageOnTint: 'bg-card text-damage ring-1 ring-damage/40 hover:ring-damage',
  healingOnTint:
    'bg-card text-primary ring-1 ring-primary/40 hover:ring-primary',
}

/**
 * Roll the damage or healing of an attack or use the game made, while the game waits for it: as
 * one of the kinds of damage it offers, a button each, where it offers a choice. Where the game
 * takes damage the player changed, a right-click or long-press offers to roll it at its highest,
 * unless it takes a die away, or with its dice changed first, where it has a first die the game
 * changes; nothing where it offers neither.
 */
function DamageButton({
  name,
  state,
  onRollDamage,
  modifies = false,
  onTint,
}: Readonly<{
  name: string
  state: TableRollState
  onRollDamage: RollDue
  modifies?: boolean
  onTint: boolean
}>) {
  const { open, dialogs } = useDamageMenu()
  // A gone companion's pane rolls nothing, its due damage among it (module 0.36.0).
  const locked = useRollsLocked()
  const { damage, requestId } = state
  // Whether it's due is `damageDue`'s to say; these are only what rolling it takes.
  if (!damage || !requestId) return
  const due: DueDamage = {
    use: requestId,
    damage,
    ...(state.modifiers && { modifiers: state.modifiers }),
  }
  const Icon = damage.healing ? HeartPulse : Swords
  const kind = damage.healing ? 'healing' : 'damage'
  const button = clsx(
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
    DAMAGE_BUTTONS[`${kind}${onTint ? 'OnTint' : ''}`],
  )
  // Its dice as the game will throw them, for its menu to change them. Damage the game rolls itself
  // has no dice here to change, but can be its highest, unless its formula takes a die away, or
  // explodes one.
  const game = damageRollOf(name, due)
  const ways = damageChanges(
    game.parts,
    game.fixed,
    diceTakenAway(damage) || unmaximizable(damage),
  )
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
        onMenu={(anchor, _, point) => {
          if (ways.length === 0) return
          open(
            anchor,
            {
              label: game.label,
              formula,
              parts: game.parts,
              healing: damage.healing === true,
              perDie: game.perDie,
              choices: ways,
              onChoose: ({ modifiers }) => roll(type, modifiers),
            },
            point,
          )
        }}
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
        disabled={locked}
        onClick={() => roll(type)}
        className={clsx(
          className,
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
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
  // The Gamemaster's as the character (#156) are told as the player's own of their kind.
  const kind = roll.kind === 'gm' ? gmShape(roll) : roll.kind
  const asked = kind === 'ask'
  if (state.status === 'done') {
    if (asked) return <span className='ml-1.5'>· posted</span>
    if (kind === 'use') {
      return (
        <span className='ml-1.5'>
          {enchantmentNote(state.enchantment) ?? '· at the table'}
        </span>
      )
    }
    const saved = state.visible ? savedAt(state, dcOf(roll)) : undefined
    const verdict = roll.kind === 'check' ? roll.verdict : undefined
    // A recharge's, and damage on its own's, from module 0.36.0, in place of a save's word.
    let word = saved === undefined ? undefined : verdictWord(saved, verdict)
    if (state.recharge) word = state.visible ? rechargeWord(state) : undefined
    else if (state.alone && state.visible) word = 'on its own'
    return (
      <span className='ml-1.5'>
        {state.visible ? `· table ${state.total ?? '?'}` : '· hidden'}
        {word !== undefined && `, ${word.toLowerCase()}`}
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
        <DamageDue
          roll={roll}
          state={state}
          onRollDamage={onRollDamage}
          modifies={modifies}
        />
        <SpentLines roll={roll} state={state} />
      </div>
    </div>
  )
}

/**
 * What became of an effect a die offered spent, once the roll it was added to is made (module
 * 0.42.1), in the player's words: removed, being removed, or theirs to ask the Gamemaster to
 * remove, where they may not.
 */
export function spentLine(spend: OfferSpend, spent: Spent): string {
  if (spent.gone) return `${spend.offer} spent: ${spend.name} removed.`
  if (spent.removing) return `${spend.offer} spent: removing ${spend.name}…`
  return `${spend.offer} spent. Ask your Gamemaster to remove ${spend.name}.`
}

/**
 * Beneath a roll the player added a die offered to, such as Bardic Inspiration's (module 0.42.1),
 * once the game has made it: a line for each, saying what became of the effect it spent. None for
 * a roll still on its way, or not made, which spent nothing.
 */
export function SpentLines({
  roll,
  state,
}: Readonly<{ roll: LocalRoll; state?: TableRollState }>) {
  const spent = useSpent()
  if (roll.kind !== 'check' || !roll.spends || state?.status !== 'done') return
  return roll.spends.map(spend => (
    <p key={spend.effect} className='mt-1 text-sm text-text-secondary'>
      {spentLine(spend, spent(spend.effect))}
    </p>
  ))
}

/**
 * Damage or healing: the total, and each part of it with its dice and kind, a critical hit's in
 * the gold of a natural 20. Damage the game rolls itself, which throws no dice here, shows the
 * game's total; so does a critical hit's whose dice the game's rules change as only it can add
 * them up, once it says.
 */
function DamageResult({
  roll,
  state,
}: Readonly<{ roll: LocalDamage; state?: TableRollState }>) {
  const { game } = seatWords(useTableRole())
  const rolledThere = byTheGame(roll)
  const again = thrownAgainThere(roll, state)
  const total = shownTotal(roll, state)
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          BADGES[damageBadge(roll.healing, roll.critical)],
        )}
      >
        {total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          {rolledThere && `Its dice are rolled in ${game}`}
          {!rolledThere &&
            roll.parts.map((part, index) => (
              <span key={index}>
                {index > 0 && ' '}
                <Terms terms={part.terms} firstThrow={again} />
                {part.type && ` ${part.type}`}
              </span>
            ))}
          {roll.critical && ' · Critical hit'}
          {roll.maximized && ' · Maximum'}
          {again && thrownAgainWords(game)}
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
 * among its terms, and the least each gives back said where one gave back its least. One with a die
 * rerolled or exploded, which the game throws again itself, shows the game's total, once it says.
 */
function FormulaResult({
  roll,
  state,
}: Readonly<{ roll: LocalFormula; state?: TableRollState }>) {
  const { game } = seatWords(useTableRole())
  const again = thrownAgainThere(roll, state)
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary tabular-nums'>
        {shownTotal(roll, state)}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{rechargeTitle(roll, state)}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Terms terms={roll.terms} firstThrow={again} />
          {roll.minimum !== undefined && ` · ${leastOf(roll)}`}
          {again && thrownAgainWords(game)}
        </p>
        {state && <TableStatus state={state} />}
        {!state && roll.described && <OnlyYou />}
      </div>
    </div>
  )
}

/**
 * Each term of a roll with no d20, with its dice: 1d10 (7) +2. A term whose dice Foundry works out,
 * such as 2d6r<=2's, shows every die thrown, those rerolled or dropped struck through, such as
 * 2d6r<=2 (1, 5, 4) with its 1 rerolled; or, for a roll the game throws those again for itself,
 * only the first throw, which is what the game was sent (`firstThrow`).
 */
function Terms({
  terms,
  firstThrow = false,
}: Readonly<{ terms: LocalExtra[]; firstThrow?: boolean }>) {
  return terms.map(({ text, values, thrown }, at) => (
    <span key={at}>
      {at > 0 && ' '}
      {text}
      {values.length > 0 && (
        <>
          {' ('}
          <span className='font-semibold text-text-primary'>
            {thrown && !firstThrow
              ? thrown.map((die, index) => (
                  <span key={index}>
                    {index > 0 && ', '}
                    {die.active ? die.value : <s>{die.value}</s>}
                  </span>
                ))
              : values.join(', ')}
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
        <DamageDue
          roll={roll}
          state={state}
          onRollDamage={onRollDamage}
          modifies={modifies}
        />
      </div>
    </div>
  )
}

/**
 * Where a use is on its way to the game, or what became of it: for an enchant activity, the
 * enchantment it applied, and on what, or the one it ended. Or where an enchantment ended is.
 */
function UseStatus({
  roll,
  state,
}: Readonly<{ roll: LocalUse; state: TableRollState }>) {
  const role = useTableRole()
  const creature = useCreature()
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
          {usedWords(roll, state, role, creature)}
        </p>
      )
    }
    case 'done': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          <span>{usedWords(roll, state, role, creature)}</span>
        </p>
      )
    }
    default: {
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          {usedWords(roll, state, role, creature)}
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
  const role = useTableRole()
  const creature = useCreature()
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
          {askedWords(state, role, creature)}
        </p>
      )
    }
    case 'done': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          {askedWords(state, role, creature)}
        </p>
      )
    }
    default: {
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          {askedWords(state, role, creature)}
        </p>
      )
    }
  }
}

/**
 * The mark of a roll of the Gamemaster's, as the chat marks a message made for one: in the light
 * theme, in the accent's deeper shade, as the accent on its own tint falls short of WCAG AA this
 * small.
 */
export function GmPill() {
  return (
    <span
      title={GM_WORDS}
      className='shrink-0 rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary-text'
    >
      GM<span className='sr-only'>, {GM_WORDS_AFTER}</span>
    </span>
  )
}

/** Each kind of total's colours, in the tray and the toasts alike. */
export const BADGES: Record<RollBrief['badge'], string> = {
  critical: 'bg-gold text-on-gold',
  fumble: 'bg-ruby text-on-ruby',
  plain: 'bg-primary/10 text-primary',
  damage: 'bg-damage/15 text-damage',
  healing: 'bg-primary/10 text-primary',
  use: 'bg-primary/10 text-primary',
  ask: 'bg-primary/10 text-primary',
  hidden: 'bg-primary/10 text-primary',
  dice: 'bg-primary/10 text-primary',
}

/** A badge's icon, for one that shows no total. */
export const BADGE_ICONS: Partial<Record<RollBrief['badge'], LucideIcon>> = {
  use: Sparkles,
  ask: BellRing,
  hidden: EyeOff,
  dice: Dices,
}

/**
 * A roll the Gamemaster made as the player's character (#156), as the latest of the player's
 * rolls: marked as theirs, with the game's result, or where it stands, as the player's own of its
 * kind; and nothing to roll after it, as its damage is the Gamemaster's.
 */
function GmResult({
  roll,
  state,
}: Readonly<{ roll: LocalGmRoll; state?: TableRollState }>) {
  const role = useTableRole()
  const creature = useCreature()
  const { badge, total } = gmBadge(roll, state)
  const Icon = BADGE_ICONS[badge]
  const line = gmLine(roll, state, role, creature)
  const shape = gmShape(roll)
  const told =
    state?.status === 'done' &&
    state.visible &&
    ['check', 'damage'].includes(shape)
  const outcome = told ? gmOutcomeOf(roll, state, role) : undefined
  let icon = <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
  if (line?.tone === 'pending') {
    icon = (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  } else if (line?.tone === 'not') {
    icon = <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
  } else if (gmHidden(roll, state)) {
    icon = <EyeOff aria-hidden className='size-3.5 shrink-0' />
  }
  return (
    <div data-gm-roll={roll.id} className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          BADGES[badge],
        )}
      >
        {Icon ? <Icon aria-hidden className='size-6' /> : total}
      </span>
      <div className='min-w-0'>
        <p className='flex items-center gap-1.5'>
          <span className='truncate font-semibold'>{roll.label}</span>
          <GmPill />
        </p>
        <p className='text-xs text-text-secondary'>{GM_WORDS}</p>
        {line && (
          <p
            className={clsx(
              'mt-1 flex items-center gap-1.5 text-xs',
              line.tone === 'not' ? 'text-warning' : 'text-text-secondary',
            )}
          >
            {icon}
            {told ? (
              <span>
                At the table:{' '}
                <span className='font-semibold text-text-primary tabular-nums'>
                  {state.total ?? '?'}
                </span>
                {outcome && (
                  <span className='font-semibold text-text-primary'>
                    {' · '}
                    {outcome}
                  </span>
                )}
              </span>
            ) : (
              <span>{line.text}</span>
            )}
          </p>
        )}
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

/** What a roll the game throws dice again for says of it, after its dice, naming the game. */
function thrownAgainWords(game: string): string {
  return ` · Rerolls thrown in ${game}`
}
