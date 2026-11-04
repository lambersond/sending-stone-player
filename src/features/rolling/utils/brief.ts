import { NOT_MADE } from '@/constants/lifecycle'
import { missed } from '@/features/rolling/utils/damage-due'
import {
  GM_WORDS,
  GM_WORDS_AFTER,
  gmBadge,
  gmLine,
  gmShape,
} from '@/features/rolling/utils/gm-words'
import {
  askedWords,
  byTheGame,
  damageBadge,
  leastOf,
  madeOf,
  outcomeOf,
  reasonOf,
  rechargeTitle,
  savedAt,
  savedHere,
  thrownAgainThere,
  toneOf,
  usedWords,
  wayWords,
} from '@/features/rolling/utils/tray-words'
import { EFFECT_WORDS } from '@/utils/effect-words'
import { formatModifier } from '@/utils/format-modifier'
import { PREPARE_WORDS } from '@/utils/prepare-words'
import { seatWords } from '@/utils/seat-words'
import { WILD_SHAPE_WORDS, wildShapeToast } from '@/utils/wild-shape-words'
import type { Creature, RollBrief } from '@/features/rolling/types'
import type {
  TableRollState,
  LocalCheck,
  LocalRoll,
  LocalGmRoll,
  LocalFormula,
  LocalDamage,
  LocalMove,
  LocalUse,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/** The colour damage's toast takes, as its total shows (`damageBadge`). */
const DAMAGE_ACCENTS: Record<
  ReturnType<typeof damageBadge>,
  RollBrief['accent']
> = {
  healing: 'primary',
  critical: 'gold',
  damage: 'damage',
}

/** What items or coins moved did, in a word, as its line says it, from module 0.31.0. */
const MOVED: Record<LocalMove['verb'], string> = {
  give: 'given',
  take: 'taken',
  send: 'sent',
  distribute: 'distributed',
  remove: 'removed',
}

/** What a use did, in a word or two, as its line says it. */
function usedWord(roll: LocalUse): string {
  if (roll.move) return MOVED[roll.move.verb]
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

/** A formula's terms, each but the first with its sign, and the least it came to, if it says. */
function formulaBreakdown(roll: LocalFormula): string {
  const terms = roll.terms
    .map(({ value }, index) =>
      index === 0 ? String(value) : formatModifier(value),
    )
    .join(' ')
  return roll.minimum === undefined ? terms : `${terms}, ${leastOf(roll)}`
}

/** Damage's parts, each with its kind; or, for damage the game rolls itself, that it does. */
function damageBreakdown(roll: LocalDamage): string {
  if (byTheGame(roll)) return 'rolled at the table'
  return roll.parts
    .map(part => (part.type ? `${part.total} ${part.type}` : part.total))
    .join(' + ')
}

/** A check's d20 that counted, its modifier and its extras' values. */
function checkBreakdown(roll: LocalCheck): string {
  return [
    roll.natural,
    formatModifier(roll.modifier),
    ...roll.extras.map(({ value }) => formatModifier(value)),
  ].join(' ')
}

/**
 * What a roll came to, in brief, as its row among the earlier rolls and its toast say it: its dice
 * or terms; what a use, an ask or one of the Gamemaster's as the character (#156) did; or, for one
 * the game throws dice again for, that it does.
 */
export function breakdown(roll: LocalRoll, state?: TableRollState): string {
  if (roll.kind === 'gm') return GM_WORDS_AFTER
  if (roll.kind === 'use') return usedWord(roll)
  if (roll.kind === 'ask') return 'asked'
  if (thrownAgainThere(roll, state)) return 'thrown again at the table'
  if (roll.kind === 'formula') return formulaBreakdown(roll)
  if (roll.kind === 'damage') return damageBreakdown(roll)
  return checkBreakdown(roll)
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
      if (roll.wildShape && state?.status === 'done') {
        return wildShapeBrief(brief, roll.wildShape, state)
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
 * Wild Shape made, from module 0.40.0, in brief: what the character is now, and what it gave, in
 * place of its way to the game.
 */
function wildShapeBrief(
  brief: Pick<RollBrief, 'label' | 'table' | 'accent'>,
  logged: NonNullable<LocalUse['wildShape']>,
  state: TableRollState,
): RollBrief {
  const told = wildShapeToast(
    madeOf(logged, state),
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
  const words = {
    doing: 'Rolling',
    done: madeAtTable(roll, state, role),
    not: notMadeAtTable(state),
  }
  return {
    tone,
    text: wayWords(state, role, words, reasonOf(state, role, creature)),
  }
}

/** What the game made of a roll, as its total and what came of it; or that it's hidden. */
function madeAtTable(
  roll: LocalRoll,
  state: TableRollState,
  role: SeatRole,
): string {
  if (!state.visible) return seatWords(role).hidden
  const outcome =
    roll.kind === 'check'
      ? outcomeOf(state, role, roll.dc, roll.verdict)
      : outcomeOf(state, role)
  const total = `At the table: ${state.total ?? '?'}`
  return outcome ? `${total} · ${outcome}` : total
}

/**
 * That a roll wasn't made, before why: of hit dice spent at once, how many the game made before
 * one it didn't, and the hit points they gave back.
 */
function notMadeAtTable(state: TableRollState): string {
  const { together, healed } = state
  const healing = healed === undefined ? '' : ` · ${healed} HP regained`
  return together?.made
    ? `${together.made} of ${together.count} made at the table${healing}. Not the rest`
    : 'Not made at the table'
}
