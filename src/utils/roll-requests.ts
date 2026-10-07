import {
  BRIDGE_POLLED_WITHIN,
  DAMAGE_WITHIN,
  ROLL_ANSWER_WITHIN,
  ROLL_KINDS,
  ROLL_PENDING_FOR,
} from '@/constants/sending-stone'
import { outOfSlots, slotPools } from '@/utils/action-groups'
import { favoriteEntries } from '@/utils/favorites'
import { toTableRoll } from '@/utils/table-view'
import type {
  RollKind,
  RollRequestInput,
  RollRequestView,
  RollStatus,
} from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  CommandResult,
  SheetAction,
} from '@/types/sending-stone'

/**
 * Why a roll can't go to the Gamemaster's game: the game can't take it now, the sheet has no such
 * skill, ability, tool or attack, the character isn't dying, isn't in the combat, or has rolled
 * initiative already. For an attack: the spell it's made with has no spell slots left, or its
 * target can't be attacked. For damage: its attack can't be found, or is too old; no damage
 * follows it; its damage is rolled already; or the dice aren't those the attack said.
 */
export type RollRefusal =
  | 'unavailable'
  | 'unknown'
  | 'not-dying'
  | 'not-in-combat'
  | 'already-rolled'
  | 'slots'
  | 'target'
  | 'gone'
  | 'no-damage'
  | 'damaged'
  | 'dice'

/** A roll request as it's held: what to roll, and how far it has got. */
export type HeldRollRequest = {
  id: string
  actorId: string
  kind: string
  payload: unknown
  status: 'pending' | 'claimed' | 'done' | 'failed'
  result: unknown
  createdAt: Date
  claimedAt: Date | null
}

/** A roll as the module is sent it: whose, what, how, and the dice to make it with. */
export type RollCommand = RollRequestInput & { id: string; actorId: string }

/**
 * The rolls a campaign's players can have made in its game now: none unless its Gamemaster lets
 * them, and the Gamemaster's module is fetching them.
 */
export function availableRollKinds(
  campaign: {
    rollsEnabled: boolean
    rollKinds: string[]
    bridgePolledAt: Date | null
  },
  now = Date.now(),
): RollKind[] {
  const polled = campaign.bridgePolledAt?.getTime()
  if (!campaign.rollsEnabled || !polled || now - polled >= BRIDGE_POLLED_WITHIN)
    return []
  return ROLL_KINDS.filter(kind => campaign.rollKinds.includes(kind))
}

/**
 * Can the character make this roll, as its sheet and the encounter stand? A skill, ability or
 * tool must be on its sheet; it must be dying to roll a death saving throw; and it must be in the
 * combat, without initiative yet, to roll initiative.
 * @returns Why not, or nothing when it can.
 */
export function checkRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  actorId: string,
): RollRefusal | undefined {
  switch (input.kind) {
    case 'skill': {
      return known(sheet?.skills.some(({ id }) => id === input.key) === true)
    }
    case 'ability':
    case 'save': {
      return known(sheet?.abilities.some(({ id }) => id === input.key) === true)
    }
    case 'tool': {
      // The sheet lists tools only among the favorites.
      return known(
        (sheet?.favorites ?? []).some(
          ({ type, id }) => type === 'tool' && id === input.key,
        ),
      )
    }
    case 'death': {
      return isDying(sheet) ? undefined : 'not-dying'
    }
    case 'initiative': {
      const combat = combats.find(({ id }) => id === input.combatId)
      const combatant = combat?.combatants.find(
        ({ character }) => character === actorId,
      )
      if (!combatant) return 'not-in-combat'
      return combatant.initiative === null ? undefined : 'already-rolled'
    }
    case 'attack': {
      return sheet ? checkAttack(input, sheet, combats) : 'unknown'
    }
    // Checked against its attack, by checkDamage.
    case 'damage': {
      return undefined
    }
  }
}

/**
 * Can the character make this attack: is it one of its actions, or favorites, identified, with a
 * spell slot left for a spell, at a combatant its player can see? Whatever else it spends, such as
 * its uses or ammunition, the game checks as it would spend it.
 */
function checkAttack(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  const action = attacksOf(sheet).find(
    ({ id, attackId }) => id === input.item && attackId === input.activity,
  )
  if (!action || !action.identified) return 'unknown'
  if (outOfSlots(action, slotPools(action, sheet.spells))) return 'slots'
  const { target } = input
  if (target) {
    const combatant = combats
      .find(({ id }) => id === target.combatId)
      ?.combatants.find(({ id }) => id === target.combatantId)
    if (!combatant || combatant.hidden === true) return 'target'
  }
  return undefined
}

/** The character's attacks: its actions', and its favorite activities'. */
function attacksOf(sheet: CharacterSheet): SheetAction[] {
  const actions = sheet.actions.flatMap(section => section.actions)
  const favorites = favoriteEntries(sheet).flatMap(entry =>
    entry.kind === 'action' ? [entry.action] : [],
  )
  return [...actions, ...favorites].filter(action => action.attackId)
}

/**
 * Can this damage be rolled: does it follow the character's own attack, made in the game lately,
 * that said damage follows; is no other damage for it on its way or made; and are its dice those
 * the attack said its damage throws, in order?
 * @param use - The attack, if it's the character's.
 * @param others - The other damage asked for the same attack.
 */
export function checkDamage(
  input: RollRequestInput,
  use: HeldRollRequest | null | undefined,
  others: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
  now = Date.now(),
): RollRefusal | undefined {
  if (use?.kind !== 'attack' || use.status !== 'done') return 'gone'
  if (now - use.createdAt.getTime() > DAMAGE_WITHIN) return 'gone'
  const damage = (use.result as CommandResult | null)?.damage
  if (!damage) return 'no-damage'
  const taken = others.some(other =>
    ['sending', 'rolling', 'done'].includes(rollStatus(other, now)),
  )
  if (taken) return 'damaged'
  const planned = damage.plannable
    ? damage.rolls.flatMap(roll => roll.dice)
    : []
  const matches =
    input.dice.length === planned.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === planned[index].faces &&
        results.length === planned[index].number,
    )
  return matches ? undefined : 'dice'
}

/** Nothing, for what the sheet has; or that it doesn't. */
function known(found: boolean): RollRefusal | undefined {
  return found ? undefined : 'unknown'
}

/**
 * Is the character dying, so that it rolls death saving throws: down to 0 hit points, with
 * neither three successes nor three failures yet, as dnd5e has it?
 */
export function isDying(sheet?: Partial<CharacterSheet>): boolean {
  const saves = sheet?.deathSaves
  return (
    !!saves && sheet?.hp?.value === 0 && saves.success < 3 && saves.failure < 3
  )
}

/**
 * Where a roll stands. One the module hasn't fetched in time no longer goes to the game, and one
 * it fetched but never answered for is taken as lost; an answer that comes late still counts.
 */
export function rollStatus(
  request: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>,
  now = Date.now(),
): RollStatus {
  switch (request.status) {
    case 'pending': {
      return now - request.createdAt.getTime() < ROLL_PENDING_FOR
        ? 'sending'
        : 'expired'
    }
    case 'claimed': {
      const claimed = (request.claimedAt ?? request.createdAt).getTime()
      return now - claimed < ROLL_ANSWER_WITHIN ? 'rolling' : 'lost'
    }
    default: {
      return request.status
    }
  }
}

/** A roll as its player is told of it: where it stands, and what the game made of it. */
export function toRollRequestView(
  request: HeldRollRequest,
  now = Date.now(),
): RollRequestView {
  const status = rollStatus(request, now)
  const result = request.result as CommandResult | null
  if (status === 'failed') {
    return { id: request.id, status, reason: result?.reason ?? undefined }
  }
  if (status !== 'done' || !result) return { id: request.id, status }
  // An attack's damage is the player's to roll, even of an attack they can't see.
  const damage = result.damage === undefined ? {} : { damage: result.damage }
  if (!result.visible)
    return { id: request.id, status, visible: false, ...damage }
  const rolls = result.rolls.map(roll => toTableRoll(roll))
  return {
    id: request.id,
    status,
    visible: true,
    total:
      request.kind === 'damage' ? sumOf(rolls) : (rolls[0]?.total ?? undefined),
    rolls,
    ...(result.attack ? { attack: result.attack } : {}),
    ...damage,
  }
}

/** Damage's total: each of its parts', added up, when the game said each. */
function sumOf(rolls: { total: number | null }[]): number | undefined {
  if (rolls.length === 0 || rolls.some(roll => roll.total === null))
    return undefined
  return rolls.reduce((sum, roll) => sum + (roll.total ?? 0), 0)
}

/** A held roll as the module is sent it. */
export function toCommand(request: HeldRollRequest): RollCommand {
  return {
    ...(request.payload as RollRequestInput),
    id: request.id,
    actorId: request.actorId,
  }
}
