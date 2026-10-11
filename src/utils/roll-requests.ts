import {
  BRIDGE_POLLED_WITHIN,
  DAMAGE_WITHIN,
  ROLL_ANSWER_WITHIN,
  ROLL_FEATURES,
  ROLL_KINDS,
  ROLL_PENDING_FOR,
} from '@/constants/sending-stone'
import { castAtLevel, outOfSlots, slotPools } from '@/utils/action-groups'
import { changes, linkDamage, modifiedDice } from '@/utils/damage-modifiers'
import { formulaDice } from '@/utils/formulas'
import { sheetActions } from '@/utils/sheet-actions'
import { sheetTextRefs } from '@/utils/sheet-texts'
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
import type { CheckOption, FoundLink } from '@/utils/description-links'
import type { ExtraDice } from '@/utils/roll-modifiers'

/**
 * Why a roll can't go to the Gamemaster's game: the game can't take it now, the sheet has no such
 * skill, ability, tool, attack, spell or feature, the character isn't dying, isn't in the combat,
 * or has rolled initiative already. For an attack or a use: the spell it's cast with has no spell
 * slots left, or none of the slot chosen; the attack mode or ammunition chosen isn't the weapon's,
 * or none of it is left; or a target can't be picked, or there are more than it takes. For damage:
 * its attack or use can't be found, or is too old; no damage follows it; its damage is rolled
 * already; the dice aren't those it said; or a kind of damage chosen isn't one it offers. For a
 * saving throw the game asked for: it no longer waits, isn't this character's, isn't rolled with an
 * ability it may be, or is answered already. For a hit die: the character has none of its size
 * left. For a formula: its dice aren't those the formula throws. From a link in a description: the
 * description is no longer on the sheet, or not held here (`gone`); it has no such link, or not of
 * the kind asked for, or a saving throw it calls for isn't rolled with that ability, or a check
 * with that skill, tool or ability, or healing, or damage the game marks as never a critical hit's,
 * is asked for as one (`link`); the table is asked for one in a secret (`secret`); its dice aren't
 * those its formulas throw, changed as the player chose, or as a critical hit's where the sheet
 * doesn't say how the world makes one; a kind of damage chosen isn't one it offers; or damage is
 * changed where the game, before module 0.19.0, doesn't take it so (`unavailable`).
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
  | 'no-hit-dice'
  | 'link'
  | 'secret'

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
 * tool must be on its sheet, but for a tool check a description calls for, which dnd5e makes with
 * any tool; it must be dying to roll a death saving throw; it must be in the combat, without
 * initiative yet, to roll initiative; and it must have a hit die of the size it spends left. What
 * a link in a description asks for must be what that link is, in a description on its sheet.
 * @param links - For a roll from a link in a description, the links the game acts on in that
 *   description, as held here; none where it isn't held.
 * @returns Why not, or nothing when it can.
 */
export function checkRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  actorId: string,
  links?: ReadonlyMap<number, FoundLink>,
): RollRefusal | undefined {
  const linked = () =>
    input.text === undefined ? undefined : checkLinked(input, sheet, links)
  switch (input.kind) {
    case 'skill': {
      return (
        known(sheet?.skills.some(({ id }) => id === input.key) === true) ??
        linked()
      )
    }
    case 'ability':
    case 'save': {
      return (
        known(sheet?.abilities.some(({ id }) => id === input.key) === true) ??
        linked()
      )
    }
    case 'ask':
    case 'textDamage':
    case 'textRoll': {
      return checkLinked(input, sheet, links)
    }
    case 'tool': {
      // A description's tool check is made as dnd5e makes one, with the tool or without it.
      if (input.text !== undefined) return checkLinked(input, sheet, links)
      // The sheet lists tools among its tools, from module 0.18.0, and its favorites.
      return known(
        (sheet?.tools ?? []).some(({ id }) => id === input.key) ||
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
    case 'hitDie': {
      return checkHitDie(input, sheet)
    }
    case 'formula': {
      return sheet ? checkFormula(input, sheet) : 'unknown'
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
 * ammunition chosen, if they're the weapon's, at a combatant its player can see, or for an area
 * attack, at no more combatants than it takes, all of them ones its player can see? Whatever else
 * it spends, such as its uses, the game checks as it would spend it.
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
  // An area attack is made at those in its area, as many as it takes at the level it's cast at.
  if (input.targets !== undefined) {
    const area = action.attackArea
    if (!area) return 'target'
    const level = castAtLevel(action, sheet.spells, input.slot)
    if (input.targets.length > mostTargets(area, action.level, level)) {
      return 'target'
    }
    return checkTargets(input.targets, combats)
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
  if (
    targets.length > mostTargets(action.activity.targets, action.level, level)
  ) {
    return 'target'
  }
  return checkTargets(targets, combats)
}

/**
 * Can a spell be cast with the slot chosen: one of the spell's pools, with one left? With none
 * chosen, has it any slot, or use of its own, left? A slot chosen for a spell cast without slots,
 * such as an innate one, is the game's to leave out. One of its activities used without spending a
 * slot, such as Spirit Guardians' save each turn, may be used at any of its pools' levels.
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
  // An activity used without spending a slot is used at its level, whether any is left or not.
  const spends = action.consumesSlot !== false
  return pool && (pool.value > 0 || !spends) ? undefined : 'slot'
}

/**
 * Has the character a class with hit dice of this size, with one of them left? How many are left
 * of a class whose sheet doesn't say is the game's to check.
 */
function checkHitDie(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const sized = (sheet?.classes ?? []).flatMap(({ hitDice }) =>
    hitDice && hitDice.die === input.denomination ? [hitDice] : [],
  )
  if (sized.length === 0) return 'unknown'
  return sized.some(({ value }) => value === null || value > 0)
    ? undefined
    : 'no-hit-dice'
}

/**
 * Is this the formula of one of the character's actions, favorites, spells, features or inventory
 * items, identified, that the game may use, and are its dice those the formula throws, in order?
 */
function checkFormula(
  input: RollRequestInput,
  sheet: CharacterSheet,
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, activity, rollFormula }) =>
      id === input.item && activity?.id === input.activity && !!rollFormula,
  )
  if (!action?.rollFormula || !action.identified) return 'unknown'
  const thrown = formulaDice(action.rollFormula.formula)
  if (!thrown) return 'unknown'
  return throws(input, thrown) ? undefined : 'dice'
}

/**
 * Is what a roll from a link in a description asks for what the link is, in a description on the
 * character's sheet now, held here? The table is asked for a saving throw or check the link calls
 * for, but never one in a secret, which would be posted for everyone; the player's own saving
 * throw is rolled with one of the abilities it names, or Constitution for a concentration check
 * that names none, as the game takes it; the player's own check is one of the link's, by its kind
 * and its skill's, tool's or ability's key; damage or healing is rolled as its parts' formulas
 * throw, each as a kind of damage the part offers, where chosen, changed as the player chose, as an
 * attack's damage may be, where the game takes it so, and damage, never healing nor damage the game
 * marks as never one, as a critical hit's, its dice thrown as many times as the world's rules say,
 * where the sheet says; and a roll of its own as its formula throws. The game reads the link again
 * from its own copy, so nothing it asks for is taken from the app.
 */
function checkLinked(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  links: ReadonlyMap<number, FoundLink> | undefined,
): RollRefusal | undefined {
  if (!sheet) return 'unknown'
  const { text, link: number } = input
  if (!text || number === undefined || !links) return 'gone'
  if (!sheetTextRefs(sheet).includes(text)) return 'gone'
  const found = links.get(number)
  switch (input.kind) {
    case 'ask': {
      if (found?.link.kind !== 'save' && found?.link.kind !== 'check') {
        return 'link'
      }
      return found.secret ? 'secret' : undefined
    }
    case 'save': {
      // A concentration check that names no ability holds Constitution, which the game takes too.
      if (found?.link.kind !== 'save') return 'link'
      return found.link.abilities.includes(input.key ?? '') ? undefined : 'link'
    }
    case 'skill':
    case 'tool':
    case 'ability': {
      if (found?.link.kind !== 'check') return 'link'
      const type = CHECK_TYPES[input.kind]
      const offered = found.link.checks.some(
        option =>
          option.type === type && (option.key ?? option.ability) === input.key,
      )
      return offered ? undefined : 'link'
    }
    case 'textDamage': {
      if (found?.link.kind !== 'damage') return 'link'
      const damage = found.link
      // Healing is never a critical hit's, nor damage the game marks as never one.
      if (input.critical && (damage.healing || damage.critical === false)) {
        return 'link'
      }
      const { parts } = damage
      const types = input.types ?? []
      const offered =
        types.length <= parts.length &&
        types.every(
          (type, index) => type === null || parts[index].types.includes(type),
        )
      if (!offered) return 'type'
      // Changed only where the game takes it so, from module 0.19.0, whose sheets say how it makes
      // a critical hit's, or that it can't.
      if (changes(input.modifiers) && sheet.critical === undefined) {
        return 'unavailable'
      }
      // A critical hit's only as the world's rules make it, where the sheet says how.
      const rule = input.critical ? sheet.critical : undefined
      if (input.critical && !rule) return 'dice'
      // A part the app can't read, it couldn't have rolled.
      const preview = linkDamage(damage, rule ?? undefined)
      const planned = preview && modifiedDice(preview, input.modifiers)
      return planned && matchesPlanned(input, planned) ? undefined : 'dice'
    }
    case 'textRoll': {
      if (found?.link.kind !== 'roll') return 'link'
      const thrown = formulaDice(found.link.formula)
      return thrown && throws(input, thrown) ? undefined : 'dice'
    }
    default: {
      return 'link'
    }
  }
}

/** The kind of option a check a description calls for has, for each kind of roll that makes one. */
const CHECK_TYPES = {
  skill: 'skill',
  tool: 'tool',
  ability: 'check',
} as const satisfies Partial<Record<RollKind, CheckOption['type']>>

/** Are a roll's dice those a formula throws, in order: the same kinds of dice, as many of each? */
function throws(input: RollRequestInput, thrown: ExtraDice[]): boolean {
  return (
    input.dice.length === thrown.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === thrown[index].sides && results.length === thrown[index].count,
    )
  )
}

/**
 * Are a roll's dice those its damage was planned to throw, in order: the same kinds of dice, as
 * many of each?
 */
function matchesPlanned(
  input: RollRequestInput,
  planned: { faces: number; number: number }[],
): boolean {
  return (
    input.dice.length === planned.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === planned[index].faces &&
        results.length === planned[index].number,
    )
  )
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
  if (!planned || !matchesPlanned(input, planned)) return 'dice'
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
    total: ['damage', 'textDamage'].includes(request.kind)
      ? sumOf(rolls)
      : (rolls[0]?.total ?? undefined),
    rolls,
    ...(result.attack ? { attack: result.attack } : {}),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    ...(typeof result.healed === 'number' ? { healed: result.healed } : {}),
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
