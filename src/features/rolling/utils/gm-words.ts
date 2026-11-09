import { ROLL_KIND_INFO } from '@/constants/roll-kinds'
import {
  areaTold,
  damageBadge,
  enchantmentNote,
  notMadeAtTable,
  outcomeOf,
  reasonOf,
  SLOT_REASONS,
  toneOf,
  wayWords,
} from '@/features/rolling/utils/tray-words'
import { seatWords } from '@/utils/seat-words'
import type { Creature, RollBrief } from '@/features/rolling/types'
import type { TableRollState, LocalGmRoll, RollKindInfo } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/**
 * What a roll of the Gamemaster's as the character is told as (#156): an ask, as the player's own
 * is; a use, as the player's own are, and anything else they send that throws no dice, as it has
 * no total: charges spent or Heroic Inspiration, from module 0.29.0, a spell slot spent or
 * restored, from module 0.42.1, items and coins moved, from module 0.31.0, and items removed, from
 * module 0.33.0; damage, on its own too from module 0.36.0; or else a roll with a total, as a check
 * is.
 */
export function gmShape(roll: LocalGmRoll): 'use' | 'ask' | 'damage' | 'check' {
  if (roll.rolled === 'ask') return 'ask'
  const info: RollKindInfo = ROLL_KIND_INFO[roll.rolled]
  if (info.dice === 'none' && info.gm !== false) return 'use'
  if (info.damage) return 'damage'
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
  const shape = gmShape(roll)
  const words = {
    doing: gmDoing(roll, shape),
    done: gmDone(roll, shape, state, role),
    not: gmNotMade(roll, shape, state, role),
  }
  const reason = gmReason(roll, state, role, creature)
  return { tone: toneOf(state), text: wayWords(state, role, words, reason) }
}

/** What's said of one on its way to the game, as the player's own of its kind. */
function gmDoing(roll: LocalGmRoll, shape: ReturnType<typeof gmShape>): string {
  if (shape === 'use') return `${gmVerbs(roll).doing} it`
  if (shape === 'ask') return 'Posting it'
  return 'Rolling'
}

/**
 * What's said of one the game made: a use done, and the enchantment it applied; an ask posted;
 * else the game's total and what came of it, or that it's hidden, as the game hid it.
 */
function gmDone(
  roll: LocalGmRoll,
  shape: ReturnType<typeof gmShape>,
  state: TableRollState,
  role: SeatRole,
): string {
  if (shape === 'use') {
    const enchanted = enchantmentNote(state.enchantment)
    return `${gmVerbs(roll).done} at the table${enchanted ? ` ${enchanted}` : ''}`
  }
  if (shape === 'ask') return 'Posted to the table’s chat'
  if (!state.visible) return seatWords(role).hidden
  const outcome = gmOutcomeOf(roll, state, role)
  const total = `At the table: ${state.total ?? '?'}`
  return outcome ? `${total} · ${outcome}` : total
}

/**
 * What's said of one the game didn't make, before why: of hit dice spent at once, how many it
 * made before one it didn't, and the hit points they gave back, as the player's own say.
 */
function gmNotMade(
  roll: LocalGmRoll,
  shape: ReturnType<typeof gmShape>,
  state: TableRollState,
  role: SeatRole,
): string {
  if (state.together?.made) return notMadeAtTable(state, role)
  if (shape === 'use') {
    return `Not ${gmVerbs(roll).done.toLowerCase()} at the table`
  }
  if (shape === 'ask') return 'Not posted to the table'
  return 'Not made at the table'
}

/**
 * Why one wasn't made, in words: a spell slot's in the words the player's own is told in, from
 * module 0.42.1.
 */
function gmReason(
  roll: LocalGmRoll,
  state: TableRollState,
  role: SeatRole,
  creature?: Creature,
): string | undefined {
  const slot =
    roll.rolled === 'spellSlot'
      ? SLOT_REASONS[state.reason ?? state.status]
      : undefined
  return slot ?? reasonOf(state, role, creature)
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
