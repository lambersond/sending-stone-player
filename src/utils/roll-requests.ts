import {
  BRIDGE_POLLED_WITHIN,
  DAMAGE_WITHIN,
  ROLL_ANSWER_WITHIN,
  ROLL_FEATURES,
  ROLL_KINDS,
  ROLL_PENDING_FOR,
} from '@/constants/sending-stone'
import { castAtLevel, outOfSlots, slotPools } from '@/utils/action-groups'
import { modifiedDice } from '@/utils/damage-modifiers'
import { sheetActions } from '@/utils/sheet-actions'
import { toTableRoll } from '@/utils/table-view'
import { mostTargets } from '@/utils/uses'
import type {
  AttackTarget,
  RollFeature,
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
 * skill, ability, tool, attack, spell or feature, the character isn't dying, isn't in the combat,
 * or has rolled initiative already. For an attack or a use: the spell it's cast with has no spell
 * slots left, or none of the slot chosen; the attack mode or ammunition chosen isn't the weapon's,
 * or none of it is left; or a target can't be picked, or there are more than it takes. For damage:
 * its attack or use can't be found, or is too old; no damage follows it; its damage is rolled
 * already; the dice aren't those it said; or a kind of damage chosen isn't one it offers. For a
 * saving throw the game asked for: it no longer waits, isn't this character's, isn't rolled with an
 * ability it may be, or is answered already.
 */
export type RollRefusal =
  | 'unavailable'
  | 'unknown'
  | 'not-dying'
  | 'not-in-combat'
  | 'already-rolled'
  | 'slots'
  | 'slot'
  | 'mode'
  | 'ammo'
  | 'target'
  | 'gone'
  | 'no-damage'
  | 'damaged'
  | 'dice'
  | 'type'
  | 'prompt'

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
 * What else a campaign's game does with its players' rolls now, such as take damage they changed:
 * nothing while it takes none.
 */
export function availableRollFeatures(
  campaign: Parameters<typeof availableRollKinds>[0] & {
    rollFeatures: string[]
  },
  now = Date.now(),
): RollFeature[] {
  if (availableRollKinds(campaign, now).length === 0) return []
  return ROLL_FEATURES.filter(feature =>
    campaign.rollFeatures.includes(feature),
  )
}

/**
 * What says which rolls a game takes, and what else it does with them, as a viewer last saw it:
 * such as "skill,save,damage;modifiers".
 */
export function rollsKey(
  kinds: readonly string[] = [],
  features: readonly string[] = [],
): string {
  return features.length > 0
    ? `${kinds.join(',')};${features.join(',')}`
    : kinds.join(',')
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
    case 'use': {
      return sheet ? checkUse(input, sheet, combats) : 'unknown'
    }
    // Checked against its attack or use, by checkDamage.
    case 'damage': {
      return undefined
    }
  }
}

/**
 * Can the character make this attack: is it one of its actions, favorites, spells, features or
 * inventory items, identified, with a spell slot left for a spell, in the attack mode and with the
 * ammunition chosen, if they're the weapon's, at a combatant its player can see? Whatever else it
 * spends, such as its uses, the game checks as it would spend it.
 */
function checkAttack(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, attackId }) =>
      id === input.item && !!attackId && attackId === input.activity,
  )
  if (!action || !action.identified) return 'unknown'
  const slot = checkSlot(input, action, sheet)
  if (slot) return slot
  const { attackMode, ammunition } = input
  if (
    attackMode &&
    !action.attackModes?.some(({ value }) => value === attackMode)
  ) {
    return 'mode'
  }
  if (ammunition) {
    const fired = action.ammunition?.find(({ id }) => id === ammunition)
    if (!fired || fired.quantity <= 0) return 'ammo'
  }
  return checkTargets(input.target ? [input.target] : [], combats)
}

/**
 * Can the character use this spell or feature: is it what one of its actions, favorites, spells,
 * features or inventory items is used through, identified, with a spell slot left for a spell, at
 * no more combatants than it takes at the level it's cast at, all of them combatants its player
 * can see? Whatever else it spends, such as its uses, the game checks as it would spend it.
 */
function checkUse(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, activity }) => id === input.item && activity?.id === input.activity,
  )
  if (!action?.activity || !action.identified) return 'unknown'
  const slot = checkSlot(input, action, sheet)
  if (slot) return slot
  const targets = input.targets ?? []
  const level = castAtLevel(action, sheet.spells, input.slot)
  if (targets.length > mostTargets(action.activity, action.level, level)) {
    return 'target'
  }
  return checkTargets(targets, combats)
}

/**
 * Can a spell be cast with the slot chosen: one of the spell's pools, with one left? With none
 * chosen, has it any slot, or use of its own, left? A slot chosen for a spell cast without slots,
 * such as an innate one, is the game's to leave out.
 */
function checkSlot(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
): RollRefusal | undefined {
  const pools = slotPools(action, sheet.spells)
  if (!input.slot) return outOfSlots(action, pools) ? 'slots' : undefined
  if (!pools) return undefined
  const pool = pools.find(({ id }) => id === input.slot)
  return pool && pool.value > 0 ? undefined : 'slot'
}

/** Are these combatants of a combat their player can see, as picked? */
function checkTargets(
  targets: AttackTarget[],
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  for (const target of targets) {
    const combatant = combats
      .find(({ id }) => id === target.combatId)
      ?.combatants.find(({ id }) => id === target.combatantId)
    if (!combatant || combatant.hidden === true) return 'target'
  }
  return undefined
}

/**
 * Can this damage be rolled: does it follow the character's own attack or use, made in the game
 * lately, that said damage or healing follows; is no other damage for it on its way or made; are
 * its dice those it said its damage throws, in order, changed as the player chose, if they did;
 * and is each kind of damage chosen one its roll offers?
 * @param use - The attack or use, if it's the character's.
 * @param others - The other damage asked for the same attack or use.
 */
export function checkDamage(
  input: RollRequestInput,
  use: HeldRollRequest | null | undefined,
  others: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
  now = Date.now(),
): RollRefusal | undefined {
  const follows = use?.kind === 'attack' || use?.kind === 'use'
  if (!use || !follows || use.status !== 'done') return 'gone'
  if (now - use.createdAt.getTime() > DAMAGE_WITHIN) return 'gone'
  const damage = (use.result as CommandResult | null)?.damage
  if (!damage) return 'no-damage'
  const taken = others.some(other =>
    ['sending', 'rolling', 'done'].includes(rollStatus(other, now)),
  )
  if (taken) return 'damaged'
  const planned = modifiedDice(damage, input.modifiers)
  if (!planned) return 'dice'
  const matches =
    input.dice.length === planned.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === planned[index].faces &&
        results.length === planned[index].number,
    )
  if (!matches) return 'dice'
  const types = input.types ?? []
  const offered =
    types.length <= damage.rolls.length &&
    types.every(
      (type, index) =>
        type === null ||
        (damage.rolls[index].types ?? []).some(({ key }) => key === type),
    )
  return offered ? undefined : 'type'
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
  // An attack's or a use's damage is the player's to roll, even of one they can't see.
  const damage = result.damage === undefined ? {} : { damage: result.damage }
  const use = result.use ? { use: result.use } : {}
  if (!result.visible)
    return { id: request.id, status, visible: false, ...use, ...damage }
  const rolls = result.rolls.map(roll => toTableRoll(roll))
  return {
    id: request.id,
    status,
    visible: true,
    total:
      request.kind === 'damage' ? sumOf(rolls) : (rolls[0]?.total ?? undefined),
    rolls,
    ...(result.attack ? { attack: result.attack } : {}),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    ...use,
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
