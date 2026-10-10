import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import type {
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  Dnd5eMessageData,
  MessageAsk,
  RollSummary,
  SerializedMessage,
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type {
  Side,
  TableAction,
  TableAsk,
  TableCombat,
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
 * targets of its own, so it is shown against the attack's.
 */
export function toTableMessages(
  messages: SerializedMessage[],
  viewer: Viewer,
): TableMessage[] {
  const byId = new Map(messages.map(message => [message.id, message]))
  return messages.map(message => {
    const attack = message.dnd5e?.originatingMessage
    const inherited =
      message.dnd5e?.targets.length || !attack
        ? undefined
        : byId.get(attack)?.dnd5e?.targets
    return toTableMessage(message, viewer, inherited)
  })
}

export function toTableMessage(
  message: SerializedMessage,
  viewer: Viewer,
  inheritedTargets?: Dnd5eMessageData['targets'],
): TableMessage {
  const rolls = message.rolls.map(roll => toTableRoll(roll))
  const isCard =
    rolls.length === 0 &&
    (message.dnd5e?.messageType === 'usage' || message.type === 'usage')
  let kind: TableMessage['kind'] = 'text'
  if (rolls.length > 0) kind = 'roll'
  else if (isCard) kind = 'card'
  const action = combatAction(message, rolls)
  // A roll request card stays text, for pages that don't read its ask, but never its own text,
  // which may hold a DC players may not see.
  const ask = kind === 'text' ? askOf(message) : undefined
  let text = kind === 'text' ? message.text.trim() || undefined : undefined
  if (ask) text = askTitle({ ...ask, dc: undefined })

  return {
    id: message.id,
    sentAt: new Date(message.timestamp).toISOString(),
    speaker: message.speaker.alias?.trim() || message.author?.name || 'Unknown',
    side: sideOf(viewer, message.character),
    avatar: viewer.portraits?.get(
      message.character ?? message.speaker.actorId ?? '',
    ),
    whisper: !message.audience.public,
    kind,
    label: messageLabel(message),
    action,
    // A roll's or card's content is its rendering; their details are shown instead.
    text,
    rolls,
    targets: toTargets(
      message.dnd5e?.targets.length
        ? message.dnd5e.targets
        : (inheritedTargets ?? []),
      action === 'attack' || action === 'spell-attack' ? rolls[0] : undefined,
    ),
    ...(ask && { ask }),
  }
}

/**
 * The saving throw a roll request card asks the table for: as the module says, from 0.17.0; or,
 * from an older module, which doesn't, as a Gamemaster's card's own buttons say, without its DC,
 * which players may not be meant to see.
 */
function askOf(message: SerializedMessage): TableAsk | undefined {
  if (message.ask !== undefined) return tableAsk(message.ask)
  return requestCardAsk(message)
}

/**
 * The module's ask, as stored. Checked when it was received, but checked again here, as one stored
 * before then may not have been: its abilities only dnd5e's own, its DC a number, and what asks a
 * name.
 */
function tableAsk(ask: MessageAsk | null): TableAsk | undefined {
  if (!ask || (ask.type !== 'save' && ask.type !== 'concentration')) return
  const abilities = Array.isArray(ask.abilities)
    ? ask.abilities.filter(id => isAbility(id))
    : []
  if (ask.type === 'save' && abilities.length === 0) return
  const { dc, label } = ask
  return {
    type: ask.type,
    abilities,
    ...(Number.isInteger(dc) && { dc }),
    ...(typeof label === 'string' && label.trim() && { label: label.trim() }),
  }
}

/**
 * The saving throw an older module's roll request card asks for, read from its buttons, as dnd5e
 * makes them: those that request a save, or a concentration check, by ability. Only a card spoken
 * by no character, as dnd5e posts a Gamemaster's, is read so: the app isn't told who is a
 * Gamemaster, and a card a player wrote names its writer anyway. Never its DC.
 */
function requestCardAsk(message: SerializedMessage): TableAsk | undefined {
  const { content } = message
  if (message.character || message.speaker.actorId) return
  if (typeof content !== 'string' || !content.includes('rollRequest')) return
  const buttons = [...content.matchAll(/<button\b([^>]*)>/gi)]
    .map(([, attributes]) => dataOf(attributes))
    .filter(
      data =>
        data.get('action') === 'rollRequest' &&
        (data.get('type') === 'save' || data.get('type') === 'concentration'),
    )
  const type = buttons[0]?.get('type') as TableAsk['type'] | undefined
  if (!type) return
  const abilities = buttons.flatMap(data => {
    const ability = data.get('ability')
    return data.get('type') === type && ability && isAbility(ability)
      ? [ability]
      : []
  })
  if (type === 'save' && abilities.length === 0) return
  return { type, abilities: [...new Set(abilities)] }
}

/** An element's data attributes, by name without "data-", from its opening tag's attributes. */
function dataOf(attributes: string): Map<string, string> {
  return new Map(
    [
      ...attributes.matchAll(/\bdata-([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
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
 * Constitution.
 */
export function askTitle(ask: Pick<TableAsk, 'type' | 'abilities' | 'dc'>) {
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

const HEALING = new Set(['healing', 'temphp'])

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
      const healing =
        rolls.length > 0 &&
        rolls.every(({ damageType }) => damageType && HEALING.has(damageType))
      return healing ? 'healing' : 'damage'
    }
    case 'healing': {
      return 'healing'
    }
  }
  return spell && dnd5e?.messageType === 'usage' ? 'spell' : undefined
}

/**
 * Who a roll or card was aimed at. An attack against a target whose armor class is known hit if
 * it met it: a critical always hits and a natural 1 always misses.
 */
function toTargets(
  targets: Dnd5eMessageData['targets'],
  attack: TableRoll | undefined,
): TableTarget[] {
  return targets.map(({ name, ac }) => {
    if (typeof ac !== 'number') return { name }
    if (!attack || attack.total === null) return { name, ac }
    const hit = attack.critical || (!attack.fumble && attack.total >= ac)
    return { name, ac, outcome: hit ? 'hit' : 'miss' }
  })
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

/** What a message is about, from what D&D Fifth Edition recorded or else its flavor. */
function messageLabel(message: SerializedMessage): string | undefined {
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
  if (dnd5e?.messageType === 'usage' && item) {
    return activity && activity !== item ? `${item} · ${activity}` : item
  }
  return htmlToText(message.flavor) ?? textOf(message.title)
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
  return {
    id: combatant.id,
    name: combatant.name,
    initiative: combatant.initiative,
    defeated: combatant.defeated,
    side,
    hp: side === 'other' ? undefined : (combatant.hp ?? undefined),
  }
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

/** The inventory, with its items' icons, those in containers too, loading from the game. */
function inventoryView(
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
