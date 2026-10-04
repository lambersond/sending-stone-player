import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import type {
  CombatantSummary,
  CombatSnapshot,
  ConnectedCharacter,
  RollSummary,
  SerializedMessage,
} from '@/types/sending-stone'
import type { Side, TableCombat, TableMessage, TableRoll } from '@/types/table'

/** Who is looking: their character's actor id, if connected, and the party's actor ids. */
export type Viewer = { actorId: string | undefined; party: Set<string> }

/**
 * Find a character among a game's connected characters. A character here is only a name, so
 * that is what links it to its Foundry actor.
 * @returns The actor id, or undefined if no connected character has that name.
 */
export function findActorId(
  roster: ConnectedCharacter[],
  name: string,
): string | undefined {
  const wanted = normalizeName(name)
  return roster.find(character => normalizeName(character.name) === wanted)?.id
}

const normalizeName = (name: string) =>
  name.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase()

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

export function toTableMessage(
  message: SerializedMessage,
  viewer: Viewer,
): TableMessage {
  const rolls = message.rolls.map(roll => toTableRoll(roll))
  const isCard =
    rolls.length === 0 &&
    (message.dnd5e?.messageType === 'usage' || message.type === 'usage')
  let kind: TableMessage['kind'] = 'text'
  if (rolls.length > 0) kind = 'roll'
  else if (isCard) kind = 'card'

  return {
    id: message.id,
    sentAt: new Date(message.timestamp).toISOString(),
    speaker: message.speaker.alias?.trim() || message.author?.name || 'Unknown',
    side: sideOf(viewer, message.character),
    whisper: !message.audience.public,
    kind,
    label: messageLabel(message),
    // A roll's or card's content is its rendering; their details are shown instead.
    text: kind === 'text' ? message.text.trim() || undefined : undefined,
    rolls,
    targets: (message.dnd5e?.targets ?? []).map(target => target.name),
  }
}

function toTableRoll(roll: RollSummary): TableRoll {
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
      case 'attack': {
        return item ? `${item} · Attack` : 'Attack'
      }
      case 'damage': {
        return item ? `${item} · Damage` : 'Damage'
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
