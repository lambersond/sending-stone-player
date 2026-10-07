import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import type {
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  Dnd5eMessageData,
  RollSummary,
  SerializedMessage,
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type {
  Side,
  TableAction,
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
    text: kind === 'text' ? message.text.trim() || undefined : undefined,
    rolls,
    targets: toTargets(
      message.dnd5e?.targets.length
        ? message.dnd5e.targets
        : (inheritedTargets ?? []),
      action === 'attack' || action === 'spell-attack' ? rolls[0] : undefined,
    ),
  }
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
      case 'attack':
      case 'damage':
      case 'healing': {
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
