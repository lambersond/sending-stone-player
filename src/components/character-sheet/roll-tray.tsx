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
import { useTableRole } from '@/hooks/use-table-api'
import {
  choicesOf,
  damageRollOf,
  type DueDamage,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import {
  damageChanges,
  diceTakenAway,
  unmaximizable,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { formatModifier } from '@/utils/format-modifier'
import { seatWords, type SeatRole } from '@/utils/seat-words'
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
 * says what it made of each. Where each roll also pops up as a toast, which says it, the tray's
 * status is left unannounced (`announce`), so that a screen reader hears each roll once.
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
  const [latest, ...earlier] = rolls
  const role = useTableRole()
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
        <div role='status' aria-live={announce ? 'polite' : 'off'}>
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
        {table?.available ? (
          <p className='text-[11px] text-text-secondary'>
            {reachOf(table, role)}
          </p>
        ) : (
          <p className='text-[11px] text-text-secondary'>
            {seatWords(role).notSent}
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
function listed(words: string[], last = 'and'): string {
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

/** Why a roll, an attack or a use wasn't made, in words, if it's one the player is told of. */
function reasonOf(state: TableRollState, role: SeatRole): string | undefined {
  const key = state.reason ?? state.status
  const own =
    (state.itemCast ? ITEM_CAST_REASONS[key] : undefined) ??
    (state.hitDice ? HIT_DICE_REASONS[key] : undefined) ??
    (state.card === false ? ENCHANT_REASONS[key] : undefined)
  return own ?? reasons(role)[key]
}

/** Why the table wasn't asked, in words, where it differs from why a roll wasn't made. */
function askReasons(role: SeatRole): Record<string, string> {
  return {
    ...reasons(role),
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
          {seatWords(role).hidden}
        </p>
      )
    }
    default: {
      const reason = reasonOf(state, role)
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
 * unless it takes a die away, or with its dice changed first, where it has a first die the game
 * changes; nothing where it offers neither.
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
      return (
        <span className='ml-1.5'>
          {enchantmentNote(state.enchantment) ?? '· at the table'}
        </span>
      )
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
  const { game } = seatWords(useTableRole())
  const rolledThere = byTheGame(roll)
  const again = thrownAgainThere(roll, state)
  const total = shownTotal(roll, state)
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
        <p className='truncate font-semibold'>{roll.label}</p>
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

/**
 * Where a use is on its way to the game, or what became of it: for an enchant activity, the
 * enchantment it applied, and on what, or the one it ended. Or where an enchantment ended is.
 */
function UseStatus({
  roll,
  state,
}: Readonly<{ roll: LocalUse; state: TableRollState }>) {
  const role = useTableRole()
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
          {usedWords(roll, state, role)}
        </p>
      )
    }
    case 'done': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          <span>{usedWords(roll, state, role)}</span>
        </p>
      )
    }
    default: {
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          {usedWords(roll, state, role)}
        </p>
      )
    }
  }
}

/**
 * Where a use is on its way to the game, or what became of it, in words: for an enchant activity,
 * the enchantment it applied, and on what.
 */
function usedWords(
  roll: LocalUse,
  state: TableRollState,
  role: SeatRole,
): string {
  let verb = roll.spell ? 'Cast' : 'Used'
  let doing = roll.spell ? 'Casting' : 'Using'
  if (roll.ending) [verb, doing] = ['Ended', 'Ending']
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return onItsWay(state, role, `${doing} it`)
    }
    case 'done': {
      const { damage } = state
      const follows = damage && !state.damaged && choicesOf(damage).length === 0
      const enchanted = roll.ending
        ? undefined
        : enchantmentNote(state.enchantment)
      return [
        `${verb} at the table`,
        follows
          ? `, its ${damage.healing ? 'healing' : 'damage'} to follow`
          : '',
        enchanted ? ` ${enchanted}` : '',
      ].join('')
    }
    default: {
      const reason = reasonOf(state, role)
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
          {askedWords(state, role)}
        </p>
      )
    }
    case 'done': {
      return (
        <p className={clsx(line, 'text-text-secondary')}>
          <Send aria-hidden className='size-3.5 shrink-0 text-primary' />
          {askedWords(state, role)}
        </p>
      )
    }
    default: {
      return (
        <p className={clsx(line, 'text-warning')}>
          <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
          {askedWords(state, role)}
        </p>
      )
    }
  }
}

/** Where an ask is on its way to the game's chat, or why it isn't there, in words. */
function askedWords(state: TableRollState | undefined, role: SeatRole): string {
  switch (state?.status) {
    case 'sending':
    case 'rolling': {
      return onItsWay(state, role, 'Posting it')
    }
    case 'done': {
      return 'Posted to the table’s chat'
    }
    default: {
      const reason = state && askReasons(role)[state.reason ?? state.status]
      return `Not posted to the table${reason ? `: ${reason}` : ''}`
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

function breakdown(roll: LocalRoll, state?: TableRollState): string {
  if (roll.kind === 'use') {
    if (roll.ending) return 'ended'
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
  /** How its total shows, as the tray's: a critical, a fumble, damage, healing, a use or an ask. */
  badge: 'critical' | 'fumble' | 'plain' | 'damage' | 'healing' | 'use' | 'ask'
  /** None for a use or an ask, which show an icon; "…" while the game's total is awaited. */
  total?: number | string
  /** Its dice, in a line; none for a use or an ask. */
  dice?: string
  /** Its way to the game, in the tray's words; none for a roll never sent. */
  table?: { tone: 'pending' | 'made' | 'not'; text: string }
}

/**
 * A roll in brief, for its toast: what the tray says of it, in words, but for the d20 that didn't
 * count, the targets of an area attack, and anything to tap, which stay in the tray.
 */
export function briefOf(
  roll: LocalRoll,
  state?: TableRollState,
  role: SeatRole = 'player',
): RollBrief {
  const brief = { label: roll.label, table: tableLine(roll, state, role) }
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
        badge: roll.healing ? 'healing' : 'damage',
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
      return { ...brief, badge: 'use' }
    }
    case 'ask': {
      return { ...brief, badge: 'ask' }
    }
  }
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
): RollBrief['table'] {
  if (roll.kind === 'ask') {
    return { tone: toneOf(state), text: askedWords(state, role) }
  }
  if (!state) return undefined
  const tone = toneOf(state)
  if (roll.kind === 'use') return { tone, text: usedWords(roll, state, role) }
  switch (state.status) {
    case 'sending':
    case 'rolling': {
      return { tone, text: onItsWay(state, role) }
    }
    case 'done': {
      if (!state.visible) return { tone, text: seatWords(role).hidden }
      const outcome =
        roll.kind === 'check'
          ? outcomeOf(state, roll.dc, roll.verdict)
          : outcomeOf(state)
      const total = `At the table: ${state.total ?? '?'}`
      return { tone, text: outcome ? `${total} · ${outcome}` : total }
    }
    default: {
      const { together, healed } = state
      const reason = reasonOf(state, role)
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
