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
import { useDamageMenu } from './damage-menu'
import { useSpent, type Spent } from './effect-controls'
import { RollButton } from './roll-button'
import { useCreature } from '@/hooks/use-creature'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import { useTableRole } from '@/hooks/use-table-api'
import {
  choicesOf,
  damageDue,
  damageRollOf,
  missed,
  type DueDamage,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import {
  damageChanges,
  diceTakenAway,
  unmaximizable,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { EFFECT_WORDS, effectReasons } from '@/utils/effect-words'
import { favoriteReasons } from '@/utils/favorite-words'
import { formatModifier } from '@/utils/format-modifier'
import { moveReasons, moveWords } from '@/utils/move-words'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import {
  WILD_SHAPE_WORDS,
  wildShapeReasons,
  wildShapeToast,
} from '@/utils/wild-shape-words'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalExtra,
  LocalFormula,
  LocalGmRoll,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'
import type { RollKind } from '@/types/roll'
import type { AloneSpend } from '@/types/sending-stone'
import type { OfferSpend } from '@/utils/effect-dice'

/** The player's rolls' way to the Gamemaster's game. */
export type TableRolls = {
  /** Each roll sent, by its id. */
  states: ReadonlyMap<string, TableRollState>
  /** Whether the game takes any of the player's rolls now. */
  available: boolean
  /** Whether the player sends them from this device, as the sheet's settings say. */
  sending: boolean
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

/** The creature a pane is for, where it isn't the character (module 0.36.0). */
type Creature = NonNullable<ReturnType<typeof useCreature>>

/**
 * What a pane's rolls are called, as its tray, its rolls' button and its popover name them: the
 * player's own at the character's pane, a creature's at its own (module 0.36.0).
 */
export function rollsName(creature?: Creature): string {
  return creature ? `${creature.name}’s rolls` : 'Your rolls'
}

/** Roll the damage the game waits for, as the kind chosen, changed as chosen. */
export type RollDue = (
  name: string,
  due: DueDamage,
  type?: string,
  modifiers?: DamageModifiers,
) => void

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

/** Words listed as a sentence has them: "a, b and c". */
export function listed(words: readonly string[], last = 'and'): string {
  return words.length > 1
    ? `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`
    : words.join('')
}

/**
 * What the game said of a roll, in words: why it wasn't made, mostly; as the seat at the sheet
 * reads it, its player or the Gamemaster (#156).
 */
function reasonsOf(role: SeatRole): Record<string, string> {
  const { game, notViewing, targets, applies } = seatWords(role)
  return {
    unavailable: `${game} isn’t taking rolls now`,
    off: `${game} isn’t taking rolls now`,
    unknown: 'your character in the game can’t make it',
    'not-dying': 'you aren’t dying',
    'not-in-combat': 'you aren’t in the combat',
    'already-rolled': 'you have rolled initiative already',
    busy: 'too many rolls at once. Wait a moment',
    cancelled: 'it was called off in the game',
    timeout: 'the game took too long',
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
    lost: `no answer from ${game}`,
    'attacks-off': `${game} isn’t taking attacks`,
    'midi-off': `${game} isn’t taking attacks`,
    'self-test': `${game} can’t make it with your dice`,
    item: 'your character in the game hasn’t that item',
    activity: 'it can’t be used from Sending Stone',
    area: `${game} can’t make that area attack from here`,
    ammo: 'you have none of that ammunition left',
    mode: 'the weapon can’t attack that way',
    target: 'a target can’t be picked, or there are too many',
    scene: `${notViewing} that target’s level or scene`,
    consume: 'there’s nothing left to use it with',
    slots: 'you have no spell slots left for it',
    slot: 'that spell slot can’t cast it',
    'damage-type': 'its kind of damage is chosen in the game',
    type: 'it can’t deal that kind of damage',
    'active-defence': `${targets} defend themselves`,
    reaction: 'you’ve used your reaction',
    'bonus-action': 'you’ve used your bonus action',
    'midi-dialog': `${game} asks how to roll it`,
    midi: `${game} stopped it`,
    'no-attack': 'the attack wasn’t made',
    gone: 'it can’t be found in the game any more',
    link: `${game} doesn’t find that in its description`,
    secret: 'it’s in a secret part of the description',
    'not-waiting': 'its damage was rolled in the game',
    'no-damage': 'no damage follows it',
    damaged: 'its damage is rolled already',
    dice: 'the dice weren’t those the game said',
    invalid: `${game} couldn’t make it`,
    prompt: `${game} isn’t asking for it any more`,
    'no-hit-dice': 'you have no hit dice of that size left',
    'full-hp': 'you’re at full hit points',
    profile: 'that enchantment isn’t offered at that level',
    'enchant-target': 'that item can’t take that enchantment',
    applied: 'that enchantment is on it already',
    enchant: `it was used, but the enchantment wasn’t applied: ${applies}`,
    enchantment: 'that enchantment can’t be ended from here',
    concentration: 'that concentration has already ended',
    uses: 'that can’t be spent from Sending Stone',
    short: 'you haven’t that many left',
    'not-inspired': 'you have no Heroic Inspiration to use',
    inspired: 'you have Heroic Inspiration already',
    // A creature's legendary action its pool can't pay, a recharge with nothing spent, and a
    // critical hit asked of damage on its own that has none, from module 0.36.0.
    legendary: 'it has too few legendary actions left',
    charged: 'it’s charged already',
    critical: 'that damage can’t be a critical hit’s',
    // A favorite, an effect or a removal while the character is transformed, from module 0.40.0.
    shaped: 'that waits until your character is back in their own form',
  }
}

/** Why a roll wasn't made, in words, for each seat. */
const REASONS_BY_ROLE: Record<SeatRole, Record<string, string>> = {
  player: reasonsOf('player'),
  gm: reasonsOf('gm'),
}

/** What the game said of a roll, in words, as a seat reads it. */
export function reasons(role: SeatRole): Record<string, string> {
  return REASONS_BY_ROLE[role]
}

/** As the character's player reads them. */
export const REASONS = REASONS_BY_ROLE.player

/**
 * Why a spell an item casts wasn't cast, or its attack made, in words, where it differs from why a
 * roll wasn't made: it's cast at a level the item offers, which no spell slot is spent for, and a
 * level the item no longer offers, as when its charges ran low, is refused as a slot is.
 */
const ITEM_CAST_REASONS: Record<string, string> = {
  slot: 'the item can’t cast it at that level now',
}

/**
 * Why a spell slot wasn't spent or restored from the dots, from module 0.42.1, in words, where it
 * differs from why a roll wasn't made: of a pool, not a cast, and made only from the count the dots
 * showed. The player's line and the Gamemaster's on the player's page alike.
 */
const SLOT_REASONS: Record<string, string> = {
  slots: 'none is left',
  full: 'none is used',
  slot: 'there are no such spell slots',
  changed: 'the slots changed in Foundry; look again',
}

/**
 * Why hit dice spent at once, sent as one, weren't all spent, in words, where it differs from why a
 * hit die wasn't: they're refused where fewer of a size are left than are spent, not only none.
 */
const HIT_DICE_REASONS: Record<string, string> = {
  'no-hit-dice': 'you haven’t that many hit dice left',
}

/**
 * Why an enchant activity's enchantment wasn't applied, in words, where it differs from why a use
 * wasn't made: where the game names no card of it, the Gamemaster can't apply it from one, as none
 * is in the game's chat, or one is that dnd5e lets no one apply it from, its concentration ended.
 */
const ENCHANT_REASONS: Record<string, string> = {
  enchant: 'it was used, but the enchantment wasn’t applied',
}

/**
 * Why a creature's roll wasn't made, at its own pane (module 0.36.0), where it differs from why
 * the character's wasn't: it's no longer one of the character's companions, or it acts right
 * after the character in initiative, which it doesn't roll. Made for each call, by its name.
 */
function creatureReasons(
  creature: Creature,
  role: SeatRole,
): Record<string, string> {
  const { game } = seatWords(role)
  return {
    unknown: `${creature.name} isn’t one of ${creature.character}’s companions in ${game} now`,
    follows: `it acts right after ${creature.character} in ${game}`,
  }
}

/**
 * Why a roll, an attack or a use wasn't made, in words, if it's one the player is told of: at a
 * creature's pane, as its own (module 0.36.0).
 */
function reasonOf(
  state: TableRollState,
  role: SeatRole,
  creature?: Creature,
): string | undefined {
  const key = state.reason ?? state.status
  const own =
    // A favorite added or removed, from module 0.37.0, one of the character's own effects changed,
    // from module 0.39.0, Wild Shape from module 0.40.0, and a move of items and coins, from module
    // 0.31.0, have words of their own.
    (state.favorite ? favoriteReasons(role)[key] : undefined) ??
    (state.effect ? effectReasons(role)[key] : undefined) ??
    // And Wild Shape from here, from module 0.40.0.
    (state.wildShape
      ? wildShapeReasons(role, state.wildShape)[key]
      : undefined) ??
    (state.move ? moveReasons(role, state.move.verb)[key] : undefined) ??
    // A spell slot spent or restored from the dots, from module 0.42.1.
    (state.spellSlot ? SLOT_REASONS[key] : undefined) ??
    (state.itemCast ? ITEM_CAST_REASONS[key] : undefined) ??
    (state.hitDice ? HIT_DICE_REASONS[key] : undefined) ??
    (state.card === false ? ENCHANT_REASONS[key] : undefined) ??
    (creature ? creatureReasons(creature, role)[key] : undefined)
  return own ?? reasons(role)[key]
}

/** Why the table wasn't asked, in words, where it differs from why a roll wasn't made. */
function askReasons(
  role: SeatRole,
  creature?: Creature,
): Record<string, string> {
  return {
    ...reasons(role),
    ...(creature && creatureReasons(creature, role)),
    busy: 'the table was asked a moment ago. Wait a little before asking again',
  }
}

/** Where a roll ends without the game having made it. */
const NOT_MADE = new Set<TableRollState['status']>([
  'failed',
  'expired',
  'lost',
  'refused',
])

/**
 * Where a roll, a use or an ask is on its way to the game, in words: sent, then being made there,
 * which a use or an ask says as what's done with it, such as "Casting it" or "Posting it".
 */
function onItsWay(
  state: TableRollState,
  role: SeatRole,
  doing = 'Rolling',
): string {
  // Of dice sent one after another, as hit dice spent at once, which is on its way.
  const die = state.together
    ? ` die ${state.together.made + 1} of ${state.together.count}`
    : ''
  const { game } = seatWords(role)
  return state.status === 'sending'
    ? `Sending${die} to ${game}…`
    : `${doing}${die} in ${game}…`
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
 * What came at the table of an attack, or a save the game asked for or made against a DC, or a
 * check made against one, as the game shows players: against a DC it doesn't say of, by its total.
 * From module 0.36.0, a recharge's, whose outcome is never a save's, and damage on its own's, for
 * the Gamemaster to apply, as the seat reads it.
 */
function outcomeOf(
  state: TableRollState,
  role: SeatRole,
  dc?: number,
  verdict?: LocalCheck['verdict'],
): string | undefined {
  if (state.recharge) return rechargeWord(state)
  if (state.alone) {
    return `on its own, for ${role === 'gm' ? 'you' : 'your Gamemaster'} to apply${spentWords(state)}`
  }
  const saved = savedAt(state, dc)
  if (saved !== undefined) return verdictWord(saved, verdict)
  if (state.healed !== undefined) return `${state.healed} HP regained`
  const { attack } = state
  if (!attack) return undefined
  // An area attack at more than one: how many it hit, of those the game says of.
  const told = areaTold(state)
  if (told) {
    const hits = told.filter(({ outcome }) => outcome === 'hit').length
    const hit = `Hit ${hits} of ${told.length}`
    return attack.critical ? `Critical hit · ${hit}` : hit
  }
  if (attack.outcome === 'hit') return attack.critical ? 'Critical hit' : 'Hit'
  if (attack.outcome === 'miss') return 'Miss'
  return attack.critical ? 'Critical hit' : undefined
}

/** What damage on its own spent, in words, as Foundry's card says it (module 0.41.0). */
const SPENT_WORDS: Record<AloneSpend, string> = {
  slot: 'spell slot',
  uses: 'use',
  ammunition: 'ammunition',
  thrown: 'thrown weapon',
}

/**
 * What damage on its own that asked to spend what its use would spent, once the game says, from
 * module 0.41.0 (round 0.41.0 §2.4.4), after its outcome: "; spell slot spent", "; spell slot and
 * use spent", "; nothing spent", and "; concentrating" where concentration began. Nothing for one
 * that didn't ask.
 */
function spentWords(state: TableRollState): string {
  if (!state.consumes || !state.aloneSpent) return ''
  const parts = state.aloneSpent.map(spent => SPENT_WORDS[spent] ?? spent)
  const spent =
    parts.length > 0 ? `; ${listed(parts)} spent` : '; nothing spent'
  return `${spent}${state.concentrating ? '; concentrating' : ''}`
}

/** Whether a recharge's d6 recharged its uses, as the game says, in words (module 0.36.0). */
function rechargeWord(state: TableRollState): string | undefined {
  if (state.outcome === 'success') return 'recharged'
  if (state.outcome === 'failure') return 'didn’t recharge'
  return undefined
}

/**
 * What a roll is called where it's shown: a recharge's d6 (module 0.36.0) by whether it recharged,
 * once the game says, such as "Fire Breath recharged"; any other by its label.
 */
export function rechargeTitle(roll: LocalRoll, state?: TableRollState): string {
  if (roll.kind !== 'formula' || !roll.recharge) return roll.label
  const { name } = roll.recharge
  if (state?.status === 'done' && state.outcome === 'success') {
    return `${name} recharged`
  }
  if (state?.status === 'done' && state.outcome === 'failure') {
    return `${name} didn’t recharge`
  }
  return roll.label
}

/**
 * Of an area attack at more than one, the targets the game says it hit or missed, in the order they
 * were picked; none of any other roll, or one the game says nothing of.
 */
function areaTold(state: TableRollState) {
  const targets = state.attack?.targets ?? []
  const told = targets.filter(({ outcome }) => outcome !== null)
  return targets.length > 1 && told.length > 0 ? told : undefined
}

/**
 * What came at the table of one of the Gamemaster's rolls as the character (#156), as `outcomeOf`
 * says; for damage the game says is a critical hit's, that it is, as the player's own says it, so
 * that it's told in words, not by its gold alone; for an area attack, which shows no list of its
 * targets, with whom it hit, in the order they were picked, by the names the player's own view of
 * the combat gives them (`targetNames`), and those it can't name counted after them, as one hidden
 * from players: "Hit 2 of 3: Bandit 1 and 1 more". Where it can name none, no more than
 * `outcomeOf` says.
 */
function gmOutcomeOf(
  roll: LocalGmRoll,
  state: TableRollState,
  role: SeatRole,
): string | undefined {
  const said = outcomeOf(state, role)
  // Said wherever it's gold, and only there: never of healing.
  if (
    gmShape(roll) === 'damage' &&
    damageBadge(roll.healing, state.critical) === 'critical'
  ) {
    return said ? `${said} · Critical hit` : 'Critical hit'
  }
  const hit = (areaTold(state) ?? []).filter(({ outcome }) => outcome === 'hit')
  const names = hit.flatMap(({ combatantId }) => {
    const name = state.targetNames?.[combatantId]
    return name ? [name] : []
  })
  if (!said || names.length === 0) return said
  const more = hit.length - names.length
  return `${said}: ${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
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

/**
 * What an enchant activity used at the table did, in brief: the enchantment it applied, and on
 * what, such as "· Magic Weapon, +1 on Longsword"; or else the one it ended, such as "· ended
 * Ablaze". Nothing where it did neither, as where it was left on its card.
 */
function enchantmentNote(
  enchantment: TableRollState['enchantment'],
): string | undefined {
  const { enchanted, ended } = enchantment ?? {}
  if (enchanted) return `· ${enchanted.name} on ${enchanted.itemName}`
  if (ended) return `· ended ${ended.name}`
  return undefined
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
  // A die its effects add skipped, for the game to roll, isn't in its total here, which can't say
  // then whether it made it (module 0.42.0).
  if (roll.skipped) return
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
 * The least a roll with no d20 came to, as it says when its dice came to less: "at least 1", or
 * "at least 1 each" of several thrown together.
 */
function leastOf({ minimum, times }: LocalFormula): string {
  return `at least ${minimum}${times ? ' each' : ''}`
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
 * Where a use is on its way to the game, or what became of it, in words: for an enchant activity,
 * the enchantment it applied, and on what. Charges spent say how many, as they go and once spent;
 * items and coins moved, from module 0.31.0, what moved and between whom.
 */
function usedWords(
  roll: LocalUse,
  state: TableRollState,
  role: SeatRole,
  creature?: Creature,
): string {
  // A favorite added or removed, from module 0.37.0: where it is on its way, then whether it's
  // done, as the game said, or why not.
  if (roll.favorite) {
    const adding = roll.favorite === 'add'
    switch (state.status) {
      case 'sending':
      case 'rolling': {
        return onItsWay(
          state,
          role,
          adding ? 'Adding it to favorites' : 'Removing it from favorites',
        )
      }
      case 'done': {
        return adding ? 'Added to favorites' : 'Removed from favorites'
      }
      default: {
        const reason = reasonOf(state, role, creature)
        return `Not ${adding ? 'added to' : 'removed from'} favorites${reason ? `: ${reason}` : ''}`
      }
    }
  }
  // One of the character's own effects turned off, on or deleted, from module 0.39.0, the same way.
  if (roll.effect) {
    const words = EFFECT_WORDS[roll.effect]
    switch (state.status) {
      case 'sending':
      case 'rolling': {
        return onItsWay(state, role, words.doing)
      }
      case 'done': {
        return words.done
      }
      default: {
        const reason = reasonOf(state, role, creature)
        return `Not ${words.short}${reason ? `: ${reason}` : ''}`
      }
    }
  }
  // Wild Shape from here, from module 0.40.0: a change, a return or a Beast learned, the same way.
  if (roll.wildShape) {
    const words = WILD_SHAPE_WORDS[roll.wildShape.op]
    switch (state.status) {
      case 'sending':
      case 'rolling': {
        return onItsWay(state, role, words.doing(roll.wildShape))
      }
      case 'done': {
        return words.done(madeOf(roll.wildShape, state))
      }
      default: {
        const reason = reasonOf(state, role, creature)
        return `${words.not}${reason ? `: ${reason}` : ''}`
      }
    }
  }
  if (roll.move) return moveWords(roll.move, state, role, reasons(role))
  let verb = roll.spell ? 'Cast' : 'Used'
  let doing = roll.spell ? 'Casting it' : 'Using it'
  if (roll.ending) [verb, doing] = ['Ended', 'Ending it']
  if (roll.inspiration === 'gain') [verb, doing] = ['Gained', 'Gaining it']
  if (roll.spent !== undefined)
    [verb, doing] = ['Spent', `Spending ${roll.spent}`]
  // A spell slot from the dots, from module 0.42.1: spent or restored, one at a time.
  if (roll.slot === 'spend') [verb, doing] = ['Spent', 'Spending it']
  if (roll.slot === 'restore') [verb, doing] = ['Restored', 'Restoring it']
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return onItsWay(state, role, doing)
    }
    case 'done': {
      const { damage } = state
      const follows = damage && !state.damaged && choicesOf(damage).length === 0
      const enchanted = roll.ending
        ? undefined
        : enchantmentNote(state.enchantment)
      return [
        roll.spent === undefined ? verb : `${verb} ${roll.spent}`,
        ' at the table',
        follows
          ? `, its ${damage.healing ? 'healing' : 'damage'} to follow`
          : '',
        enchanted ? ` ${enchanted}` : '',
      ].join('')
    }
    default: {
      const reason = reasonOf(state, role, creature)
      return `Not ${verb.toLowerCase()} at the table${reason ? `: ${reason}` : ''}`
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

/** Where an ask is on its way to the game's chat, or why it isn't there, in words. */
function askedWords(
  state: TableRollState | undefined,
  role: SeatRole,
  creature?: Creature,
): string {
  switch (state?.status) {
    case 'sending':
    case 'rolling': {
      return onItsWay(state, role, 'Posting it')
    }
    case 'done': {
      return 'Posted to the table’s chat'
    }
    default: {
      const reason =
        state && askReasons(role, creature)[state.reason ?? state.status]
      return `Not posted to the table${reason ? `: ${reason}` : ''}`
    }
  }
}

/** What a roll of the Gamemaster's as the player's character says of itself (#156). */
export const GM_WORDS = 'Rolled by your Gamemaster'

/** The same, after what the roll is called, or what it came to. */
const GM_WORDS_AFTER = 'rolled by your Gamemaster'

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

/** The kinds of roll that are damage or healing, as the Gamemaster's are told. */
const DAMAGE_KINDS: ReadonlySet<RollKind> = new Set<RollKind>([
  'damage',
  'textDamage',
  'itemDamage',
])

/**
 * What a roll of the Gamemaster's as the character is told as (#156): a use or an ask, as the
 * player's own are, charges spent or Heroic Inspiration as a use, from module 0.29.0, as they have
 * no total; damage; or else a roll with a total, as a check is.
 */
function gmShape(roll: LocalGmRoll): 'use' | 'ask' | 'damage' | 'check' {
  if (roll.rolled === 'use' || roll.rolled === 'ask') return roll.rolled
  if (roll.rolled === 'spend' || roll.rolled === 'inspiration') return 'use'
  // A spell slot spent or restored, from module 0.42.1, has no total either.
  if (roll.rolled === 'spellSlot') return 'use'
  // Items and coins moved, from module 0.31.0, and items removed, from module 0.33.0, have no
  // total either.
  if (roll.rolled === 'transfer' || roll.rolled === 'remove') return 'use'
  // Damage on its own too, from module 0.36.0.
  if (DAMAGE_KINDS.has(roll.rolled)) return 'damage'
  return 'check'
}

/**
 * What's said of a use of the Gamemaster's as the character as it goes, and once done: of charges
 * spent, that they were; of Heroic Inspiration, which their page doesn't say was used or gained,
 * that it changed; of items or coins moved, from module 0.31.0, that they were; of an item
 * removed, from module 0.33.0, that it was; of anything else, that it was used.
 */
function gmVerbs(roll: LocalGmRoll): { doing: string; done: string } {
  if (roll.rolled === 'spend') return { doing: 'Spending', done: 'Spent' }
  // A spell slot, from module 0.42.1, as their page asked: spent or restored.
  if (roll.rolled === 'spellSlot') {
    if (roll.slotOp === 'spend') return { doing: 'Spending', done: 'Spent' }
    if (roll.slotOp === 'restore') {
      return { doing: 'Restoring', done: 'Restored' }
    }
    return { doing: 'Changing', done: 'Changed' }
  }
  if (roll.rolled === 'transfer') return { doing: 'Moving', done: 'Moved' }
  if (roll.rolled === 'remove') return { doing: 'Removing', done: 'Removed' }
  if (roll.rolled === 'inspiration') {
    return { doing: 'Changing', done: 'Changed' }
  }
  return { doing: 'Using', done: 'Used' }
}

/**
 * Whether the game made a roll of the Gamemaster's, and hid it from the player: never a use or an
 * ask, which say only that they were made.
 */
function gmHidden(roll: LocalGmRoll, state?: TableRollState): boolean {
  return (
    state?.status === 'done' &&
    !state.visible &&
    ['check', 'damage'].includes(gmShape(roll))
  )
}

/**
 * A roll of the Gamemaster's as the character's way to the game, in the tray's words, as the
 * player's own of its kind (#156): on its way, made, with the game's total and what came of it,
 * hidden as the game hid it, or not made, and why. None before the page has heard of it.
 */
function gmLine(
  roll: LocalGmRoll,
  state: TableRollState | undefined,
  role: SeatRole,
  creature?: Creature,
): RollBrief['table'] {
  if (!state) return undefined
  const tone = toneOf(state)
  const shape = gmShape(roll)
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      let doing = 'Rolling'
      if (shape === 'use') doing = `${gmVerbs(roll).doing} it`
      if (shape === 'ask') doing = 'Posting it'
      return { tone, text: onItsWay(state, role, doing) }
    }
    case 'done': {
      if (shape === 'use') {
        const enchanted = enchantmentNote(state.enchantment)
        return {
          tone,
          text: `${gmVerbs(roll).done} at the table${enchanted ? ` ${enchanted}` : ''}`,
        }
      }
      if (shape === 'ask') return { tone, text: 'Posted to the table’s chat' }
      if (!state.visible) return { tone, text: seatWords(role).hidden }
      const outcome = gmOutcomeOf(roll, state, role)
      const total = `At the table: ${state.total ?? '?'}`
      return { tone, text: outcome ? `${total} · ${outcome}` : total }
    }
    default: {
      // A spell slot's in the words the player's own is told in, from module 0.42.1.
      const slot =
        roll.rolled === 'spellSlot'
          ? SLOT_REASONS[state.reason ?? state.status]
          : undefined
      const reason = slot ?? reasonOf(state, role, creature)
      const { together } = state
      let made = 'Not made at the table'
      if (shape === 'use') {
        made = `Not ${gmVerbs(roll).done.toLowerCase()} at the table`
      }
      if (shape === 'ask') made = 'Not posted to the table'
      if (together?.made) {
        made = `${together.made} of ${together.count} made at the table. Not the rest`
      }
      return { tone, text: reason ? `${made}: ${reason}` : made }
    }
  }
}

/**
 * How a roll of the Gamemaster's as the character shows in its badge (#156): the game's total, in
 * the colours the player's own take, once the game has made it where they may see it; else a use's
 * or an ask's icon, the hidden mark, or dice while it's on its way, or wasn't made.
 */
function gmBadge(
  roll: LocalGmRoll,
  state?: TableRollState,
): Pick<RollBrief, 'badge' | 'total'> {
  const shape = gmShape(roll)
  if (shape === 'use' || shape === 'ask') return { badge: shape }
  if (gmHidden(roll, state)) return { badge: 'hidden' }
  if (state?.status !== 'done' || state.total === undefined) {
    return { badge: 'dice' }
  }
  let badge: RollBrief['badge'] = 'plain'
  if (shape === 'damage') badge = damageBadge(roll.healing, state.critical)
  else if (state.d20 === 'critical' || state.attack?.critical) {
    badge = 'critical'
  } else if (state.d20 === 'fumble') badge = 'fumble'
  return { badge, total: state.total }
}

/**
 * How damage's total shows, the player's own or the Gamemaster's as the character (#156): healing
 * as healing, whatever made it; a critical hit's in the gold of a natural 20; any other in the
 * damage colour.
 */
function damageBadge(
  healing: boolean | undefined,
  critical: boolean | undefined,
): 'healing' | 'critical' | 'damage' {
  if (healing) return 'healing'
  return critical ? 'critical' : 'damage'
}

/** The colour damage's toast takes, as its total shows (`damageBadge`). */
const DAMAGE_ACCENTS: Record<
  ReturnType<typeof damageBadge>,
  RollBrief['accent']
> = {
  healing: 'primary',
  critical: 'gold',
  damage: 'damage',
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

/**
 * Does the game throw some of this roll's dice again for itself, rerolled or exploded, as Foundry
 * does with its own dice: one sent to it and not turned away, a die of which was thrown again here
 * too? Only its first throw, which is what the game was sent, is then shown, and the game's total
 * once it says, as the dice thrown again here aren't the game's.
 */
function thrownAgainThere(roll: LocalRoll, state?: TableRollState): boolean {
  if (!state || NOT_MADE.has(state.status)) return false
  if (roll.kind === 'formula') return thrownAgain(roll.terms)
  if (roll.kind === 'damage') {
    return roll.parts.some(part => thrownAgain(part.terms))
  }
  return false
}

/** Was a die of these terms thrown again, rerolled or exploded, as Foundry throws one? */
function thrownAgain(terms: LocalExtra[]): boolean {
  return terms.some(({ thrown }) =>
    thrown?.some(die => die.rerolled || die.exploded),
  )
}

/** Is this damage the game's to roll, with no dice thrown here? */
function byTheGame(roll: LocalDamage): boolean {
  return roll.parts.every(part => part.terms.length === 0)
}

/**
 * What a Wild Shape command logged here did, as the game says it, once made: the form it took or
 * left and the Beast it learned, by the names the game gives them, where it gives them.
 */
function madeOf(
  logged: NonNullable<LocalUse['wildShape']>,
  state: TableRollState,
): NonNullable<LocalUse['wildShape']> {
  const made = state.wildShaped
  if (made?.op === 'transform' || made?.op === 'learn') {
    return { ...logged, form: made.form.name }
  }
  if (made?.op === 'revert' && made.form) {
    return { ...logged, form: made.form.name }
  }
  return logged
}

function breakdown(roll: LocalRoll, state?: TableRollState): string {
  if (roll.kind === 'gm') return GM_WORDS_AFTER
  if (roll.kind === 'use') {
    if (roll.move) {
      return {
        give: 'given',
        take: 'taken',
        send: 'sent',
        distribute: 'distributed',
        remove: 'removed',
      }[roll.move.verb]
    }
    // A favorite added or removed, from module 0.37.0, as its line says it.
    if (roll.favorite) {
      return roll.favorite === 'add'
        ? 'added to favorites'
        : 'removed from favorites'
    }
    // One of the character's own effects changed, from module 0.39.0, as its line says it.
    if (roll.effect) return EFFECT_WORDS[roll.effect].short
    // Wild Shape from here, from module 0.40.0, as its line says it.
    if (roll.wildShape) return WILD_SHAPE_WORDS[roll.wildShape.op].short
    if (roll.ending) return 'ended'
    // A spell slot from the dots, from module 0.42.1, as its line says it.
    if (roll.slot) return roll.slot === 'spend' ? 'spent' : 'restored'
    if (roll.spent !== undefined) return `spent ${roll.spent}`
    if (roll.inspiration === 'gain') return 'gained'
    return roll.spell ? 'cast' : 'used'
  }
  if (roll.kind === 'ask') return 'asked'
  if (thrownAgainThere(roll, state)) return 'thrown again at the table'
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

/**
 * The total a damage roll, a hit die or a formula shows: its own, or the game's where the game
 * throws its dice, or some of them again, or adds them up as only it can, once it says; "…" until
 * then, where its own isn't it.
 */
export function shownTotal(
  roll: LocalDamage | LocalFormula,
  state?: TableRollState,
): number | string {
  const told = state?.status === 'done' && state.visible
  if (
    (roll.kind === 'damage' && byTheGame(roll)) ||
    thrownAgainThere(roll, state)
  ) {
    return told ? (state.total ?? '?') : '…'
  }
  if (roll.gameTotal && told) return state.total ?? '?'
  return roll.total
}

/** A roll in brief, as its toast says it: what it was, what it came to, and its way to the game. */
export type RollBrief = {
  label: string
  /**
   * How its total shows, as the tray's: a critical, a fumble, damage, healing, a use or an ask; and
   * for one of the Gamemaster's as the character (#156), hidden, or dice while there's no total.
   */
  badge:
    | 'critical'
    | 'fumble'
    | 'plain'
    | 'damage'
    | 'healing'
    | 'use'
    | 'ask'
    | 'hidden'
    | 'dice'
  /** The colour its toast is edged and tinted in, by how it came out (`accentOf`). */
  accent: 'warning' | 'gold' | 'ruby' | 'damage' | 'primary'
  /** None for a use or an ask, which show an icon; "…" while the game's total is awaited. */
  total?: number | string
  /** Its dice, in a line; none for a use or an ask. */
  dice?: string
  /** Its way to the game, in the tray's words; none for a roll never sent. */
  table?: { tone: 'pending' | 'made' | 'not'; text: string }
  /** Made by the Gamemaster as the player's character (#156), marked so. */
  gm?: true
}

/**
 * A roll in brief, for its toast: what the tray says of it, in words, but for the d20 that didn't
 * count; and the colour its toast takes. The targets of an area attack, and the damage to roll
 * that follows a roll, the toast shows as the tray does. At a creature's pane, why one wasn't made
 * is said as its own (module 0.36.0).
 */
export function briefOf(
  roll: LocalRoll,
  state?: TableRollState,
  role: SeatRole = 'player',
  creature?: Creature,
): RollBrief {
  const table = tableLine(roll, state, role, creature)
  const brief = {
    label: rechargeTitle(roll, state),
    table,
    accent: accentOf(roll, state, table),
  }
  switch (roll.kind) {
    case 'check': {
      let badge: RollBrief['badge'] = 'plain'
      if (roll.natural === 20) badge = 'critical'
      if (roll.natural === 1) badge = 'fumble'
      return {
        ...brief,
        badge,
        total: roll.total,
        dice: checkDice(roll, state),
      }
    }
    case 'damage': {
      return {
        ...brief,
        badge: damageBadge(roll.healing, roll.critical),
        total: shownTotal(roll, state),
        dice: [
          breakdown(roll, state),
          roll.critical ? ' · Critical hit' : '',
          roll.maximized ? ' · Maximum' : '',
        ].join(''),
      }
    }
    case 'formula': {
      return {
        ...brief,
        badge: 'plain',
        total: shownTotal(roll, state),
        dice: breakdown(roll, state),
      }
    }
    case 'use': {
      // Wild Shape made, from module 0.40.0, says what the character is now, and what it gave.
      if (roll.wildShape && state?.status === 'done') {
        const told = wildShapeToast(
          madeOf(roll.wildShape, state),
          state.wildShaped?.op === 'transform' ? state.wildShaped : undefined,
        )
        return {
          ...brief,
          label: told.title,
          ...(told.line && { dice: told.line }),
          table: undefined,
          badge: 'use',
        }
      }
      return { ...brief, badge: 'use' }
    }
    case 'ask': {
      return { ...brief, badge: 'ask' }
    }
    case 'gm': {
      return { ...brief, ...gmBadge(roll, state), dice: GM_WORDS, gm: true }
    }
  }
}

/**
 * The colour a roll's toast takes, the first that fits: the warning's for one not made at the
 * table; gold for a natural 20, a critical hit, or a critical hit's damage; ruby for a natural 1, a
 * miss, or a saving throw or check that failed; the damage colour for other damage; and the accent
 * for healing, and anything else, as the tray colours them.
 */
function accentOf(
  roll: LocalRoll,
  state: TableRollState | undefined,
  table: RollBrief['table'],
): RollBrief['accent'] {
  if (table?.tone === 'not') return 'warning'
  if (roll.kind === 'damage') {
    return DAMAGE_ACCENTS[damageBadge(roll.healing, roll.critical)]
  }
  // What the game made of it, where the player may see it.
  const seen = state?.status === 'done' && state.visible ? state : undefined
  if (roll.kind === 'gm') return gmAccent(roll, seen)
  if (roll.kind !== 'check') return 'primary'
  if (roll.natural === 20 || seen?.attack?.critical) return 'gold'
  if (roll.natural === 1 || missed(seen) || madeIt(roll, state) === false) {
    return 'ruby'
  }
  return 'primary'
}

/**
 * The colour a roll of the Gamemaster's as the character takes (#156), as one of the player's own
 * of its kind, by what the game made of it where the player may see it: gold for a critical, or a
 * critical hit's damage; ruby for a fumble, a miss or a save that failed; the damage colour for
 * other damage, never healing.
 */
function gmAccent(
  roll: LocalGmRoll,
  seen: TableRollState | undefined,
): RollBrief['accent'] {
  const shape = gmShape(roll)
  if (!seen || shape === 'use' || shape === 'ask') return 'primary'
  if (shape === 'damage') {
    return DAMAGE_ACCENTS[damageBadge(roll.healing, seen.critical)]
  }
  if (seen.d20 === 'critical' || seen.attack?.critical) return 'gold'
  if (seen.d20 === 'fumble' || missed(seen) || savedAt(seen) === false) {
    return 'ruby'
  }
  return 'primary'
}

/**
 * Whether a saving throw or check against a DC made it, as the tray says: at the table, as the game
 * says or by its total there, where the game made it and the player may see it; else by this roll,
 * where the game didn't make it, or it wasn't sent. Nothing while it's on its way, or hidden.
 */
function madeIt(roll: LocalCheck, state?: TableRollState): boolean | undefined {
  if (state?.status === 'done') {
    return state.visible ? savedAt(state, roll.dc) : undefined
  }
  if (roll.dc === undefined || (state && !NOT_MADE.has(state.status))) return
  // Nor by this roll where a die its effects add was skipped, which its total leaves out.
  if (roll.skipped) return
  return roll.total >= roll.dc
}

/**
 * A check's dice in a line, as the tray shows them but for the d20 that didn't count: such as
 * "d20 14 +3 · Advantage · DC 15 · Saved".
 */
function checkDice(roll: LocalCheck, state?: TableRollState): string {
  const here = savedHere(roll, state)
  return [
    `d20 ${roll.natural} ${formatModifier(roll.modifier)}`,
    ...roll.extras.map(
      ({ text, values }) =>
        ` ${text}${values.length > 0 ? ` (${values.join(', ')})` : ''}`,
    ),
    roll.advantage === 'adv' ? ' · Advantage' : '',
    roll.advantage === 'dis' ? ' · Disadvantage' : '',
    roll.natural === 20 ? ' · Natural 20' : '',
    roll.natural === 1 ? ' · Natural 1' : '',
    roll.dc === undefined ? '' : ` · DC ${roll.dc}`,
    here ? ` · ${here}` : '',
  ].join('')
}

/**
 * A roll's way to the game as the tray's status line says it, but for its icon, an area attack's
 * targets, and the hit dice sent one after another asking that the page be kept open. None for a
 * roll never sent; an ask never sent wasn't posted, as the tray says.
 */
function tableLine(
  roll: LocalRoll,
  state: TableRollState | undefined,
  role: SeatRole,
  creature?: Creature,
): RollBrief['table'] {
  if (roll.kind === 'ask') {
    return { tone: toneOf(state), text: askedWords(state, role, creature) }
  }
  if (roll.kind === 'gm') return gmLine(roll, state, role, creature)
  if (!state) return undefined
  const tone = toneOf(state)
  if (roll.kind === 'use') {
    return { tone, text: usedWords(roll, state, role, creature) }
  }
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return { tone, text: onItsWay(state, role) }
    }
    case 'done': {
      if (!state.visible) return { tone, text: seatWords(role).hidden }
      const outcome =
        roll.kind === 'check'
          ? outcomeOf(state, role, roll.dc, roll.verdict)
          : outcomeOf(state, role)
      const total = `At the table: ${state.total ?? '?'}`
      return { tone, text: outcome ? `${total} · ${outcome}` : total }
    }
    default: {
      const { together, healed } = state
      const reason = reasonOf(state, role, creature)
      const healing = healed === undefined ? '' : ` · ${healed} HP regained`
      const made = together?.made
        ? `${together.made} of ${together.count} made at the table${healing}. Not the rest`
        : 'Not made at the table'
      return { tone, text: reason ? `${made}: ${reason}` : made }
    }
  }
}

/** Whether a roll is on its way to the game, was made there, or wasn't. */
function toneOf(
  state?: TableRollState,
): NonNullable<RollBrief['table']>['tone'] {
  switch (state?.status) {
    case 'sending':
    case 'rolling': {
      return 'pending'
    }
    case 'done': {
      return 'made'
    }
    default: {
      return 'not'
    }
  }
}
