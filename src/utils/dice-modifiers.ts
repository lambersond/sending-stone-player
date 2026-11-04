import type {
  ExtraDice,
  DieModifier,
  Comparison,
  ThrownTerm,
  ThrownDie,
} from '@/types/roll'
/*
 * What Foundry does with a term's dice once they're thrown, as a sheet's formula may say after its
 * faces, such as Great Weapon Fighting's 2d6r<=2 or 4d6kh3: reroll some, explode some, keep or drop
 * some, count each at least or at most so much, or count successes or failures. Each is read and
 * worked out here as Foundry v14's `Die` does it, so that the app's total of a roll made here is
 * the game's. At the table the player's dice are each die's first throw only: Foundry throws the
 * dice it rerolls or explodes itself, so the game's total stands once it says.
 */

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
      return readRethrow(command, rest, faces)
    }
    case 'k':
    case 'kh':
    case 'kl':
    case 'd':
    case 'dh':
    case 'dl': {
      return readKeepOrDrop(command, rest)
    }
    case 'min':
    case 'max': {
      return readLimit(command, rest, faces)
    }
    case 'cs':
    case 'cf': {
      return readCount(command, rest)
    }
    default: {
      return undefined
    }
  }
}

/**
 * A reroll or an explosion, as written after its command, such as "<=2" of "r<=2": a lone number is
 * the target, else the most rerolled or exploded and then the target. None where it doesn't read,
 * or compares in a way Foundry doesn't.
 */
function readRethrow(
  command: 'r' | 'rr' | 'x' | 'xo',
  rest: string,
  faces: number,
): Extract<DieModifier, { kind: 'reroll' | 'explode' }> | undefined {
  const match = /^(\d+)?([<>=]+)?(\d+)?$/.exec(rest)
  if (!match) return undefined
  const [, written, comparison, number] = match
  // A lone number is the target.
  const lone = written !== undefined && !number && !comparison
  const most = lone ? undefined : written
  const target = lone ? written : number
  if (comparison !== undefined && !COMPARISONS.has(comparison)) return
  return rethrowOf(command, { most, comparison, target }, faces)
}

/**
 * A reroll or an explosion read: bare, a reroll is of 1s and an explosion of the highest face. None
 * where every face matches, as one done again and again never ends, and an explosion done once
 * throws every die twice.
 */
function rethrowOf(
  command: 'r' | 'rr' | 'x' | 'xo',
  written: { most?: string; comparison?: string; target?: string },
  faces: number,
): Extract<DieModifier, { kind: 'reroll' | 'explode' }> | undefined {
  const { most, comparison, target } = written
  const explode = command.startsWith('x')
  const read = {
    kind: explode ? ('explode' as const) : ('reroll' as const),
    recursive: command === 'rr' || command === 'x',
    ...(most !== undefined && { most: Number(most) }),
    comparison: (comparison === '==' ? '=' : (comparison ?? '=')) as Comparison,
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

/** Keeping or dropping so many, as written after its command, such as "3" of "kh3": one bare. */
function readKeepOrDrop(
  command: 'k' | 'kh' | 'kl' | 'd' | 'dh' | 'dl',
  rest: string,
): Extract<DieModifier, { kind: 'keep' | 'drop' }> | undefined {
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

/** Each result counted at least or at most so much, as written after `min` or `max`. */
function readLimit(
  command: 'min' | 'max',
  rest: string,
  faces: number,
): Extract<DieModifier, { kind: 'min' | 'max' }> | undefined {
  if (!/^\d+$/.test(rest)) return
  const value = Math.min(Number(rest), faces)
  // Foundry counts every result at most 1 at the least.
  if (command === 'max' && value < 1) return
  return { kind: command, value }
}

/** Successes or failures counted, as written after `cs` or `cf`, such as ">=5". */
function readCount(
  command: 'cs' | 'cf',
  rest: string,
): Extract<DieModifier, { kind: 'count' }> | undefined {
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
    apply(dice, modifier, another)
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
 * A modifier worked out on a term's dice, as Foundry v14 does: rerolled or exploded, kept or
 * dropped, each counted at least or at most so much, or counted as a success or a failure.
 * @param another - Throws one more die; none where no more may be thrown.
 */
function apply(
  dice: ThrownDie[],
  modifier: DieModifier,
  another: () => ThrownDie | undefined,
) {
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
      countMatches(dice, modifier)
      break
    }
  }
}

/** Count each die 1 where it matches, else 0: a success (`cs`) or a failure (`cf`). */
function countMatches(
  dice: ThrownDie[],
  modifier: Extract<DieModifier, { kind: 'count' }>,
) {
  for (const die of dice) {
    die.counts = compare(die.value, modifier.comparison, modifier.target)
      ? 1
      : 0
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
    const done = rethrowDie(dice, die, { modifier, most }, another)
    if (done === 'stop') break
    if (done === 'thrown' && most !== undefined) most -= 1
    if (!modifier.recursive && checked === initial) break
  }
}

/**
 * One die walked, as `rethrow` walks them: rerolled or exploded where it's active and matches, its
 * next throw after the rest (`thrown`); else left (`left`). It stops there (`stop`) where no more
 * may be rerolled or exploded, as many as `most` already have, or no more may be thrown.
 */
function rethrowDie(
  dice: ThrownDie[],
  die: ThrownDie,
  {
    modifier,
    most,
  }: {
    modifier: Extract<DieModifier, { kind: 'reroll' | 'explode' }>
    most: number | undefined
  },
  another: () => ThrownDie | undefined,
): 'thrown' | 'left' | 'stop' {
  if (!die.active) return 'left'
  if (most !== undefined && most <= 0) return 'stop'
  if (!compare(die.value, modifier.comparison, modifier.target)) return 'left'
  const next = another()
  if (!next) return 'stop'
  if (modifier.kind === 'reroll') {
    die.rerolled = true
    die.active = false
  } else {
    die.exploded = true
  }
  dice.push(next)
  return 'thrown'
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
