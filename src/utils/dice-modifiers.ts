import type { ExtraDice } from '@/utils/roll-modifiers'

/*
 * What Foundry does with a term's dice once they're thrown, as a sheet's formula may say after its
 * faces, such as Great Weapon Fighting's 2d6r<=2 or 4d6kh3: reroll some, explode some, keep or drop
 * some, count each at least or at most so much, or count successes or failures. Each is read and
 * worked out here as Foundry v14's `Die` does it, so that the app's total of a roll made here is
 * the game's. At the table the player's dice are each die's first throw only: Foundry throws the
 * dice it rerolls or explodes itself, so the game's total stands once it says.
 */

/** How a result is compared with a modifier's target, as Foundry compares them. */
export type Comparison = '=' | '<' | '<=' | '>' | '>='

/** One of a term's modifiers, read. */
export type DieModifier =
  | {
      /** Rerolled (`r`, once; `rr`, until it no longer matches) or exploded (`x`; `xo`, once). */
      kind: 'reroll' | 'explode'
      recursive: boolean
      /** The most results rerolled or exploded; none for no limit. */
      most?: number
      comparison: Comparison
      target: number
    }
  | {
      /** Kept (`k`, `kh`, `kl`) or dropped (`d`, `dh`, `dl`) among the active results. */
      kind: 'keep' | 'drop'
      highest: boolean
      count: number
    }
  | {
      /** Each result counts at least (`min`) or at most (`max`) so much. */
      kind: 'min' | 'max'
      value: number
    }
  | {
      /** Each result counts 1 where it matches, else 0: a success (`cs`) or a failure (`cf`). */
      kind: 'count'
      success: boolean
      comparison: Comparison
      target: number
    }

/** A die of a term as thrown, and what became of it. */
export type ThrownDie = {
  /** The face it landed on. */
  value: number
  /** It counts toward the total. */
  active: boolean
  /** What it counts as, where a modifier says, such as 1 for a success; else its value. */
  counts?: number
  /** It was rerolled: a die thrown after it took its place. */
  rerolled?: true
  /** It exploded: another die was thrown for it. */
  exploded?: true
  /** It was dropped, or not kept. */
  discarded?: true
}

/** A term's dice as thrown and worked out, and what they came to. */
export type ThrownTerm = {
  /** Every die thrown, in the order Foundry throws them: the first throw, then the rest. */
  dice: ThrownDie[]
  /** What the active dice count for, added up, the term's sign left out. */
  total: number
  /** A die was rerolled or exploded, which at the table Foundry throws, not the player. */
  rethrown: boolean
}

/** The most dice a term throws here, rerolls and explosions among them. */
export const MOST_THROWN = 100

/** How a formula's modifiers are split into commands, as Foundry splits them, lower-case only. */
const COMMANDS = /([a-z]+)([^a-z\s()+\-*/]+)?/g

/** The comparisons Foundry makes; any other matches nothing, so isn't read. */
const COMPARISONS = new Set(['=', '==', '<', '<=', '>', '>='])

/**
 * A die's modifiers, as written after its faces, split as Foundry splits them: none where any of
 * it isn't a command Foundry splits out, such as an upper-case X.
 */
export function splitModifiers(text: string): string[] | undefined {
  const split = [...text.matchAll(COMMANDS)].map(([command]) => command)
  return split.join('') === text ? split : undefined
}

/**
 * A modifier of a die with so many faces, read as Foundry v14 reads it: such as "r<=2", "x", "kh3",
 * "min3" or "cs>=5". None for one the app doesn't work out here: any other command, a reroll or an
 * explosion that never ends, as every face would match, keeping or dropping none, a minimum or
 * maximum without its number, or a count without its target.
 */
export function readModifier(
  text: string,
  faces: number,
): DieModifier | undefined {
  const [, command = '', rest = ''] = /^([a-z]+)(.*)$/.exec(text) ?? []
  switch (command) {
    case 'r':
    case 'rr':
    case 'x':
    case 'xo': {
      const match = /^(\d+)?([<>=]+)?(\d+)?$/.exec(rest)
      if (!match) return undefined
      const [, written, comparison, number] = match
      // A lone number is the target.
      const lone = written !== undefined && !number && !comparison
      const most = lone ? undefined : written
      const target = lone ? written : number
      if (comparison !== undefined && !COMPARISONS.has(comparison)) return
      const explode = command.startsWith('x')
      const read = {
        kind: explode ? ('explode' as const) : ('reroll' as const),
        recursive: command === 'rr' || command === 'x',
        ...(most !== undefined && { most: Number(most) }),
        comparison: (comparison === '=='
          ? '='
          : (comparison ?? '=')) as Comparison,
        // Bare, a reroll is of 1s and an explosion of the highest face.
        target: target === undefined ? (explode ? faces : 1) : Number(target),
      }
      // Every face matching, one done again and again never ends, and an explosion done once throws
      // every die twice: neither is read.
      const endless =
        (read.recursive || explode) &&
        Array.from({ length: faces }, (_, at) => at + 1).every(face =>
          compare(face, read.comparison, read.target),
        )
      return endless ? undefined : read
    }
    case 'k':
    case 'kh':
    case 'kl':
    case 'd':
    case 'dh':
    case 'dl': {
      // Foundry keeps or drops one for none, which no formula means.
      if (!/^\d*$/.test(rest) || /^0+$/.test(rest)) return
      const keep = command.startsWith('k')
      const direction = command[1] ?? (keep ? 'h' : 'l')
      return {
        kind: keep ? 'keep' : 'drop',
        highest: direction === 'h',
        count: rest === '' ? 1 : Number(rest),
      }
    }
    case 'min':
    case 'max': {
      if (!/^\d+$/.test(rest)) return
      const value = Math.min(Number(rest), faces)
      // Foundry counts every result at most 1 at the least.
      if (command === 'max' && value < 1) return
      return { kind: command, value }
    }
    case 'cs':
    case 'cf': {
      const match = /^([<>=]+)?(\d+)$/.exec(rest)
      if (!match) return
      const [, comparison = '=', target] = match
      if (!COMPARISONS.has(comparison)) return
      return {
        kind: 'count',
        success: command === 'cs',
        comparison: (comparison === '==' ? '=' : comparison) as Comparison,
        target: Number(target),
      }
    }
    default: {
      return undefined
    }
  }
}

/**
 * A term's dice thrown and worked out as Foundry v14 does: its first throw, then each of its
 * modifiers in the order written, rerolled and exploded dice thrown after the rest, in order, as
 * many as `more` gives, and no more than `MOST_THROWN` in all.
 * @param first - The first throw, one value each of its dice.
 * @param more - Throws so many more of its die, for a reroll or an explosion.
 */
export function throwTerm(
  term: Pick<ExtraDice, 'sides' | 'modifiers'>,
  first: number[],
  more: (count: number) => number[],
): ThrownTerm {
  const dice: ThrownDie[] = first.map(value => ({ value, active: true }))
  // Another die, thrown after the rest; none once there are as many as may be.
  const another = () => {
    if (dice.length >= MOST_THROWN) return
    const [value] = more(1)
    return value === undefined ? undefined : { value, active: true }
  }
  for (const text of term.modifiers ?? []) {
    const modifier = readModifier(text, term.sides)
    if (!modifier) continue
    switch (modifier.kind) {
      case 'reroll':
      case 'explode': {
        rethrow(dice, modifier, another)
        break
      }
      case 'keep':
      case 'drop': {
        keepOrDrop(dice, modifier.count, {
          keep: modifier.kind === 'keep',
          highest: modifier.highest,
        })
        break
      }
      case 'min': {
        for (const die of dice) {
          if (die.value < modifier.value) die.counts = modifier.value
        }
        break
      }
      case 'max': {
        for (const die of dice) {
          if (die.value > modifier.value) die.counts = modifier.value
        }
        break
      }
      case 'count': {
        for (const die of dice) {
          die.counts = compare(die.value, modifier.comparison, modifier.target)
            ? 1
            : 0
        }
        break
      }
    }
  }
  let total = 0
  for (const die of dice) {
    if (die.active) total += die.counts ?? die.value
  }
  return {
    dice,
    total,
    rethrown: dice.some(die => die.rerolled || die.exploded),
  }
}

/**
 * Reroll or explode dice that match, as Foundry's `Die#reroll` and `Die#explode` walk them: each
 * active die in turn, those thrown since among them, but where it's done once, only the first
 * throw's; up to the most it may.
 * @param another - Throws one more die; none where no more may be thrown, which stops it there.
 */
function rethrow(
  dice: ThrownDie[],
  modifier: Extract<DieModifier, { kind: 'reroll' | 'explode' }>,
  another: () => ThrownDie | undefined,
) {
  let most = modifier.most
  const initial = dice.length
  let checked = 0
  while (checked < dice.length) {
    const die = dice[checked]
    checked++
    if (die.active) {
      if (most !== undefined && most <= 0) break
      if (compare(die.value, modifier.comparison, modifier.target)) {
        const next = another()
        if (!next) break
        if (modifier.kind === 'reroll') {
          die.rerolled = true
          die.active = false
        } else {
          die.exploded = true
        }
        dice.push(next)
        if (most !== undefined) most -= 1
      }
    }
    if (!modifier.recursive && checked === initial) break
  }
}

/**
 * Keep or drop so many of the active dice, highest or lowest, as Foundry's `_keepOrDrop` does:
 * those beyond the cut first, then ties with it, in order, until enough are gone. Dropping more
 * than there are drops none, as there.
 */
function keepOrDrop(
  dice: ThrownDie[],
  count: number,
  { keep, highest }: { keep: boolean; highest: boolean },
) {
  const ascending = keep === highest
  const values = dice
    .filter(die => die.active)
    .map(die => die.value)
    .toSorted((a, b) => (ascending ? a - b : b - a))
  const number = Math.min(
    Math.max(keep ? values.length - count : count, 0),
    values.length,
  )
  const cut = values[number]
  let discarded = 0
  const ties: ThrownDie[] = []
  for (const die of dice) {
    if (!die.active) continue
    const beyond =
      cut !== undefined && (ascending ? die.value < cut : die.value > cut)
    if (beyond) {
      die.discarded = true
      die.active = false
      discarded++
    } else if (die.value === cut) {
      ties.push(die)
    }
  }
  for (const die of ties) {
    if (discarded >= number) break
    die.discarded = true
    die.active = false
    discarded++
  }
}

/** Does a result match a target, as Foundry compares them? */
function compare(value: number, comparison: Comparison, target: number) {
  switch (comparison) {
    case '=': {
      return value === target
    }
    case '<': {
      return value < target
    }
    case '<=': {
      return value <= target
    }
    case '>': {
      return value > target
    }
    case '>=': {
      return value >= target
    }
  }
}

/**
 * The commands Foundry v14's `Die` has, the longest first, as it splits a compound one such as "kx"
 * into those it starts with.
 */
const FOUNDRY_COMMANDS = [
  'even',
  'min',
  'max',
  'odd',
  'rr',
  'xo',
  'kh',
  'kl',
  'dh',
  'dl',
  'cs',
  'cf',
  'df',
  'sf',
  'ms',
  'r',
  'x',
  'k',
  'd',
]

/**
 * What Foundry v14 does with a die's modifiers, as written after its faces, in order: each command
 * with what it's given, as it splits them, whatever their case, a compound one such as "kx" into
 * the commands it starts with, each bare. Any other is nothing.
 */
function foundryCommands(
  written: string,
): { command: string; modifier: string }[] {
  const commands: { command: string; modifier: string }[] = []
  for (const [modifier, letters] of written.matchAll(
    /([A-Za-z]+)([^A-Za-z\s()+\-*/]+)?/g,
  )) {
    let command = letters.toLowerCase()
    if (FOUNDRY_COMMANDS.includes(command)) {
      commands.push({ command, modifier })
      continue
    }
    let prefix = FOUNDRY_COMMANDS.find(each => command.startsWith(each))
    while (prefix) {
      commands.push({ command: prefix, modifier: prefix })
      command = command.slice(prefix.length)
      prefix = FOUNDRY_COMMANDS.find(each => command.startsWith(each))
    }
  }
  return commands
}

/**
 * Can't a die of so many faces, with these modifiers as written, be thrown at its highest, as the
 * game refuses, as Foundry v14 reads them: one that explodes, whatever on, or is rerolled on its
 * highest face, unless none may be?
 */
function dieUnmaximizable(faces: number, written: string): boolean {
  return foundryCommands(written).some(({ command, modifier }) => {
    if (command === 'x' || command === 'xo') return true
    if (command !== 'r' && command !== 'rr') return false
    const match = /rr?(\d+)?([<>=]+)?(\d+)?/i.exec(modifier)
    if (!match) return false
    const [, written, comparison, number] = match
    // A lone number is the target.
    const lone = written !== undefined && !number && !comparison
    if (!lone && written !== undefined && Number(written) === 0) return false
    const target = Number((lone ? written : number) ?? 1)
    switch (comparison ?? '=') {
      case '=':
      case '==': {
        return faces === target
      }
      case '<': {
        return faces < target
      }
      case '<=': {
        return faces <= target
      }
      case '>': {
        return faces > target
      }
      case '>=': {
        return faces >= target
      }
      default: {
        return false
      }
    }
  })
}

/**
 * Can't a die with these modifiers be thrown at its highest, as the game refuses: one that
 * explodes, or is rerolled on its highest face, whose highest the game can't say?
 */
export function unmaximizableDie({
  sides,
  modifiers = [],
}: Pick<ExtraDice, 'sides' | 'modifiers'>): boolean {
  return dieUnmaximizable(sides, modifiers.join(''))
}

/**
 * Can't a formula be thrown at its highest, as the game refuses, reading it as Foundry does, its
 * flavors left out: where any of its dice, within brackets or a function's arguments too, explodes,
 * or is rerolled on its highest face (`unmaximizableDie`)? A formula the app can't read is read so
 * too, as the game rolls it.
 */
export function formulaUnmaximizable(formula: string): boolean {
  const text = formula.replaceAll(/\[[^\]]*\]/g, '')
  return [...text.matchAll(/\d*[dD](\d+)([^\s(){}[\]+\-*/,]*)/g)].some(
    ([, faces, written]) => dieUnmaximizable(Number(faces), written),
  )
}
