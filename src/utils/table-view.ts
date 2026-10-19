import { ABILITIES, DAMAGE_TYPE_LABELS, SKILLS } from '@/constants/dnd5e'
import {
  checkName,
  checkTitle,
  MAX_CHECKS,
  toolOrSkillName,
  type CheckOption,
} from '@/utils/description-links'
import type {
  AskedCheck,
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  Dnd5eCheck,
  Dnd5eSave,
  Dnd5eTarget,
  MessageAsk,
  RollSummary,
  SerializedMessage,
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type {
  DamagePool,
  Side,
  TableAction,
  TableAsk,
  TableCheckAsk,
  TableCombat,
  TableDamage,
  TableDamageKind,
  TableMessage,
  TableRoll,
  TableSheet,
  TableTarget,
} from '@/types/table'

/**
 * Who is looking: their character's actor id, if chosen, and the party's actor ids, with the
 * party's portraits by actor id.
 */
export type Viewer = {
  actorId: string | undefined
  party: Set<string>
  portraits?: Map<string, string>
}

function sideOf(
  viewer: Viewer,
  actorId: string | null,
  playerOwned = false,
): Side {
  if (actorId && actorId === viewer.actorId) return 'me'
  if ((actorId && viewer.party.has(actorId)) || playerOwned) return 'party'
  return 'other'
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

/**
 * A player's view of chat messages, oldest first. Damage rolled from an attack's card names no
 * targets of its own, so it is shown against the attack's. Each card's targets say whether they
 * saved, from module 0.29.0, as the latest of their saves rolled from it that the viewer may see
 * the outcome of says (`savesByCard`).
 * @param byGm - The messages this app knows were made for the Gamemaster's rolls as a character,
 *   by their ids: as stored, never as a message says of itself.
 */
export function toTableMessages(
  messages: SerializedMessage[],
  viewer: Viewer,
  byGm: ReadonlySet<string> = new Set(),
): TableMessage[] {
  const byId = new Map(messages.map(message => [message.id, message]))
  const saves = savesByCard(messages, viewer)
  return messages.map(message => {
    const from = message.dnd5e?.originatingMessage
    const card = from ? byId.get(from) : undefined
    return toTableMessage(
      message,
      viewer,
      { card, saves: saves.get(message.id) },
      byGm.has(message.id),
    )
  })
}

/** What a message's targets are shown with, from the rest of the chat. */
export type LinkedMessages = {
  /** The card it was rolled from, if it's in the chat. */
  card?: SerializedMessage
  /** The saves rolled from it, as `savesByCard` has them: by their creature's actor's uuid. */
  saves?: ReadonlyMap<string, SaveOutcome>
}

/**
 * @param linked - The card it was rolled from, and the saves rolled from it, where they're in the
 *   chat; none, as for a message alone.
 * @param byGm - Whether this app knows the message was made for the Gamemaster's roll as a
 *   character, from its own record of it; the message's own `gmRoll` is only a claim.
 */
export function toTableMessage(
  message: SerializedMessage,
  viewer: Viewer,
  linked: LinkedMessages = {},
  byGm = false,
): TableMessage {
  // What the message is and does is read from all of its rolls, its damage too.
  const all = message.rolls.map(roll => toTableRoll(roll))
  const isCard = all.length === 0 && isUsage(message)
  let kind: TableMessage['kind'] = 'text'
  if (all.length > 0) kind = 'roll'
  else if (isCard) kind = 'card'
  const action = combatAction(message, all)
  // A roll request card stays text, for pages that don't read its ask, but never its own text,
  // which may hold a DC players may not see.
  const ask = kind === 'text' ? askOf(message) : undefined
  let text = kind === 'text' ? message.text.trim() || undefined : undefined
  if (ask) text = askTitle({ ...ask, dc: undefined })

  // Its damage rolls fold into damage cards, as dnd5e's card adds them up; every other roll keeps
  // a card of its own, so damage's dice aren't sent twice.
  const marks = message.rolls.map(roll => rollMarks(roll))
  const damaged = marks.map(mark => isDamageRoll(mark))
  const rolls = all.filter((_, index) => !damaged[index])
  const attackRoll = attackOf(
    message,
    marks.filter((_, index) => !damaged[index]),
  )
  const damage = damageOf(
    message,
    all.flatMap((roll, index) =>
      damaged[index] ? [{ roll, marks: marks[index] }] : [],
    ),
  )

  const speaker = speakerOf(message)
  const targets = targetsOf(
    message,
    viewer,
    attackRoll ? rolls[attackRoll.index] : undefined,
    linked,
  )
  const summary = summaryOf(targets)

  return {
    id: message.id,
    sentAt: new Date(message.timestamp).toISOString(),
    speaker,
    side: sideOf(viewer, message.character),
    avatar: viewer.portraits?.get(
      message.character ?? message.speaker.actorId ?? '',
    ),
    whisper: !message.audience.public,
    kind,
    label: messageLabel(message, damage !== undefined),
    action,
    // A roll's or card's content is its rendering; their details are shown instead.
    text,
    rolls,
    ...(attackRoll && { attackRoll }),
    ...(damage && { damage }),
    targets,
    ...(summary && { summary }),
    ...(ask && { ask }),
    ...(byGm && { byGm: true as const }),
  }
}

/**
 * The saving throw or check a roll request card asks the table for: as the module says, from 0.17.0
 * for a saving throw and 0.18.0 for a check; or, from an older module, which doesn't, as a
 * Gamemaster's card's own buttons say, without its DC, which players may not be meant to see.
 */
function askOf(message: SerializedMessage): TableAsk | undefined {
  if (message.ask !== undefined) return tableAsk(message.ask)
  return requestCardAsk(message)
}

/**
 * The module's ask, as stored. Checked when it was received, but checked again here, as one stored
 * before then may not have been: its abilities only dnd5e's own, its skills and tools only keys,
 * its DC a number, and what asks a name. A check any of whose ways doesn't hold up isn't read at
 * all, rather than read as asking for less than it does.
 */
function tableAsk(ask: MessageAsk | null): TableAsk | undefined {
  if (!ask) return
  const { dc, label } = ask
  const told = {
    ...(Number.isInteger(dc) && { dc }),
    ...(typeof label === 'string' && label.trim() && { label: label.trim() }),
  }
  if (ask.type === 'check') {
    const listed = Array.isArray(ask.checks) ? ask.checks : []
    const checks = listed.flatMap(each => {
      const check = askedCheck(each)
      return check ? [check] : []
    })
    const whole =
      checks.length > 0 &&
      checks.length === listed.length &&
      checks.length <= MAX_CHECKS
    return whole ? { type: 'check', checks, ...told } : undefined
  }
  if (ask.type !== 'save' && ask.type !== 'concentration') return
  const abilities = Array.isArray(ask.abilities)
    ? ask.abilities.filter(id => isAbility(id))
    : []
  if (ask.type === 'save' && abilities.length === 0) return
  return { type: ask.type, abilities, ...told }
}

/** The kinds of check a card asks for, as dnd5e's buttons name them. */
const CHECK_TYPES = new Set<unknown>(['check', 'skill', 'tool'])

/** A skill's or tool's key, as dnd5e's are. */
const CHECK_KEY = /^[A-Za-z][\w-]{0,31}$/

/**
 * One way a check may be made, as an ask or a card's button has it, if it holds up: an ability
 * check by one of dnd5e's abilities, a skill check by its skill's key, a tool check by its tool's,
 * with the tool's name where it says one.
 */
function askedCheck(
  check: Partial<Record<keyof AskedCheck, unknown>>,
): AskedCheck | undefined {
  const { type, ability, skill, tool, name } = check
  if (!CHECK_TYPES.has(type) || !isAbility(ability)) return
  const key = type === 'skill' ? skill : tool
  if (type !== 'check' && (typeof key !== 'string' || !CHECK_KEY.test(key))) {
    return
  }
  const named = type === 'tool' && typeof name === 'string' && name.trim()
  return {
    type: type as AskedCheck['type'],
    ability,
    ...(type === 'skill' && { skill: key as string }),
    ...(type === 'tool' && { tool: key as string }),
    ...(named && { name: named }),
  }
}

/**
 * The saving throw an older module's roll request card asks for, read from its buttons, as dnd5e
 * makes them: those that request a save, or a concentration check, by ability; or else those that
 * request a check, by ability and skill or tool. Only a card spoken by no character, as dnd5e
 * posts a Gamemaster's, is read so: the app isn't told who is a Gamemaster, and a card a player
 * wrote names its writer anyway. Never its DC.
 */
function requestCardAsk(message: SerializedMessage): TableAsk | undefined {
  const { content } = message
  if (message.character || message.speaker.actorId) return
  if (typeof content !== 'string' || !content.includes('rollRequest')) return
  // A tag's attributes end at the next "<" too, as dnd5e's never hold one: read to the next ">"
  // alone, a run of unclosed tags would take each to the end of the text.
  const requests = [...content.matchAll(/<button\b([^<>]*)>/gi)]
    .map(([, attributes]) => dataOf(attributes))
    .filter(data => data.get('action') === 'rollRequest')
  const buttons = requests.filter(
    data => data.get('type') === 'save' || data.get('type') === 'concentration',
  )
  if (buttons.length === 0) return requestCardCheck(requests)
  const type = buttons[0].get('type') as 'save' | 'concentration'
  const abilities = buttons.flatMap(data => {
    const ability = data.get('ability')
    return data.get('type') === type && ability && isAbility(ability)
      ? [ability]
      : []
  })
  if (type === 'save' && abilities.length === 0) return
  return { type, abilities: [...new Set(abilities)] }
}

/**
 * The check an older module's roll request card asks for, from its buttons' data: each way it may
 * be made once, as dnd5e's card offers each once. One offering more than the most a check may
 * isn't read at all, as the module's ask for it isn't, rather than read as asking for less.
 */
function requestCardCheck(
  requests: Map<string, string>[],
): TableCheckAsk | undefined {
  const seen = new Set<string>()
  const checks = requests.flatMap(data => {
    const check = askedCheck({
      type: data.get('type'),
      ability: data.get('ability'),
      skill: data.get('skill'),
      tool: data.get('tool'),
    })
    const id =
      check && `${check.type}:${check.skill ?? check.tool ?? check.ability}`
    if (!check || !id || seen.has(id)) return []
    seen.add(id)
    return [check]
  })
  if (checks.length === 0 || checks.length > MAX_CHECKS) return
  return { type: 'check', checks }
}

/**
 * An element's data attributes, by name without "data-", from its opening tag's attributes. Each
 * name and the space around its "=" are bounded, as dnd5e's are short: unbounded, a tag of
 * "data-data-data-…" would take each to the end of the tag, from every "data-" in it.
 */
function dataOf(attributes: string): Map<string, string> {
  return new Map(
    [
      ...attributes.matchAll(
        /\bdata-([\w-]{1,64})\s{0,8}=\s{0,8}(?:"([^"]*)"|'([^']*)')/g,
      ),
    ].map(([, name, double, single]) => [name, double ?? single ?? '']),
  )
}

/** Is this one of dnd5e's abilities' ids, and not a name any object answers to? */
function isAbility(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(ABILITIES, id)
}

/**
 * What a roll request card asks for, in words: such as "DC 15 Dexterity saving throw", "Strength
 * or Dexterity saving throw", or "DC 10 Concentration check", naming its ability where it isn't
 * Constitution; or a check, such as "DC 15 Strength (Athletics) check", or "Intelligence or Wisdom
 * check", a tool by the game's name for it where it says.
 */
export function askTitle(ask: TableAsk): string {
  if (ask.type === 'check') {
    const names = ask.checks.map(check =>
      checkName(checkOptionOf(check), check.name),
    )
    return checkTitle(names, { dc: ask.dc })
  }
  const dc = ask.dc === undefined ? '' : `DC ${ask.dc} `
  const names = ask.abilities
    .filter(id => isAbility(id))
    .map(id => ABILITIES[id])
  if (ask.type === 'concentration') {
    const [ability] = ask.abilities
    return ability && ability !== 'con' && names[0]
      ? `${dc}Concentration check (${names[0]})`
      : `${dc}Concentration check`
  }
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(names)
  return `${dc}${list} saving throw`
}

/** One way a check the table is asked for may be made, as a description's link has it. */
function checkOptionOf(check: AskedCheck): CheckOption {
  const key = check.type === 'skill' ? check.skill : check.tool
  return {
    type: check.type,
    ability: check.ability,
    ...(check.type !== 'check' && key !== undefined && { key }),
  }
}

const HEALING = new Set(['healing', 'temphp', 'maximum'])

/**
 * Whether damage the game rolled is healing: every roll of it one of dnd5e's kinds of healing, its
 * hit points, temporary ones or its maximum.
 */
export function healingRolls(
  rolls: readonly Pick<TableRoll, 'damageType'>[],
): boolean {
  return (
    rolls.length > 0 &&
    rolls.every(({ damageType }) => !!damageType && HEALING.has(damageType))
  )
}

/** Is this an attack, damage, healing or a spell, from what D&D Fifth Edition recorded? */
function combatAction(
  message: SerializedMessage,
  rolls: TableRoll[],
): TableAction | undefined {
  const dnd5e = message.dnd5e
  const spell = dnd5e?.item?.type === 'spell'
  switch (dnd5e?.roll?.type) {
    case 'attack': {
      return spell ? 'spell-attack' : 'attack'
    }
    case 'damage': {
      return healingRolls(rolls) ? 'healing' : 'damage'
    }
    case 'healing': {
      return 'healing'
    }
  }
  return spell && isUsage(message) ? 'spell' : undefined
}

/**
 * Is this an item or ability used, as its card? dnd5e 5.x moved what says so from its flags to the
 * message's own type, so a card it posts says so only there.
 */
function isUsage(message: SerializedMessage): boolean {
  return message.dnd5e?.messageType === 'usage' || message.type === 'usage'
}

/** What marks a roll, as the module sends it, each only where it holds up. */
type RollMarks = Pick<
  RollSummary,
  | 'class'
  | 'damage'
  | 'damageLabel'
  | 'section'
  | 'flavor'
  | 'attack'
  | 'damageType'
>

const SECTIONS = new Set<unknown>(['damage', 'bonus', 'other'])

/**
 * What marks a stored roll, each only where it holds up, and left out where it doesn't: a row is
 * checked when it arrives, but never again as it's read, and one stored before the app checked a
 * field holds whatever the module sent then.
 */
function rollMarks(roll: RollSummary): RollMarks {
  const sent = roll as Partial<Record<keyof RollMarks, unknown>>
  const damageLabel = textUpTo(sent.damageLabel, 64)
  const flavor = textUpTo(sent.flavor, 100)
  return {
    ...(typeof sent.class === 'string' && { class: sent.class }),
    ...(sent.damage === true && { damage: true as const }),
    ...(damageLabel && { damageLabel }),
    ...(SECTIONS.has(sent.section) && {
      section: sent.section as RollMarks['section'],
    }),
    ...(flavor && { flavor }),
    ...(sent.attack === true && { attack: true as const }),
    ...(typeof sent.damageType === 'string' && {
      damageType: sent.damageType,
    }),
  }
}

/** Some text, trimmed, if there is any and it's no longer than this. */
function textUpTo(value: unknown, most: number): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text && text.length <= most ? text : undefined
}

/**
 * Is this one of a message's damage rolls? From module 0.28.0 the module says so; before then, and
 * as well, its class does, or the damage type only dnd5e's damage rolls have, or Midi-QOL's tag.
 */
function isDamageRoll(marks: RollMarks): boolean {
  return (
    marks.damage === true ||
    !!marks.class?.endsWith('DamageRoll') ||
    marks.damageType !== undefined ||
    marks.section !== undefined
  )
}

/**
 * Which of a message's rolls, other than its damage, is its attack, and its chip: one the module
 * marks as an attack; or else, on a card used or an attack's message, its first d20 roll; or else,
 * on an attack's message, its first roll. Never a d20 merely for being one: Midi-QOL's card holds
 * its utility roll too, which may be a d20, and isn't marked as such.
 * @param marks - The marks of the rolls drawn on cards of their own, in order.
 */
function attackOf(
  message: SerializedMessage,
  marks: RollMarks[],
): TableMessage['attackRoll'] {
  const dnd5e = message.dnd5e
  const rolled = dnd5e?.roll?.type === 'attack'
  let index = marks.findIndex(mark => mark.attack === true)
  if (index === -1 && (rolled || isUsage(message))) {
    index = marks.findIndex(mark => mark.class === 'D20Roll')
  }
  if (index === -1 && rolled && marks.length > 0) index = 0
  if (index === -1) return undefined
  const activity = dnd5e?.activity?.type
  const attack =
    rolled ||
    marks[index].attack === true ||
    (isUsage(message) && (activity === 'attack' || activity === 'midiAttack'))
  if (!attack) return undefined
  return {
    index,
    action: dnd5e?.item?.type === 'spell' ? 'spell-attack' : 'attack',
  }
}

/**
 * Damage's kinds, by damage type, in the order each first comes: each its rolls' totals added up,
 * at least 0, as dnd5e's card adds damage up; or null where any of them is unknown. Damage of no
 * type is a kind of its own.
 */
export function damageKinds(
  rolls: readonly { total: number | null; damageType?: string }[],
): { type: string | undefined; total: number | null }[] {
  /* eslint-disable unicorn/no-null -- a total the game didn't say is null, as a roll's is */
  const kinds = new Map<string | undefined, number | null>()
  for (const { total, damageType } of rolls) {
    const sum = kinds.has(damageType) ? (kinds.get(damageType) ?? null) : 0
    kinds.set(damageType, sum === null || total === null ? null : sum + total)
  }
  return [...kinds].map(([type, total]) => ({
    type,
    total: total === null ? null : Math.max(0, total),
  }))
  /* eslint-enable unicorn/no-null */
}

/**
 * What each of dnd5e's kinds of healing fills, and the type Midi-QOL counts as none, its
 * "midi-none". Its "none" is damage of no type, which it counts and applies as any other, such as a
 * bonus macro's that names no type.
 */
const POOLS: Record<string, DamagePool> = {
  healing: 'healing',
  temphp: 'temphp',
  maximum: 'maximum',
  'midi-none': 'none',
}

const poolOf = (type: string | undefined): DamagePool =>
  type !== undefined && Object.hasOwn(POOLS, type) ? POOLS[type] : 'harm'

/**
 * A kind of damage's word: as the module says the game words it, or else as dnd5e's English does,
 * or else its key. Midi-QOL's damage of none at all is "No damage", and damage of no type has no
 * word.
 */
function kindLabel(
  type: string | undefined,
  label: string | undefined,
): string | undefined {
  if (type === undefined) return undefined
  if (poolOf(type) === 'none') return 'No damage'
  if (label) return label
  if (Object.hasOwn(DAMAGE_TYPE_LABELS, type)) return DAMAGE_TYPE_LABELS[type]
  return type.charAt(0).toUpperCase() + type.slice(1)
}

type DamagePart = { roll: TableRoll; marks: RollMarks }

/**
 * A message's damage, folded into its cards: its main damage, then Midi-QOL's other damage, which
 * it applies apart, such as on a failed save. Unset when it has none.
 */
function damageOf(
  message: SerializedMessage,
  parts: DamagePart[],
): TableDamage[] | undefined {
  const main = parts.filter(({ marks }) => marks.section !== 'other')
  const other = parts.filter(({ marks }) => marks.section === 'other')
  const cards = [
    ...(main.length > 0 ? [damageCard(message, main, 'main')] : []),
    ...(other.length > 0 ? [damageCard(message, other, 'other')] : []),
  ]
  return cards.length > 0 ? cards : undefined
}

/**
 * One damage card: its kinds, and its total where they fill one pool, as a creature takes them;
 * healing where everything it counts heals, or dnd5e called it healing; a critical as its first
 * roll was, as dnd5e's card judges it.
 */
function damageCard(
  message: SerializedMessage,
  parts: DamagePart[],
  section: TableDamage['section'],
): TableDamage {
  const typed = parts.map(({ roll, marks }) => ({
    total: roll.total,
    damageType: marks.damageType,
  }))
  const kinds: TableDamageKind[] = damageKinds(typed).map(({ type, total }) => {
    const first = parts.find(({ marks }) => marks.damageType === type)
    const label = kindLabel(type, first?.marks.damageLabel)
    return {
      ...(type !== undefined && { type }),
      ...(label && { label }),
      total,
      pool: poolOf(type),
    }
  })
  const counted = kinds.filter(({ pool }) => pool !== 'none')
  const pools = new Set(counted.map(({ pool }) => pool))
  const total = pools.size === 1 ? totalOf(counted) : undefined
  const healing =
    (section === 'main' && message.dnd5e?.roll?.type === 'healing') ||
    (counted.length > 0 && counted.every(({ pool }) => pool !== 'harm'))
  const labels = new Map(kinds.map(kind => [kind.type, kind.label]))
  const onSave = section === 'main' ? onSaveOf(message.dnd5e?.roll) : undefined
  return {
    section,
    action: healing ? 'healing' : 'damage',
    // Kind by kind, as dnd5e's card puts its formula together.
    formula: joinFormulas(
      kinds.flatMap(kind =>
        parts
          .filter(({ marks }) => marks.damageType === kind.type)
          .map(({ roll }) => roll.formula),
      ),
    ),
    kinds,
    ...(total !== undefined && { total }),
    critical: parts[0].roll.critical,
    ...(onSave && { onSave }),
    rolls: parts.map(({ roll, marks }) => {
      const label = labels.get(marks.damageType)
      const tag =
        marks.section === 'bonus' ? (marks.flavor ?? 'Bonus') : undefined
      return {
        formula: roll.formula,
        total: roll.total,
        dice: roll.dice,
        ...(label && { label }),
        ...(tag && { tag }),
      }
    }),
  }
}

/** Kinds of damage that fill one pool, added up: unknown where any of them is, never part of it. */
function totalOf(kinds: TableDamageKind[]): number | null {
  // eslint-disable-next-line unicorn/no-null -- unknown, as a roll's total is
  if (kinds.some(kind => kind.total === null)) return null
  return kinds.reduce((sum, kind) => sum + (kind.total ?? 0), 0)
}

/** Formulas joined into one, "1d4 + 4 + 2d6", a negative one taken away: "1d6 - 1". */
function joinFormulas(formulas: string[]): string {
  let joined = ''
  for (const formula of formulas.map(each => each.trim()).filter(Boolean)) {
    if (!joined) joined = formula
    else if (formula.startsWith('-')) {
      joined += ` - ${formula.slice(1).trimStart()}`
    } else joined += ` + ${formula}`
  }
  return joined
}

/** What dnd5e records a creature that saves takes of a save activity's damage. */
const ON_SAVE = new Set<unknown>(['half', 'none', 'full'])

/**
 * What a creature that saves takes of damage, as dnd5e records it of a save activity's damage.
 * Its roll's data is loose, so it's read only where it's one of dnd5e's.
 */
function onSaveOf(roll: unknown): TableDamage['onSave'] {
  const onSave =
    typeof roll === 'object' && roll !== null && 'damageOnSave' in roll
      ? roll.damageOnSave
      : undefined
  return ON_SAVE.has(onSave) ? (onSave as TableDamage['onSave']) : undefined
}

/**
 * Who a roll or card was aimed at. An attack hit them as the module says, from 0.29.0, where
 * players see it in Foundry; or else, where their armor class is known, if it met it: a critical
 * always hits and a natural 1 always misses. Whether they saved is as the module says too: on
 * Midi-QOL's card, or from their own save rolled from dnd5e's, which `toTableMessages` joins on.
 */
function toTargets(
  targets: Dnd5eTarget[],
  attack: TableRoll | undefined,
): TableTarget[] {
  return targets.map(({ name, ac, outcome: told, save }) => {
    const known = typeof ac === 'number' ? ac : undefined
    let outcome = told
    if (!outcome && known !== undefined && attack && attack.total !== null) {
      const hit = attack.critical || (!attack.fumble && attack.total >= known)
      outcome = hit ? 'hit' : 'miss'
    }
    return {
      name,
      ...(known !== undefined && { ac: known }),
      ...(outcome && { outcome }),
      ...(save && { save: SAVED[save] }),
    }
  })
}

/** A save's outcome as the chat says it of a target. */
const SAVED: Record<SaveOutcome, NonNullable<TableTarget['save']>> = {
  success: 'saved',
  failure: 'failed',
}

/** Whether a save succeeded, as the module says. */
type SaveOutcome = NonNullable<Dnd5eSave['outcome']>

/** Who sent a message, as the chat names them. */
function speakerOf(message: SerializedMessage): string {
  return message.speaker.alias?.trim() || message.author?.name || 'Unknown'
}

/**
 * Who a message was aimed at, as the chat shows them:
 * - a save rolled from dnd5e's card, from module 0.29.0, its own creature alone, named as the card
 *   names it, else as it speaks, saying whether it saved, where the viewer may know;
 * - a check, from module 0.30.0, the same, saying whether it succeeded;
 * - else its own targets, each with whether they saved, where the viewer may know that of their
 *   latest save rolled from it (`savesByCard`);
 * - else, for damage or a save rolled from a card, as from an older module, the card's, as they
 *   stood, without what came of them there: that was the card's, not this message's.
 */
function targetsOf(
  message: SerializedMessage,
  viewer: Viewer,
  attack: TableRoll | undefined,
  { card, saves }: LinkedMessages,
): TableTarget[] {
  const dnd5e = message.dnd5e
  const save = dnd5e?.save
  if (save) {
    const name =
      card?.dnd5e?.targets.find(({ uuid }) => uuid === save.target)?.name ??
      speakerOf(message)
    const { outcome } = save
    const seen = outcome && readsOutcome(save, viewer)
    return [{ name, ...(seen && { save: SAVED[outcome] }) }]
  }
  const check = dnd5e?.check
  if (check) {
    const name =
      card?.dnd5e?.targets.find(({ uuid }) => uuid === check.target)?.name ??
      speakerOf(message)
    const { outcome } = check
    const seen = outcome && readsOutcome(check, viewer)
    return [{ name, ...(seen && { check: outcome }) }]
  }
  const own = dnd5e?.targets ?? []
  if (own.length > 0) {
    return toTargets(
      own.map(target => {
        const joined = target.uuid ? saves?.get(target.uuid) : undefined
        return target.save || !joined ? target : { ...target, save: joined }
      }),
      attack,
    )
  }
  const inherited = (card?.dnd5e?.targets ?? []).map(
    ({ name, ac, uuid }): Dnd5eTarget => ({ name, ac, uuid }),
  )
  return toTargets(inherited, attack)
}

/**
 * May the viewer know how a save or check came out: where the module names no characters whose
 * players alone may, or names theirs?
 */
function readsOutcome(save: Dnd5eSave | Dnd5eCheck, viewer: Viewer): boolean {
  return (
    save.readers === undefined ||
    (!!viewer.actorId && save.readers.includes(viewer.actorId))
  )
}

/**
 * The saves rolled from each of dnd5e's cards, from module 0.29.0, by the card's id: for each
 * creature, by its actor's uuid, how its latest save rolled from the card came out, of those whose
 * outcome the viewer may know.
 */
function savesByCard(
  messages: SerializedMessage[],
  viewer: Viewer,
): Map<string, Map<string, SaveOutcome>> {
  const latest = new Map<
    string,
    Map<string, { outcome: SaveOutcome; at: number }>
  >()
  for (const message of messages) {
    const dnd5e = message.dnd5e
    const save = dnd5e?.save
    const card = dnd5e?.originatingMessage
    if (dnd5e?.roll?.type !== 'save' || !card || !save?.outcome) continue
    if (!readsOutcome(save, viewer)) continue
    const saves = latest.get(card) ?? new Map()
    const before = saves.get(save.target)
    if (!before || message.timestamp >= before.at) {
      saves.set(save.target, { outcome: save.outcome, at: message.timestamp })
    }
    latest.set(card, saves)
  }
  return new Map(
    [...latest].map(([card, saves]) => [
      card,
      new Map([...saves].map(([uuid, { outcome }]) => [uuid, outcome])),
    ]),
  )
}

/**
 * How a message aimed at more than one target went, counting only targets with a result of each
 * kind: "Hit 2 of 3", "3 of 8 saved", or both, joined by " · ". None with no result to count.
 */
function summaryOf(targets: TableTarget[]): string | undefined {
  if (targets.length < 2) return undefined
  const judged = targets.filter(({ outcome }) => outcome !== undefined)
  const saved = targets.filter(({ save }) => save !== undefined)
  const parts = [
    judged.length > 0 &&
      `Hit ${judged.filter(({ outcome }) => outcome === 'hit').length} of ${judged.length}`,
    saved.length > 0 &&
      `${saved.filter(({ save }) => save === 'saved').length} of ${saved.length} saved`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** A roll as a player is shown it: its formula, total, every die, and what marks it. */
export function toTableRoll(roll: RollSummary): TableRoll {
  return {
    formula: roll.formula,
    total: roll.total,
    dice: roll.dice.flatMap(die =>
      die.results.map(({ result, active }) => ({
        faces: die.faces,
        value: result,
        active,
      })),
    ),
    advantage: roll.advantage === true,
    disadvantage: roll.disadvantage === true,
    critical: roll.critical === true,
    fumble: roll.fumble === true,
    damageType:
      typeof roll.damageType === 'string' ? roll.damageType : undefined,
  }
}

/**
 * What a message is about, from what D&D Fifth Edition recorded or else its flavor.
 * @param damaged - Whether it has damage rolls.
 */
function messageLabel(
  message: SerializedMessage,
  damaged: boolean,
): string | undefined {
  const dnd5e = message.dnd5e
  const item = textOf(dnd5e?.item?.name)
  const activity = textOf(dnd5e?.activity?.name)
  const roll = dnd5e?.roll

  if (roll) {
    const ability = ABILITIES[String(roll.ability)]
    switch (roll.type) {
      case 'skill': {
        const skill = SKILLS[String(roll.skillId)]
        if (skill) return `${skill} check`
        break
      }
      case 'ability': {
        if (ability) return `${ability} check`
        break
      }
      case 'save': {
        if (ability) return `${ability} save`
        break
      }
      // Whether it was an attack, damage or healing is shown beside the item's name.
      case 'attack': {
        if (item) return item
        break
      }
      // Damage from a description, which no activity rolls, is named for where it's from, as its
      // card's flavor names it: a spell an item casts, by the spell's name and the item's.
      case 'damage':
      case 'healing': {
        const origin = dnd5e?.activity ? undefined : originOf(message.flavor)
        if (origin) return origin
        if (item) return item
        break
      }
      case 'death': {
        return 'Death save'
      }
      case 'hitDie': {
        return 'Hit Die'
      }
      case 'concentration': {
        return 'Concentration'
      }
    }
  }
  if (isUsage(message) && item) {
    // Its rolls are named for its item alone, as dnd5e's own attack and damage messages are, such
    // as Midi-QOL's card holding them.
    if (message.rolls.length > 0) return item
    return activity && activity !== item ? `${item} · ${activity}` : item
  }
  // Damage that recorded nothing of where it's from, as dnd5e 6's, is named as its flavor says.
  const origin = damaged ? originOf(message.flavor) : undefined
  return origin ?? htmlToText(message.flavor) ?? textOf(message.title)
}

const textOf = (value: unknown) =>
  typeof value === 'string' ? value.trim() || undefined : undefined

/**
 * Where damage rolled from a description is from, as its card's flavor names it before dnd5e's
 * own words for the roll: "Starry Wisp (Worn Bardic Eternal Flame)", of "Starry Wisp (Worn Bardic
 * Eternal Flame) - Damage Roll". None for a flavor not made so.
 */
function originOf(flavor: string): string | undefined {
  const text = htmlToText(flavor) ?? ''
  const end = text.lastIndexOf(' - ')
  return end > 0 ? text.slice(0, end) : undefined
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Reduce Foundry's HTML, such as a message's flavor, to plain text for display. The result is
 * rendered as text, never as HTML, so this only needs to be readable, not safe on its own.
 */
export function htmlToText(html: string): string | undefined {
  const text = html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replaceAll(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith('#')) {
        const point =
          code[1] === 'x' || code[1] === 'X'
            ? Number.parseInt(code.slice(2), 16)
            : Number.parseInt(code.slice(1), 10)
        return Number.isFinite(point) ? String.fromCodePoint(point) : entity
      }
      return ENTITIES[code.toLowerCase()] ?? entity
    })
    .replaceAll(/\s+/g, ' ')
    .trim()
  return text || undefined
}

/* -------------------------------------------- */
/*  Combat                                      */
/* -------------------------------------------- */

/**
 * The encounter to show: the one the tracker is showing, preferring one under way.
 * @param combats - Every held combat, most recently changed first.
 */
export function pickCombat(
  combats: CombatSnapshot[],
): CombatSnapshot | undefined {
  const rank = (combat: CombatSnapshot) =>
    (combat.active ? 2 : 0) + (combat.started ? 1 : 0)
  let best: CombatSnapshot | undefined
  for (const combat of combats) {
    if (!best || rank(combat) > rank(best)) best = combat
  }
  return best
}

export function toTableCombat(
  combat: CombatSnapshot,
  viewer: Viewer,
): TableCombat {
  // Hidden combatants arrive only when the Gamemaster shares Gamemaster-only information.
  const combatants = combat.combatants
    .filter(combatant => combatant.hidden !== true)
    .map(combatant => toTableCombatant(combatant, viewer))
  const current = combatants.some(({ id }) => id === combat.combatantId)
  return {
    id: combat.id,
    name: combat.name,
    started: combat.started,
    round: combat.round,
    currentId: current ? (combat.combatantId ?? undefined) : undefined,
    combatants,
  }
}

function toTableCombatant(combatant: CombatantSummary, viewer: Viewer) {
  const side = sideOf(viewer, combatant.character, combatant.playerOwned)
  const stance = stanceOf(combatant, side)
  return {
    id: combatant.id,
    name: combatant.name,
    initiative: combatant.initiative,
    defeated: combatant.defeated,
    side,
    ...(stance && { stance }),
    hp: side === 'other' ? undefined : (combatant.hp ?? undefined),
  }
}

/**
 * How a combatant not of the party stands, by its token's disposition, from module 0.29.0: one
 * marked Friendly is an ally, and a Neutral one neutral. Its side is left alone, as it decides
 * whose hit points show. None for the party, who are allies whatever their token says, nor for a
 * hostile one, as that may be only the game's default, nor where the module doesn't say.
 */
function stanceOf(
  combatant: CombatantSummary,
  side: Side,
): 'ally' | 'neutral' | undefined {
  if (side !== 'other') return
  if (combatant.disposition === 'friendly') return 'ally'
  if (combatant.disposition === 'neutral') return 'neutral'
}

/* -------------------------------------------- */
/*  Sheet                                       */
/* -------------------------------------------- */

/**
 * A player's view of their character's sheet. Labels the module left blank fall back to dnd5e's
 * English ones.
 * @param sheet - As the module sent it.
 * @param origin - The game's address, which the portrait's path may be relative to.
 */
export function toTableSheet(
  sheet: CharacterSheet,
  origin: string,
): TableSheet {
  const { img, ...rest } = sheet
  return {
    ...rest,
    portrait: portraitUrl(img, origin),
    abilities: sheet.abilities.map(ability => ({
      ...ability,
      label: ability.label || ABILITIES[ability.id] || ability.id,
      abbreviation: ability.abbreviation || ability.id.toUpperCase(),
    })),
    skills: sheet.skills.map(skill => ({
      ...skill,
      label: skill.label || SKILLS[skill.id] || skill.id,
    })),
    // Sheets from before module 0.18.0 have none.
    ...(sheet.tools && {
      tools: sheet.tools.map(tool => ({
        ...tool,
        name: tool.name || toolOrSkillName('tool', tool.id),
      })),
    }),
    // Sheets from before module 0.6.0 have none of these.
    conditions: (sheet.conditions ?? []).map(condition => ({
      ...condition,
      img: iconUrl(condition.img, origin),
    })),
    features: (sheet.features ?? []).map(section => ({
      ...section,
      features: section.features.map(feature => ({
        ...feature,
        img: iconUrl(feature.img, origin),
      })),
    })),
    effects: (sheet.effects ?? []).map(section => ({
      ...section,
      effects: section.effects.map(effect => ({
        ...effect,
        img: iconUrl(effect.img, origin),
      })),
    })),
    // Nor these, before module 0.7.0.
    inventory: inventoryView(sheet.inventory ?? BEFORE_0_7_0.inventory, origin),
    spellcasting: sheet.spellcasting ?? BEFORE_0_7_0.spellcasting,
    spells: (sheet.spells ?? []).map(section => ({
      ...section,
      spells: section.spells.map(spell => ({
        ...spell,
        img: iconUrl(spell.img, origin),
      })),
    })),
    traits: sheet.traits ?? [],
    deathSaves: sheet.deathSaves ?? BEFORE_0_7_0.deathSaves,
    details: sheet.details ?? BEFORE_0_7_0.details,
    // Nor these, before module 0.8.0.
    actions: (sheet.actions ?? []).map(section => ({
      ...section,
      actions: section.actions.map(action => ({
        ...action,
        img: iconUrl(action.img, origin),
      })),
    })),
    // Nor these, before module 0.9.0.
    favorites: (sheet.favorites ?? []).map(favorite =>
      'img' in favorite
        ? { ...favorite, img: iconUrl(favorite.img, origin) }
        : favorite,
    ),
  }
}

/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
/** A sheet from before module 0.7.0, which sent none of these: as a sheet with none of them. */
const BEFORE_0_7_0: Pick<
  CharacterSheet,
  'inventory' | 'spellcasting' | 'deathSaves' | 'details'
> = {
  inventory: {
    sections: [],
    containers: [],
    currency: [],
    encumbrance: null,
    attunement: null,
  },
  spellcasting: null,
  deathSaves: null,
  details: {
    about: [],
    personality: [],
    appearance: null,
    xp: null,
    biography: null,
  },
}
/* eslint-enable unicorn/no-null */

/**
 * The inventory, with its items' icons, those in containers too, loading from the game: a
 * character's, or a group's (module 0.30.0).
 */
export function inventoryView(
  inventory: SheetInventory,
  origin: string,
): SheetInventory {
  const item = <T extends SheetItem>(entry: T): T => ({
    ...entry,
    img: iconUrl(entry.img, origin),
  })
  const container = (entry: SheetContainer): SheetContainer => ({
    ...item(entry),
    // Null while what it holds is secret.
    contents:
      entry.contents === null
        ? entry.contents
        : entry.contents.map(inner =>
            'contents' in inner ? container(inner) : item(inner),
          ),
  })
  return {
    ...inventory,
    sections: inventory.sections.map(section => ({
      ...section,
      items: section.items.map(entry => item(entry)),
    })),
    containers: inventory.containers.map(entry => container(entry)),
  }
}

/** Foundry's placeholder for an actor with no portrait of its own. */
const DEFAULT_PORTRAIT = 'icons/svg/mystery-man.svg'

/**
 * A portrait's full address: relative to the game's, or already full. Unset for none, Foundry's
 * default, or anything other than http(s).
 */
export function portraitUrl(
  img: string | null | undefined,
  origin: string,
): string | undefined {
  if (!img || img.endsWith(DEFAULT_PORTRAIT)) return undefined
  return gameAssetUrl(img, origin)
}

/** Where an icon loads from, or null, as the sheet has it, for none. */
function iconUrl(img: string | null, origin: string): string | null {
  // eslint-disable-next-line unicorn/no-null -- the sheet uses null for no icon
  return gameAssetUrl(img, origin) ?? null
}

/**
 * Where an image from the game loads from, such as an icon: Foundry keeps its own files, such as
 * icons/svg/item-bag.svg, relative to the game's address. Only web addresses are kept.
 */
export function gameAssetUrl(
  img: string | null | undefined,
  origin: string,
): string | undefined {
  if (!img) return undefined
  try {
    const url = new URL(img, `${origin}/`)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
