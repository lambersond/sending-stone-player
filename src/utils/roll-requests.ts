import {
  BRIDGE_POLLED_WITHIN,
  DAMAGE_WITHIN,
  ROLL_ANSWER_WITHIN,
  ROLL_FEATURES,
  ROLL_KINDS,
  ROLL_PENDING_FOR,
} from '@/constants/sending-stone'
import { outOfSlots, slotPools } from '@/utils/action-groups'
import { castAtLevel, castIndex, castOf, type CastIndex } from '@/utils/casts'
import {
  changes,
  criticalOffered,
  diceTakenAway,
  linkDamage,
  modifiedDice,
  unmaximizable,
} from '@/utils/damage-modifiers'
import { formulaDice } from '@/utils/formulas'
import { sheetActions } from '@/utils/sheet-actions'
import { allItems, sheetTextRefs } from '@/utils/sheet-texts'
import { healingRolls, toTableRoll } from '@/utils/table-view'
import { mostTargets } from '@/utils/uses'
import type {
  AttackTarget,
  GmRollView,
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
  SheetEnchantment,
} from '@/types/sending-stone'
import type { CheckOption, FoundLink } from '@/utils/description-links'
import type { ExtraDice } from '@/utils/roll-modifiers'

/**
 * Why a roll can't go to the Gamemaster's game: the game can't take it now, the sheet has no such
 * skill, ability, tool, attack, spell or feature, nor check of the character's own an activity asks
 * for, the character isn't dying, isn't in the combat, or has rolled initiative already. For an
 * attack or a use: the spell it's cast with has no spell
 * slots left, or none of the slot chosen; a spell an item casts isn't offered at the level chosen
 * (`slot`); the attack mode or ammunition chosen isn't the weapon's, or none of it is left; or a
 * target can't be picked, or there are more than it takes. For damage:
 * its attack or use can't be found, or is too old; no damage follows it; its damage is rolled
 * already; the dice aren't those it said; or a kind of damage chosen isn't one it offers. For a
 * saving throw the game asked for: it no longer waits, isn't this character's, isn't rolled with an
 * ability it may be, or is answered already. For a hit die: the character has none of its size
 * left; for hit dice spent at once, fewer of a size than are spent. For a formula: its dice aren't
 * those the formula throws. From a link in a description: the description is no longer on the
 * sheet, or not held here (`gone`); it has no such link, or not of the kind asked for, or a saving
 * throw it calls for isn't rolled with that ability, or a check with that skill, tool or ability,
 * or healing, or damage the game marks as never a critical hit's, without what one adds, is asked
 * for as one (`link`); the table is asked for one in a secret (`secret`); its dice aren't those
 * its formulas throw, changed as the player chose, or as a critical hit's where the sheet doesn't
 * say how the world makes one, or where it isn't offered, as where it adds dice the world's rules
 * don't say how they throw; a kind of damage chosen isn't one it offers; or damage is changed where
 * the game, before module 0.19.0, doesn't take it so (`unavailable`). For a use of an enchant
 * activity, from module 0.21.0: the way it enchants isn't one it offers, or not at the level it's
 * cast at, or none was chosen (`profile`); or the item it enchants isn't one it may, as for one
 * that enchants its own (`enchant-target`); or one that enchants its own item is used in the way
 * it's on it in already, which dnd5e would take as ending it, at a cost (`applied`). For an
 * enchantment ended: it isn't one the player may end, on that item of the character's
 * (`enchantment`).
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
  | 'profile'
  | 'enchant-target'
  | 'applied'
  | 'enchantment'

/** A roll request as it's held: what to roll, and how far it has got. */
export type HeldRollRequest = {
  id: string
  actorId: string
  /** Who sent it: the character's player, or the campaign's Gamemaster as it (#156). */
  role: 'player' | 'gm'
  kind: string
  payload: unknown
  status: 'pending' | 'claimed' | 'done' | 'failed'
  result: unknown
  createdAt: Date
  claimedAt: Date | null
}

/**
 * A roll as the module is sent it: whose, what, how, and the dice to make it with; and from module
 * 0.23.0, `by: 'gm'` for one the campaign's Gamemaster made as the character, which the module
 * marks as theirs. A player's has no `by`.
 */
export type RollCommand = RollRequestInput & {
  id: string
  actorId: string
  by?: 'gm'
}

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
 * initiative yet, to roll initiative; and it must have a hit die of the size it spends left, or of
 * hit dice spent at once, as many of each size as it spends. What a link in a description asks for
 * must be what that link is, in a description on its sheet; and a check an activity asks for, one
 * of the ways that activity may be made, as `checkActivityRoll` says.
 * @param links - For a roll from a link in a description, the links the game acts on in that
 *   description, as held here; none where it isn't held.
 * @param features - What else the campaign's game does with its players' rolls, as its hello
 *   said, such as `signedDice`; none, as a module before 0.21.0, unless said.
 * @returns Why not, or nothing when it can.
 */
export function checkRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  actorId: string,
  links?: ReadonlyMap<number, FoundLink>,
  features: readonly string[] = [],
): RollRefusal | undefined {
  if (input.item !== undefined && Object.hasOwn(CHECK_TYPES, input.kind)) {
    return checkActivityRoll(input, sheet)
  }
  const linked = () =>
    input.text === undefined
      ? undefined
      : checkLinked(input, sheet, links, features)
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
      return checkLinked(input, sheet, links, features)
    }
    case 'tool': {
      // A description's tool check is made as dnd5e makes one, with the tool or without it.
      if (input.text !== undefined) {
        return checkLinked(input, sheet, links, features)
      }
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
      return sheet
        ? checkUse(input, sheet, combats, actorId, features)
        : 'unknown'
    }
    case 'hitDie': {
      return checkHitDie(input, sheet)
    }
    case 'hitDice': {
      return checkHitDice(input, sheet)
    }
    case 'formula': {
      return sheet ? checkFormula(input, sheet) : 'unknown'
    }
    // Checked against its attack or use, by checkDamage.
    case 'damage': {
      return undefined
    }
    case 'endEnchantment': {
      return checkEnding(input, sheet)
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
  const casts = castIndex(sheet)
  const slot = checkSlot(input, action, sheet, casts)
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
    const { base, level } = levelsOf(input, action, sheet, casts)
    if (input.targets.length > mostTargets(area, base, level)) {
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
 * can see? An enchant activity is used at no one, its user neither, as `checkEnchant` says. One
 * made at its user too, from module 0.22.0, is only where the game makes it so, of one with
 * targets beyond its user, whose own combatant isn't among them too, and counts as one of them.
 * Whatever else it spends, such as its uses, the game checks as it would spend it.
 * @param actorId - The character's actor, whose combatant is its user.
 * @param features - What else the campaign's game does with its players' rolls.
 */
function checkUse(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
  actorId: string,
  features: readonly string[],
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, activity }) => id === input.item && activity?.id === input.activity,
  )
  if (!action?.activity || !action.identified) return 'unknown'
  const casts = castIndex(sheet)
  const slot = checkSlot(input, action, sheet, casts)
  if (slot) return slot
  if (action.activity.type === 'enchant') {
    // It's used at no one, its user neither, as the game refuses.
    if (input.self) return 'target'
    return checkEnchant(input, action, sheet, casts)
  }
  // Only an enchant activity enchants.
  if (input.enchant !== undefined) return 'unknown'
  const targets = input.targets ?? []
  const { base, level } = levelsOf(input, action, sheet, casts)
  const self = input.self === true
  if (self && checkSelf(targets, action, combats, actorId, features)) {
    return 'target'
  }
  const most = mostTargets(action.activity.targets, base, level)
  if (targets.length + (self ? 1 : 0) > most) return 'target'
  return checkTargets(targets, combats)
}

/**
 * Can't a use be made at its user too, besides these targets: where the game doesn't make one so,
 * as before module 0.22.0; where it's one used on its user alone, which needs no asking; or where
 * the character's own combatant is among its targets already?
 */
function checkSelf(
  targets: AttackTarget[],
  action: SheetAction,
  combats: CombatSnapshot[],
  actorId: string,
  features: readonly string[],
): boolean {
  if (!features.includes('selfTargets') || action.activity?.targets.self) {
    return true
  }
  return targets.some(
    target =>
      combats
        .find(({ id }) => id === target.combatId)
        ?.combatants.find(({ id }) => id === target.combatantId)?.character ===
      actorId,
  )
}

/**
 * Can the character use this enchant activity so: at no one, as it enchants an item; in one of the
 * ways it offers, chosen, and for one offered only at some spell levels, such as Magic Weapon's
 * +2, at the level it's cast at, with the slot, or a spell an item casts at the level, chosen,
 * where there's a choice; and on one of the items it may enchant, or none, to leave on its card,
 * but never another for one that enchants its own item, nor in the way it's on its own item in
 * already, which only a sheet out of date offers, and which dnd5e would take as ending it, at a
 * cost? Whether the item may take it still is the game's to check, as dnd5e's rules for it say.
 */
function checkEnchant(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): RollRefusal | undefined {
  const enchant = action.activity?.enchant
  if (!enchant) return 'unknown'
  if ((input.targets ?? []).length > 0) return 'target'
  const chosen = input.enchant
  if (!chosen) return 'profile'
  const profile = enchant.profiles.find(({ id }) => id === chosen.profile)
  if (!profile) return 'profile'
  if (profile.min !== null || profile.max !== null) {
    const chooses =
      (slotPools(action, sheet.spells)?.length ?? 0) > 0 ||
      (castOf(action, casts)?.levels?.length ?? 0) > 0
    if (chooses && !input.slot) return 'profile'
    const level = castAtLevel(action, sheet.spells, input.slot, casts)
    if (
      level === null ||
      (profile.min !== null && level < profile.min) ||
      (profile.max !== null && level > profile.max)
    ) {
      return 'profile'
    }
  }
  const { item } = chosen
  const offered = enchant.self
    ? item === undefined
    : item === undefined || enchant.items.includes(item)
  if (!offered) return 'enchant-target'
  const on =
    enchant.self &&
    enchant.applied.some(applied => applied.profile === chosen.profile)
  return on ? 'applied' : undefined
}

/**
 * Can the character end this enchantment: is it on one of its inventory items, spells, features or
 * actions' items, as the sheet lists the enchantments on them, and one the player may end?
 */
function checkEnding(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const { enchantment } = input
  if (!sheet || !enchantment) return 'enchantment'
  const enchanted: { id: string; enchantments?: SheetEnchantment[] }[] = [
    ...allItems(sheet),
    ...sheet.spells.flatMap(section => section.spells),
    ...sheet.features.flatMap(section => section.features),
    ...sheet.actions.flatMap(section => section.actions),
  ]
  const endable = enchanted.some(
    ({ id, enchantments }) =>
      id === enchantment.item &&
      !!enchantments?.some(
        ({ id: effect, endable }) => effect === enchantment.effect && endable,
      ),
  )
  return endable ? undefined : 'enchantment'
}

/**
 * The level a spell is cast at, and the level more targets are counted from, cast higher: its
 * own, or for a spell an item casts, the level it's cast at by default.
 */
function levelsOf(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): { base: number | null; level: number | null } {
  return {
    base: castOf(action, casts)?.level ?? action.level,
    level: castAtLevel(action, sheet.spells, input.slot, casts),
  }
}

/**
 * Can a spell be cast with the slot chosen: one of the spell's pools, with one left? With none
 * chosen, has it any slot, or use of its own, left? A slot chosen for a spell cast without slots,
 * such as an innate one, is the game's to leave out. One of its activities used without spending a
 * slot, such as Spirit Guardians' save each turn, may be used at any of its pools' levels. A spell
 * an item casts, and each of its activities, is cast at one of the levels the item offers, from
 * module 0.20.0, and never with a slot otherwise; whether the item has the charges for it is the
 * game's to check, as it spends them.
 */
function checkSlot(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): RollRefusal | undefined {
  const cast = castOf(action, casts)
  if (cast && input.slot) {
    const { slot } = input
    const offered =
      /^spell[1-9]$/.test(slot) &&
      !!cast.levels?.some(({ level }) => `spell${level}` === slot)
    return offered ? undefined : 'slot'
  }
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
 * Has the character, for each size of hit die spent at once, classes with hit dice of that size,
 * with as many of them left as are spent, all together? How many are left of a class whose sheet
 * doesn't say is the game's to check, for that size; and whether the character is at full hit
 * points, which the game checks as it spends them.
 */
function checkHitDice(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  for (const { denomination, count } of input.hitDice ?? []) {
    const sized = (sheet?.classes ?? []).flatMap(({ hitDice }) =>
      hitDice && hitDice.die === denomination ? [hitDice] : [],
    )
    if (sized.length === 0) return 'unknown'
    if (sized.some(({ value }) => value === null)) continue
    const left = sized.reduce((all, { value }) => all + (value ?? 0), 0)
    if (left < count) return 'no-hit-dice'
  }
  return undefined
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
 * attack's damage may be, where the game takes it so, its first die, where the game changes only
 * one it adds (`signedDice`), else only where that's its first die whatever its sign, and damage,
 * never healing nor damage the game marks as never one, as a critical hit's, its dice thrown as
 * many times as the world's rules say, where the sheet says, with the dice a critical hit adds, as
 * they throw them; and a roll of its own as its formula throws. The game reads the link again from
 * its own copy, so nothing it asks for is taken from the app.
 */
function checkLinked(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
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
      // Healing is never a critical hit's, nor damage the game marks as never one, without what
      // one adds, which a module from 0.20.0 marks so only for apps before.
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
      // A critical hit's only as the world's rules make it, where the sheet says how, and where
      // one is offered, as where they say how they throw the dice it adds; then with what it adds.
      const rule = input.critical ? sheet.critical : undefined
      if (input.critical && !rule) return 'dice'
      const adds = rule ? criticalOffered(damage, rule) : undefined
      if (adds === false) return 'dice'
      // A part the app can't read, it couldn't have rolled.
      const preview = linkDamage(damage, rule ?? undefined, adds)
      // Never at its highest where it takes a die away, which that would take the most of, nor
      // where a die explodes, or is rerolled on its highest face, whose highest isn't known.
      if (
        input.modifiers?.maximize &&
        preview &&
        (diceTakenAway(preview) || unmaximizable(preview))
      ) {
        return 'dice'
      }
      // Its first die changed only where the game changes that one, as a module before 0.21.0,
      // which changes its first die whatever its sign, does only where that's one it adds.
      const planned =
        preview &&
        modifiedDice(preview, input.modifiers, features.includes('signedDice'))
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

/**
 * Is this a check an activity asks for that the character makes itself: the activity of one of its
 * actions, favorites, spells, features or inventory items, identified, whose check is its own to
 * make, rolled one of the ways that check may be made, by its kind and its skill's, tool's or
 * ability's key? The sheet's own skills and tools aren't looked at: dnd5e makes a tool's check with
 * the tool or without it, and the game reads the check again from the activity.
 */
function checkActivityRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  if (!sheet) return 'unknown'
  const type = CHECK_TYPES[input.kind as keyof typeof CHECK_TYPES]
  const offered = sheetActions(sheet).some(
    ({ id, activity, check, identified }) =>
      id === input.item &&
      activity?.id === input.activity &&
      identified &&
      check?.own === true &&
      check.checks.some(
        option =>
          option.type === type && (option.key ?? option.ability) === input.key,
      ),
  )
  return offered ? undefined : 'unknown'
}

/**
 * The kind of option a check a description or an activity calls for has, for each kind of roll
 * that makes one.
 */
const CHECK_TYPES = {
  skill: 'skill',
  tool: 'tool',
  ability: 'check',
} as const satisfies Partial<Record<RollKind, CheckOption['type']>>

/**
 * Are a roll's dice those a formula throws, in order: the same kinds of dice, as many of each, as
 * first thrown? Foundry throws again itself any die it rerolls or explodes.
 */
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
 * its dice those it said its damage throws, in order, each die's first throw, changed as the player
 * chose, if they did, never at its highest where it takes a die away, or a die explodes or is
 * rerolled on its highest face; and is each kind of damage chosen one its roll offers?
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
  // Never at its highest where it takes a die away, nor where a die explodes, or is rerolled on its
  // highest face, whose highest isn't known.
  if (
    input.modifiers?.maximize &&
    (diceTakenAway(damage) || unmaximizable(damage))
  ) {
    return 'dice'
  }
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

/**
 * A roll as its player is told of it: where it stands, and what the game made of it. Of hit dice
 * spent at once, how many the game made, where it made some: all of them, where their player may
 * see them, or where it stopped part way, even where they can't; and where they can, what those it
 * made came to, all together, and gave back. Of an enchant activity used, or an enchantment ended,
 * what it applied and ended, seen or not; and of one that failed, whether no card of it is left.
 */
export function toRollRequestView(
  request: HeldRollRequest,
  now = Date.now(),
): RollRequestView {
  const status = rollStatus(request, now)
  const result = request.result as CommandResult | null
  const spent = result?.spent ? { spent: result.spent } : {}
  if (status === 'failed') {
    const reason = result?.reason ?? undefined
    if (!result?.spent || result.spent.made === 0) {
      return { id: request.id, status, reason, ...cardless(result) }
    }
    if (!result.visible) {
      return { id: request.id, status, reason, visible: false, ...spent }
    }
    const rolls = result.rolls.map(roll => toTableRoll(roll))
    return {
      id: request.id,
      status,
      reason,
      visible: true,
      total: sumOf(rolls, request.kind),
      rolls,
      ...(typeof result.healed === 'number' ? { healed: result.healed } : {}),
      ...spent,
    }
  }
  if (status !== 'done' || !result) return { id: request.id, status }
  // An attack's or a use's damage is the player's to roll, even of one they can't see; and what an
  // enchant activity did to their items is theirs to know.
  const damage = result.damage === undefined ? {} : { damage: result.damage }
  const use = result.use ? { use: result.use } : {}
  const enchantment = result.enchantment
    ? { enchantment: result.enchantment }
    : {}
  if (!result.visible)
    return {
      id: request.id,
      status,
      visible: false,
      ...use,
      ...damage,
      ...enchantment,
    }
  const rolls = result.rolls.map(roll => toTableRoll(roll))
  return {
    id: request.id,
    status,
    visible: true,
    total: SUMMED.has(request.kind)
      ? sumOf(rolls, request.kind)
      : (rolls[0]?.total ?? undefined),
    rolls,
    ...(result.attack ? { attack: result.attack } : {}),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    ...(typeof result.healed === 'number' ? { healed: result.healed } : {}),
    ...use,
    ...damage,
    ...enchantment,
    ...spent,
  }
}

/**
 * What a roll of the Gamemaster's as a character is called on its player's page (#156) where their
 * page didn't say, as before it did: by its kind.
 */
const GM_ROLL_KINDS: Record<RollKind, string> = {
  skill: 'A check',
  ability: 'A check',
  tool: 'A check',
  save: 'A saving throw',
  death: 'A death saving throw',
  initiative: 'Initiative',
  attack: 'An attack',
  damage: 'Damage',
  use: 'A use',
  hitDie: 'Hit dice',
  hitDice: 'Hit dice',
  formula: 'A roll',
  textRoll: 'A roll',
  textDamage: 'Damage',
  ask: 'A roll asked of the table',
  endEnchantment: 'An enchantment ended',
}

/** The rolls of a d20, whose first roll the game may say came up a critical or a fumble. */
const D20_KINDS: ReadonlySet<string> = new Set([
  'skill',
  'ability',
  'tool',
  'save',
  'death',
  'initiative',
  'attack',
])

/**
 * A roll the campaign's Gamemaster made as a character (#156), as its player is shown it beside
 * their own: what it's called, as the Gamemaster's page said, or else its kind; when it was sent;
 * and what the game made of it as the player is told of their own (`toRollRequestView`), hidden as
 * the game hid it, but none of its dice, and never the damage that follows an attack or a use,
 * which the Gamemaster rolls. A roll of a d20 the game made where its player may see it also says
 * whether the game called its first roll a critical or a fumble; and damage, whether it's healing,
 * as the game said of the attack or use it follows, or else of every roll it made of it.
 * @param request - Held with its label: text the Gamemaster's page sent, shown as no more.
 * @param heals - For damage, whether the game said healing follows the attack or use it follows.
 */
export function toGmRollView(
  request: HeldRollRequest & { label: string | null },
  now = Date.now(),
  heals = false,
): GmRollView {
  const view = toRollRequestView(request, now)
  const kind = request.kind as RollKind
  const first = view.visible ? view.rolls?.[0] : undefined
  let d20: GmRollView['d20']
  if (D20_KINDS.has(kind) && first?.critical) d20 = 'critical'
  else if (D20_KINDS.has(kind) && first?.fumble) d20 = 'fumble'
  const healing =
    (kind === 'damage' || kind === 'textDamage') &&
    (heals || healingRolls(view.rolls ?? []))
  return {
    id: view.id,
    kind,
    label: request.label ?? GM_ROLL_KINDS[kind] ?? 'A roll',
    at: request.createdAt.toISOString(),
    status: view.status,
    ...(view.reason !== undefined && { reason: view.reason }),
    ...(view.visible !== undefined && { visible: view.visible }),
    ...(view.total !== undefined && { total: view.total }),
    ...(view.attack && { attack: view.attack }),
    ...(view.outcome && { outcome: view.outcome }),
    ...(view.healed !== undefined && { healed: view.healed }),
    ...(view.spent && { spent: view.spent }),
    ...(view.enchantment && { enchantment: view.enchantment }),
    ...(d20 && { d20 }),
    ...(healing && { healing }),
  }
}

/**
 * Of a use of an enchant activity that failed, from module 0.21.0, whether the game names no card
 * of it, from which the Gamemaster could apply its enchantment: none was posted, as where a hook
 * stopped dnd5e's; it was deleted, as Midi deletes one it stops; or dnd5e lets no one apply it
 * from the card, as one naming a concentration that has since ended.
 */
function cardless(result: CommandResult | null): { card?: false } {
  const enchanting =
    result?.reason === 'enchant' || result?.use?.type === 'enchant'
  return enchanting && result?.messageId === null ? { card: false } : {}
}

/**
 * The rolls whose total is all of their rolls' added up: damage's parts, as dnd5e's card adds
 * damage up, or hit dice's cards.
 */
const SUMMED = new Set(['damage', 'textDamage', 'hitDice'])

/**
 * Damage's total, or hit dice's, when the game said each of its rolls': hit dice's added up; and
 * damage's or healing's as dnd5e's card adds damage up: each kind's rolls together, each kind at
 * least 0, then every kind. Each roll's own total stays the game's.
 */
function sumOf(
  rolls: { total: number | null; damageType?: string }[],
  kind: string,
): number | undefined {
  if (rolls.length === 0 || rolls.some(roll => roll.total === null))
    return undefined
  if (kind !== 'damage' && kind !== 'textDamage') {
    return rolls.reduce((sum, roll) => sum + (roll.total ?? 0), 0)
  }
  const kinds = new Map<string | undefined, number>()
  for (const { total, damageType } of rolls) {
    kinds.set(damageType, (kinds.get(damageType) ?? 0) + (total ?? 0))
  }
  return [...kinds.values()].reduce((sum, each) => sum + Math.max(0, each), 0)
}

/** A held roll as the module is sent it. */
export function toCommand(request: HeldRollRequest): RollCommand {
  return {
    ...(request.payload as RollRequestInput),
    id: request.id,
    actorId: request.actorId,
    ...(request.role === 'gm' ? { by: 'gm' as const } : {}),
  }
}
