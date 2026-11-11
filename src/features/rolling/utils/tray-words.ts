import { NOT_MADE } from '@/constants/lifecycle'
import { choicesOf } from '@/features/rolling/utils/damage-due'
import { favoriteReasons } from '@/features/rolling/utils/favorite-words'
import { effectReasons, EFFECT_WORDS } from '@/utils/effect-words'
import { hitPointsReasons, hitPointsWords } from '@/utils/hit-point-words'
import { moveReasons, moveWords } from '@/utils/move-words'
import { prepareReasons, PREPARE_WORDS } from '@/utils/prepare-words'
import { reasons, listed } from '@/utils/roll-reasons'
import { seatWords } from '@/utils/seat-words'
import { wildShapeReasons, WILD_SHAPE_WORDS } from '@/utils/wild-shape-words'
import type { Creature, RollBrief, TableRolls, WayWords } from '../types'
import type { Spent } from '@/features/sheet/components/effect-controls/types'
import type {
  TableRollState,
  LocalCheck,
  LocalRoll,
  LocalFormula,
  LocalUse,
  LocalExtra,
  LocalDamage,
  OfferSpend,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { AloneSpend } from '@/types/sending-stone'

/**
 * What a pane's rolls are called, as its tray, its rolls' button and its popover name them: the
 * player's own at the character's pane, a creature's at its own (module 0.36.0).
 */
export function rollsName(creature?: Creature): string {
  return creature ? `${creature.name}’s rolls` : 'Your rolls'
}

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
export const SLOT_REASONS: Record<string, string> = {
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
export function reasonOf(
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
    // A spell prepared or unprepared, from module 0.42.1.
    (state.prepare ? prepareReasons(role)[key] : undefined) ??
    // Hit points set, from module 0.44.0: a companion's no longer its character's keeps a
    // creature's words, below.
    (state.hitPoints ? hitPointsReasons(role)[key] : undefined) ??
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

/**
 * Where a roll, a use or an ask is on its way to the game, in words: sent, then being made there,
 * which a use or an ask says as what's done with it, such as "Casting it" or "Posting it"; and
 * from module 0.44.0, while the game asks the player for the dice of a later roll in its run,
 * that it waits for them.
 */
export function onItsWayWords(
  state: TableRollState,
  role: SeatRole,
  doing = 'Rolling',
): string {
  if (state.status === 'rolling' && state.diceAsked) {
    return 'Waiting for your dice…'
  }
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
 * A term of the dice the game asked for that the player left to it, from module 0.44.0, as the
 * tray writes its terms: such as "+1d6 Fire, left to the game".
 */
export function leftToTheGame(term: string): string {
  return `${term}, left to the game`
}

/**
 * That a roll, a use or an ask went to the game, where the app took it with nothing to follow it
 * by (`unfollowed`), so what the game made of it isn't known here.
 */
export function sentWords(role: SeatRole): string {
  return `Sent to ${seatWords(role).game}`
}

/**
 * What came at the table of an attack, or a save the game asked for or made against a DC, or a
 * check made against one, as the game shows players: against a DC it doesn't say of, by its total.
 * From module 0.36.0, a recharge's, whose outcome is never a save's, and damage on its own's, for
 * the Gamemaster to apply, as the seat reads it.
 */
export function outcomeOf(
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
export function rechargeWord(state: TableRollState): string | undefined {
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
export function areaTold(state: TableRollState) {
  const targets = state.attack?.targets ?? []
  const told = targets.filter(({ outcome }) => outcome !== null)
  return targets.length > 1 && told.length > 0 ? told : undefined
}

/**
 * Whether a save the game asked for, or a save or check made against a DC a description names,
 * succeeded there: as the game says, or else by its total against that DC.
 */
export function savedAt(
  state: TableRollState,
  dc?: number,
): boolean | undefined {
  if (state.outcome) return state.outcome === 'success'
  if (dc !== undefined && state.total !== undefined) return state.total >= dc
}

/**
 * What an enchant activity used at the table did, in brief: the enchantment it applied, and on
 * what, such as "· Magic Weapon, +1 on Longsword"; or else the one it ended, such as "· ended
 * Ablaze". Nothing where it did neither, as where it was left on its card.
 */
export function enchantmentNote(
  enchantment: TableRollState['enchantment'],
): string | undefined {
  const { enchanted, ended } = enchantment ?? {}
  if (enchanted) return `· ${enchanted.name} on ${enchanted.itemName}`
  if (ended) return `· ended ${ended.name}`
  return undefined
}

/**
 * Whether a saving throw or check against a DC a description names was made, by this roll, where
 * the game didn't make it: none where there's no DC, or the game made it, which its status says.
 */
export function savedHere(
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
export function verdictWord(
  made: boolean,
  verdict?: LocalCheck['verdict'],
): string {
  if (!made) return 'Failed'
  return verdict === 'check' ? 'Passed' : 'Saved'
}

/**
 * The least a roll with no d20 came to, as it says when its dice came to less: "at least 1", or
 * "at least 1 each" of several thrown together.
 */
export function leastOf({ minimum, times }: LocalFormula): string {
  return `at least ${minimum}${times ? ' each' : ''}`
}

/**
 * A command's way to the game, in words: sent, then being done there, as `doing` says it; `done`
 * once the game has done it, or that it was sent, where it couldn't be followed; else `not`, and
 * why (`reason`), where the player is told why.
 */
export function wayWords(
  state: TableRollState | undefined,
  role: SeatRole,
  words: WayWords,
  reason?: string,
): string {
  switch (state?.status) {
    case 'sending':
    case 'rolling': {
      return onItsWayWords(state, role, words.doing)
    }
    case 'done': {
      return state.unfollowed ? sentWords(role) : words.done
    }
    default: {
      return `${words.not}${reason ? `: ${reason}` : ''}`
    }
  }
}

/**
 * Of hit dice spent at once, how many the game made before one it didn't: "2 of 3 made at the
 * table"; or, where the app took any of those with no id to follow it by (`unfollowed`), only how
 * many were sent: "2 of 3 sent to your Gamemaster's game", as what the game made of it isn't known.
 */
export function partlyWords(
  { count, made, unfollowed }: NonNullable<TableRollState['together']>,
  role: SeatRole,
): string {
  return unfollowed
    ? `${made} of ${count} sent to ${seatWords(role).game}`
    : `${made} of ${count} made at the table`
}

/**
 * That a roll wasn't made, before why: of hit dice spent at once, how many the game made (or was
 * sent) before one it didn't, and the hit points they gave back.
 */
export function notMadeAtTable(state: TableRollState, role: SeatRole): string {
  const { together, healed } = state
  const healing = healed === undefined ? '' : ` · ${healed} HP regained`
  return together?.made
    ? `${partlyWords(together, role)}${healing}. Not the rest`
    : 'Not made at the table'
}

/** A favorite added or removed, from module 0.37.0, on its way, done, and not. */
const FAVORITE_WORDS = {
  add: {
    doing: 'Adding it to favorites',
    done: 'Added to favorites',
    not: 'Not added to favorites',
  },
  remove: {
    doing: 'Removing it from favorites',
    done: 'Removed from favorites',
    not: 'Not removed from favorites',
  },
}

/**
 * The words of a command with words of its own, where it is on its way, then whether it's done, as
 * the game said, or why not: none for a use, or items and coins moved. At a creature's pane, its
 * own, by its name.
 */
function commandWords(
  roll: LocalUse,
  state: TableRollState,
  creature?: Creature,
): WayWords | undefined {
  // A favorite added or removed, from module 0.37.0.
  if (roll.favorite) return FAVORITE_WORDS[roll.favorite]
  // One of the character's own effects turned off, on or deleted, from module 0.39.0, the same way.
  if (roll.effect) {
    const words = EFFECT_WORDS[roll.effect]
    return { doing: words.doing, done: words.done, not: `Not ${words.short}` }
  }
  // A spell prepared or unprepared, from module 0.42.1, the same way.
  if (roll.prepare) return PREPARE_WORDS[roll.prepare]
  // Hit points set, from module 0.44.0, made as the game says they are now: the character's, or
  // at its own pane a creature's.
  if (roll.hitPoints) return hitPointsWords(state.hitPointsNow, creature?.name)
  // Wild Shape from here, from module 0.40.0: a change, a return or a Beast learned, the same way.
  if (roll.wildShape) {
    const words = WILD_SHAPE_WORDS[roll.wildShape.op]
    return {
      doing: words.doing(roll.wildShape),
      done: words.done(madeOf(roll.wildShape, state)),
      not: words.not,
    }
  }
  return undefined
}

/**
 * What a use did, and what it's doing on its way, in a word or two: cast or used; or, the last that
 * fits, ended, Heroic Inspiration gained, charges spent, or a spell slot from the dots, from module
 * 0.42.1, spent or restored, one at a time.
 */
function verbsOf(roll: LocalUse): [verb: string, doing: string] {
  if (roll.slot === 'restore') return ['Restored', 'Restoring it']
  if (roll.slot === 'spend') return ['Spent', 'Spending it']
  if (roll.spent !== undefined) return ['Spent', `Spending ${roll.spent}`]
  if (roll.inspiration === 'gain') return ['Gained', 'Gaining it']
  if (roll.ending) return ['Ended', 'Ending it']
  return roll.spell ? ['Cast', 'Casting it'] : ['Used', 'Using it']
}

/**
 * What a use made at the table says: charges spent, how many; the damage or healing that follows
 * it, where its kind needn't be chosen first; and for an enchant activity, the enchantment it
 * applied.
 */
function usedAt(roll: LocalUse, verb: string, state: TableRollState): string {
  const { damage } = state
  const follows = damage && !state.damaged && choicesOf(damage).length === 0
  const enchanted = roll.ending ? undefined : enchantmentNote(state.enchantment)
  return [
    roll.spent === undefined ? verb : `${verb} ${roll.spent}`,
    ' at the table',
    follows ? `, its ${damage.healing ? 'healing' : 'damage'} to follow` : '',
    enchanted ? ` ${enchanted}` : '',
  ].join('')
}

/**
 * Where a use is on its way to the game, or what became of it, in words: for an enchant activity,
 * the enchantment it applied, and on what. Charges spent say how many, as they go and once spent;
 * items and coins moved, from module 0.31.0, what moved and between whom.
 */
export function usedWords(
  roll: LocalUse,
  state: TableRollState,
  role: SeatRole,
  creature?: Creature,
): string {
  const own = commandWords(roll, state, creature)
  if (own) return wayWords(state, role, own, reasonOf(state, role, creature))
  if (roll.move) return moveWords(roll.move, state, role, reasons(role))
  const [verb, doing] = verbsOf(roll)
  const words = {
    doing,
    done: usedAt(roll, verb, state),
    not: `Not ${verb.toLowerCase()} at the table`,
  }
  return wayWords(state, role, words, reasonOf(state, role, creature))
}

/** Where an ask is on its way to the game's chat, or why it isn't there, in words. */
export function askedWords(
  state: TableRollState | undefined,
  role: SeatRole,
  creature?: Creature,
): string {
  const words = {
    doing: 'Posting it',
    done: 'Posted to the table’s chat',
    not: 'Not posted to the table',
  }
  const reason =
    state && askReasons(role, creature)[state.reason ?? state.status]
  return wayWords(state, role, words, reason)
}

/**
 * How damage's total shows, the player's own or the Gamemaster's as the character (#156): healing
 * as healing, whatever made it; a critical hit's in the gold of a natural 20; any other in the
 * damage colour.
 */
export function damageBadge(
  healing: boolean | undefined,
  critical: boolean | undefined,
): 'healing' | 'critical' | 'damage' {
  if (healing) return 'healing'
  return critical ? 'critical' : 'damage'
}

/**
 * Does the game throw some of this roll's dice again for itself, rerolled or exploded, as Foundry
 * does with its own dice: one sent to it and not turned away, a die of which was thrown again here
 * too? Only its first throw, which is what the game was sent, is then shown, and the game's total
 * once it says, as the dice thrown again here aren't the game's.
 */
export function thrownAgainThere(
  roll: LocalRoll,
  state?: TableRollState,
): boolean {
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

/**
 * Is this a die thrown again whose answer left it to the game (module 0.44.0)? Its value is the
 * game's alone, counted in its roll's total, so no number is shown for it.
 */
export function leftAgain(roll: LocalRoll): boolean {
  return (
    roll.kind === 'formula' &&
    roll.again !== undefined &&
    roll.terms.every(({ values }) => values.length === 0)
  )
}

/** Is this damage the game's to roll, with no dice thrown here? */
export function byTheGame(roll: LocalDamage): boolean {
  return roll.parts.every(part => part.terms.length === 0)
}

/**
 * What a Wild Shape command logged here did, as the game says it, once made: the form it took or
 * left and the Beast it learned, by the names the game gives them, where it gives them.
 */
export function madeOf(
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

/** Whether a roll is on its way to the game, was made there, or wasn't. */
export function toneOf(
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

/**
 * Whether the player's rolls reach the Gamemaster's game, and which; or where to send them, while
 * the game takes them but this device doesn't send them; or, where the game takes none, that they
 * aren't sent.
 */
export function reachOf(table: TableRolls | undefined, role: SeatRole): string {
  if (!table?.available) return seatWords(role).notSent
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
 * What a roll's damage is called, by its button: an attack's after its weapon or spell, such as
 * "Longsword", not "Longsword attack"; any other's by its label.
 */
export function damageName(roll: LocalRoll): string {
  return roll.kind === 'check' ? roll.label.replace(/ attack$/, '') : roll.label
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

/** What a roll the game throws dice again for says of it, after its dice, naming the game. */
export function thrownAgainWords(game: string): string {
  return ` · Rerolls thrown in ${game}`
}
