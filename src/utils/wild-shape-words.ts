import { crWords } from '@/utils/creature-words'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import { articled, hoursWords } from '@/utils/wild-shape'
import type { WildShapeOp } from '@/constants/sending-stone'
import type {
  KnownForm,
  SheetForm,
  SheetSpellSection,
  SheetWildShape,
  WildShapeEnded,
} from '@/types/sending-stone'

// How Wild Shape from the app (module 0.40.0) is told, in English: on the ribbon, the Wild Shape
// row, the form picker and the Known forms manager, the shaped sheet's marks and notes, the tray
// and its toasts, the banner when the game ends it, and why the game didn't make one. Every one
// names the character, never a pronoun, and puts "a" or "an" before a form by its first letter.

/** Temporary hit points in words: "5 temporary hit points", "1 temporary hit point". */
export function tempWords(temp: number): string {
  return temp === 1 ? '1 temporary hit point' : `${temp} temporary hit points`
}

/** Temporary hit points that last, the verb agreeing: "5 temporary hit points stay". */
export function tempStayWords(temp: number): string {
  return `${tempWords(temp)} ${temp === 1 ? 'stays' : 'stay'}`
}

/** A sentence's first letter in capitals, as "your Gamemaster’s game" starting one. */
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The header's line, the ribbon's heading: "In Wild Shape · Wolf", "Transformed · Giant Ape". */
export function headerLineOf(form: Pick<SheetForm, 'kind' | 'name'>): string {
  return form.kind === 'wildShape'
    ? `In Wild Shape · ${form.name}`
    : `Transformed · ${form.name}`
}

/** What the creature switcher's own tab adds to its name: ", in Wild Shape as a Wolf". */
export function switcherWords(form: Pick<SheetForm, 'kind' | 'name'>): string {
  return form.kind === 'wildShape'
    ? `, in Wild Shape as ${articled(form.name)}`
    : `, transformed into ${articled(form.name)}`
}

/** The ribbon's name and its heading: "Wild Shape · Wolf", or "Transformed · Giant Ape". */
export function ribbonWords(form: Pick<SheetForm, 'kind' | 'name'>): {
  label: string
  heading: string
} {
  const label = form.kind === 'wildShape' ? 'Wild Shape' : 'Transformed'
  return { label, heading: `${label} · ${form.name}` }
}

/** The ribbon's line where no Return is offered and the module doesn't time the form. */
export const ENDS_IN_FOUNDRY = 'It ends in Foundry.'

/** The ribbon's line where the module times the form, but the game isn't taking Wild Shape now. */
export function notTakingWords(role: SeatRole): string {
  return `${capitalized(seatWords(role).game)} isn’t taking Wild Shape now.`
}

/** The line under the shaped sheet's heading: "Medium · CR 1/4 · Darkvision 60 ft". */
export function formLineOf(
  form: Pick<SheetForm, 'size' | 'cr'>,
  senses: string[],
): string {
  const cr = crWords(form.cr)
  return [
    form.size,
    cr === undefined ? undefined : `CR ${cr}`,
    senses.length > 0 ? senses.join(', ') : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The Abilities legend while shaped: "The Wolf’s; the rest are Elowen’s." */
export function legendWords(form: string, name: string): string {
  return `The ${form}’s; the rest are ${name}’s.`
}

/** The Skills note while shaped. */
export function skillsNoteWords(form: string, name: string): string {
  return `Each skill uses ${name}’s bonus or the ${form}’s, whichever is higher.`
}

/** The Actions tab's note while shaped: her gear, the form's limbs, and concentration. */
export function actionsNoteWords(form: string, name: string): string {
  const a = articled(form)
  return `${name}’s gear isn’t on this sheet. In the game it falls, merges into the ${form}, or is worn where your Gamemaster says ${a} can wear it; what ${a} can hold depends on its shape. A spell ${name} is concentrating on goes on.`
}

/** A spell level as an ordinal: "1st", "2nd", "3rd", "4th", "11th". */
function ordinal(level: number): string {
  const teen = level % 100 >= 11 && level % 100 <= 13
  const suffix = teen
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th')
  return `${level}${suffix}`
}

/**
 * The Spells tab's callout while shaped: the slots that wait, each pool "4 of 4 1st level"; or,
 * for a druid of the Circle of the Moon, that only that circle's spells are cast as the form.
 */
export function spellsNoteWords(
  form: string,
  name: string,
  spells: SheetSpellSection[],
  moon: boolean,
): string {
  const a = articled(form)
  if (moon) return `As ${a}, ${name} can cast only Circle of the Moon spells.`
  // Each pool by the level its slots cast at, or where the sheet doesn't say, by its section.
  const pools = spells.flatMap(({ label, slots }) => {
    if (!slots || slots.max <= 0) return []
    const level =
      typeof slots.level === 'number' && slots.level > 0
        ? `${ordinal(slots.level)} level`
        : label
    return [`${slots.value} of ${slots.max} ${level}`]
  })
  const wait =
    pools.length > 0 ? ` The spell slots wait: ${pools.join(', ')}.` : ''
  return `${name} can’t cast spells as ${a}.${wait}`
}

/** The Inventory tab's line while shaped. */
export function inventoryNoteWords(name: string): string {
  return `${name}’s own gear is back on this tab when Wild Shape ends.`
}

/** The Effects tab's line while shaped, where the game takes effects from here. */
export function effectsNoteWords(form: string, name: string): string {
  return `Effects are changed from here again once ${name} is no longer ${articled(form)}.`
}

/** The Wild Shape row's small lines, by its state (round 0.40.0 §5.7). */
export const ROW_WORDS = {
  ready: (hours: number) =>
    `Change into a known Beast form for ${hoursWords(hours)}.`,
  spent: (resurgence: boolean) =>
    `No uses left. You regain one on a Short Rest, and all on a Long Rest.${resurgence ? ' Or spend a spell slot with Wild Resurgence.' : ''}`,
  incapacitated: (name: string) =>
    `${name} can’t use Wild Shape while Incapacitated.`,
  shaped: (name: string, form: string) =>
    `${name} is ${articled(form)}. Returning takes a Bonus Action.`,
  other: (name: string, form: string) =>
    `${name} is ${articled(form)}. That form ends in Foundry.`,
}

/** The highest CR and the fly limit, as the picker and the manager say them. */
function limitWords({ cr, fly }: SheetWildShape['limits']): string {
  return `up to CR ${crWords(cr) ?? cr}${fly ? '' : ', none with a Fly Speed'}`
}

/**
 * Features' line for the Wild Shape row: "Bonus Action. 6 known forms, up to CR 1/2, none with a
 * Fly Speed. Lasts 2 hours. Elowen gains 5 temporary hit points." and the Moon's AC floor.
 */
export function aboutWords(block: SheetWildShape, name: string): string {
  const { limits } = block
  const floor = block.acFloor === null ? '' : ` AC at least ${block.acFloor}.`
  return `Bonus Action. ${limits.count} known forms, ${limitWords(limits)}. Lasts ${hoursWords(block.hours)}. ${name} gains ${tempWords(block.temp)}.${floor}`
}

/** The picker's chips, what a change gives and keeps, in order. */
export function chipWords(block: SheetWildShape): string[] {
  return [
    'Bonus Action',
    hoursWords(block.hours),
    `+${tempWords(block.temp)}`,
    ...(block.acFloor === null ? [] : [`AC at least ${block.acFloor}`]),
    'Keeps hit points, Int, Wis, Cha and features',
    block.circle === 'moon'
      ? 'Circle of the Moon spells only'
      : 'No spellcasting',
  ]
}

/** Why a known form can't be taken from here, as its badge says; none where it can. */
export function badgeOf(known: KnownForm): string | undefined {
  if (!known.pool) return 'Not from your Gamemaster’s compendiums'
  if (known.found === false) return 'Not found in Foundry'
  if (known.fits !== true) return 'Outside the rules'
  return undefined
}

/** A known form's badge, as its card's accessible name ends: ", outside the rules". */
export function badgeName(badge: string): string {
  return `, ${badge.charAt(0).toLowerCase()}${badge.slice(1)}`
}

/** The small line under a known form that can't be taken from here. */
export const ONLY_IN_FOUNDRY = 'Only in Foundry.'

/** A form's size and CR: "Medium · CR 1/4"; what it has of either. */
export function sizeCrWords(size?: string | null, cr?: number | null): string {
  const shown = cr === undefined ? undefined : crWords(cr)
  return [size, shown === undefined ? undefined : `CR ${shown}`]
    .filter(Boolean)
    .join(' · ')
}

/** A known form's attack: "Bite +4 · 1d6 + 2". */
export function attackWords(attack: NonNullable<KnownForm['attack']>): string {
  const hit =
    attack.toHit === null
      ? ''
      : ` ${attack.toHit >= 0 ? '+' : '−'}${Math.abs(attack.toHit)}`
  return `${attack.name}${hit}${attack.damage ? ` · ${attack.damage}` : ''}`
}

/** Under the picker's list: "6 of 6 known forms". */
export function knownCountWords(known: number, count: number): string {
  return `${known} of ${count} known forms`
}

/** The picker's footer note: "2 of 2 uses left · this uses one". */
export function usesNoteWords(uses: SheetWildShape['uses']): string {
  return `${uses.value} of ${uses.max} uses left · this uses one`
}

/** The picker's footer where no card is offered. */
export const NONE_OFFERED = 'No other known form can be taken from here.'

/** The picker's body where the druid knows no forms. */
export function noFormsWords(name: string): string {
  return `${name} knows no forms yet.`
}

/** The manager's line: "Elowen knows 4 of 6 forms: Beasts up to CR 1/2, none with a Fly Speed." */
export function managerLineWords(block: SheetWildShape, name: string): string {
  return `${name} knows ${block.known.length} of ${block.limits.count} forms: Beasts ${limitWords(block.limits)}.`
}

/** The manager's line about the replacement after a Long Rest; none while there's room. */
export function swapWords(
  block: SheetWildShape,
  name: string,
): string | undefined {
  if (block.swap) {
    return `${name} may replace one known form, after the last Long Rest.`
  }
  if (block.known.length >= block.limits.count) {
    return `${name} may replace one known form after each Long Rest.`
  }
  return undefined
}

/** "Beast", or "Beasts" for any but one. */
function beastNoun(count: number): string {
  return count === 1 ? 'Beast' : 'Beasts'
}

/** Learn a form's count: "9 Beasts", "3 of 9 Beasts" while filtered, ", and more in Foundry". */
export function beastCountWords(
  shown: number,
  total: number,
  more: boolean,
): string {
  const count =
    shown === total
      ? `${total} ${beastNoun(total)}`
      : `${shown} of ${total} ${beastNoun(total)}`
  return `${count}${more ? ', and more in Foundry' : ''}`
}

/** Learn a form's button: "Learn a Wolf", "Learn a Wolf in place of a Panther". */
export function learnWords(form: string, old?: string): string {
  return `Learn ${articled(form)}${old ? ` in place of ${articled(old)}` : ''}`
}

/** Why the game couldn't list the Beasts to learn. */
export function listFailedWords(role: SeatRole, reason: string): string {
  return `${capitalized(seatWords(role).game)} couldn’t list the Beasts: ${reason}.`
}

/** The reasons a picker's refusal asks to try again after, as the game may take it then. */
const TRY_AGAIN = new Set([
  'unavailable',
  'off',
  'timeout',
  'expired',
  'lost',
  'network',
])

/** The picker's refusal: "Elowen didn’t change: … Try again in a moment." */
export function changeRefusedWords(
  name: string,
  key: string,
  reason?: string,
): string {
  const why = reason ? `: ${reason}` : ''
  return `${name} didn’t change${why}.${TRY_AGAIN.has(key) ? ' Try again in a moment.' : ''}`
}

/** The manager's refusal: "Elowen didn’t learn it: …". */
export function learnRefusedWords(name: string, reason?: string): string {
  return `${name} didn’t learn it${reason ? `: ${reason}` : ''}.`
}

/** Return's popover: its title, its body, and its buttons. */
export function returnWords(
  name: string,
  form: string,
  temp: number,
): { title: string; body: string[]; stay: string; confirm: string } {
  return {
    title: `Return to ${name}?`,
    body: [
      'Wild Shape ends. It takes a Bonus Action.',
      ...(temp > 0 ? [`${name} keeps ${tempWords(temp)}.`] : []),
    ],
    stay: `Stay ${articled(form)}`,
    confirm: 'Return',
  }
}

/** The banner's words when the game ends a Wild Shape: none for one ended from here. */
export function endedWords(
  ended: WildShapeEnded,
  name: string,
  hours: number,
): string | undefined {
  const first = {
    app: undefined,
    time: `Wild Shape ended in your game: its ${hours === 1 ? 'hour' : hoursWords(hours)} ran out.`,
    hp: 'Wild Shape ended in your game at 0 hit points.',
    incapacitated: `Wild Shape ended in your game: ${name} became Incapacitated.`,
    foundry: 'Wild Shape was ended in Foundry.',
  }[ended.why]
  return first && `${first} ${name} is no longer ${articled(ended.form)}.`
}

/** What a Wild Shape command logged here asked: its op, and of which form or Beast. */
export type WildShapeLogged = {
  op: Exclude<WildShapeOp, 'forms'>
  /** The form taken or left, or the Beast learned, by name. */
  form?: string
  /** The known form a Beast learned replaces, by name. */
  old?: string
  /** The character's name, which its toast names. */
  character: string
  /** For a return, the temporary hit points the character has, which stay. */
  temp?: number
}

/** A Wild Shape command's line in the tray: on its way, made, and not made (round 0.40.0 §5.10). */
export const WILD_SHAPE_WORDS: Record<
  WildShapeLogged['op'],
  {
    doing: (logged: WildShapeLogged) => string
    done: (logged: WildShapeLogged) => string
    not: string
    short: string
  }
> = {
  transform: {
    doing: ({ form = '' }) => `Changing into ${articled(form)}`,
    done: ({ form = '' }) => `Became ${articled(form)}`,
    not: 'Didn’t change',
    short: 'changed',
  },
  revert: {
    doing: ({ character }) => `Returning to ${character}`,
    done: ({ form = '' }) => `No longer ${articled(form)}`,
    not: 'Didn’t return',
    short: 'returned',
  },
  learn: {
    doing: ({ form = '' }) => `Learning ${articled(form)}`,
    done: ({ form = '' }) => `Learned ${articled(form)}`,
    not: 'Not learned',
    short: 'learned',
  },
}

/**
 * A Wild Shape command's toast once made: its title, and the line under it, as the game says what
 * it gave: "Elowen is a Wolf" / "5 temporary hit points · 2 hours"; "Elowen is no longer a Wolf" /
 * "5 temporary hit points stay" where she has some; "Elowen knows a Wolf in place of a Panther".
 */
export function wildShapeToast(
  logged: WildShapeLogged,
  made?: { temp?: number; hours?: number },
): { title: string; line?: string } {
  const a = articled(logged.form ?? '')
  switch (logged.op) {
    case 'transform': {
      const line =
        made?.temp !== undefined && made.hours !== undefined
          ? `${tempWords(made.temp)} · ${hoursWords(made.hours)}`
          : undefined
      return { title: `${logged.character} is ${a}`, line }
    }
    case 'revert': {
      const temp = logged.temp ?? 0
      return {
        title: `${logged.character} is no longer ${a}`,
        line: temp > 0 ? tempStayWords(temp) : undefined,
      }
    }
    case 'learn': {
      const old = logged.old ? ` in place of ${articled(logged.old)}` : ''
      return { title: `${logged.character} knows ${a}${old}` }
    }
  }
}

/**
 * Why a Wild Shape command wasn't made, as the seat reads it, where it differs from a roll's
 * (round 0.40.0 §5.10): for a Beast learned, `form` says the Beast can't be learned.
 */
export function wildShapeReasons(
  role: SeatRole,
  op?: WildShapeOp,
): Record<string, string> {
  const { game } = seatWords(role)
  return {
    off: `${game} isn’t taking Wild Shape now`,
    unavailable: `${game} isn’t taking Wild Shape now`,
    form:
      op === 'learn'
        ? 'that Beast can’t be learned now'
        : 'that form can’t be taken now',
    full: 'every place for a known form is taken',
    swap: 'a known form is replaced only after a Long Rest',
    consume: 'no uses of Wild Shape are left',
    incapacitated: 'an Incapacitated character can’t use Wild Shape',
    'not-shaped': 'your character isn’t in Wild Shape any more',
    transformed: 'that form ends in Foundry',
    shaped: 'the form your character is in now can’t be replaced',
    moving: 'it’s on its way already',
  }
}
