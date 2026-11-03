import { choicesOf, missed } from '@/features/rolling/utils/damage-due'
import { favoriteReasons } from '@/features/rolling/utils/favorite-words'
import { effectReasons, EFFECT_WORDS } from '@/utils/effect-words'
import { formatModifier } from '@/utils/format-modifier'
import { moveReasons, moveWords } from '@/utils/move-words'
import { prepareReasons, PREPARE_WORDS } from '@/utils/prepare-words'
import { reasons, listed } from '@/utils/roll-reasons'
import { seatWords } from '@/utils/seat-words'
import {
  wildShapeReasons,
  WILD_SHAPE_WORDS,
  wildShapeToast,
} from '@/utils/wild-shape-words'
import type { useCreature } from '@/hooks/use-creature'
import type {
  TableRollState,
  LocalCheck,
  LocalRoll,
  LocalGmRoll,
  LocalFormula,
  LocalUse,
  RollKind,
  LocalExtra,
  LocalDamage,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { AloneSpend } from '@/types/sending-stone'

/** The creature a pane is for, where it isn't the character (module 0.36.0). */
export type Creature = NonNullable<ReturnType<typeof useCreature>>

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
export function onItsWay(
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
export function gmOutcomeOf(
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
  // A spell prepared or unprepared, from module 0.42.1, the same way.
  if (roll.prepare) {
    const words = PREPARE_WORDS[roll.prepare]
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
        return `${words.not}${reason ? `: ${reason}` : ''}`
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

/** Where an ask is on its way to the game's chat, or why it isn't there, in words. */
export function askedWords(
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
export const GM_WORDS_AFTER = 'rolled by your Gamemaster'

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
export function gmShape(roll: LocalGmRoll): 'use' | 'ask' | 'damage' | 'check' {
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
export function gmHidden(roll: LocalGmRoll, state?: TableRollState): boolean {
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
export function gmLine(
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
export function gmBadge(
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
export function damageBadge(
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

/** Is this damage the game's to roll, with no dice thrown here? */
export function byTheGame(roll: LocalDamage): boolean {
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

export function breakdown(roll: LocalRoll, state?: TableRollState): string {
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
    // A spell prepared or unprepared, from module 0.42.1, as its line says it.
    if (roll.prepare) return PREPARE_WORDS[roll.prepare].short
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
