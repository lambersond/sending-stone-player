/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { favoriteEntries, type FavoriteEntry } from '@/utils/favorites'
import { allItems } from '@/utils/sheet-texts'
import type {
  SheetAction,
  SheetActivity,
  SheetFeature,
  SheetItem,
  SheetRolls,
  SheetSpell,
  SheetSpellSection,
} from '@/types/sending-stone'

/*
 * What a character can roll, or use in the Gamemaster's game, wherever its sheet lists it: its
 * actions, and the spells, features and inventory items that roll or are used through anything,
 * each as an action, as the Actions tab would have it.
 */

/** The parts of the sheet things are rolled and used from. */
type RollingSheet = Parameters<typeof favoriteEntries>[0]

/**
 * Everything the character can roll or use, as actions: its actions, then its favorite
 * activities, then its spells, features and inventory items, each followed by its other
 * activities, so that an attack or a use is found wherever it was made from, and checked as it
 * would be made.
 * @param entries - Its favorites, when they're at hand.
 */
export function sheetActions(
  sheet: RollingSheet,
  entries: FavoriteEntry[] = favoriteEntries(sheet),
): SheetAction[] {
  return [
    ...sheet.actions.flatMap(section => section.actions),
    ...entries.flatMap(entry =>
      entry.kind === 'action' ? [entry.action] : [],
    ),
    ...sheet.spells.flatMap(section =>
      section.spells.flatMap(spell => present(spellAction(spell))),
    ),
    ...sheet.features.flatMap(section =>
      section.features.flatMap(feature => present(featureAction(feature))),
    ),
    ...allItems(sheet).flatMap(item => present(itemAction(item))),
  ].flatMap(action => [action, ...activityActions(action)])
}

/**
 * The other activities of an action with more than one, such as Hex's Bonus Hex Damage after its
 * curse, each as an action of its own; none for one with one.
 */
export function activityActions(action: SheetAction): SheetAction[] {
  return (action.activities ?? [])
    .slice(1)
    .map(activity => activityAction(action, activity))
}

/**
 * One of an action's activities as an action of its own, as an activity made a favorite is: the
 * item's, rolling and used as that activity alone, and named for both, such as "Hex (Bonus Hex
 * Damage)", for its rolls.
 */
export function activityAction(
  action: SheetAction,
  activity: SheetActivity,
): SheetAction {
  return {
    id: action.id,
    name:
      activity.name && activity.name !== action.name
        ? `${action.name} (${activity.name})`
        : action.name,
    img: action.img,
    type: action.type,
    activation: activity.activation,
    range: activity.range,
    target: activity.target,
    toHit: activity.toHit,
    attackId: activity.attackId ?? null,
    activity: activity.activity ?? null,
    attackModes: activity.attackModes ?? null,
    ammunition: activity.ammunition ?? null,
    save: activity.save,
    damage: activity.damage,
    ...(activity.consumesSlot === false && { consumesSlot: false }),
    ...(activity.cast && { cast: activity.cast }),
    ...(activity.rollFormula && { rollFormula: activity.rollFormula }),
    ...(activity.attackArea && { attackArea: activity.attackArea }),
    ...(activity.activationType !== undefined && {
      activationType: activity.activationType,
    }),
    uses: activity.uses,
    level: action.level,
    // A spell the item casts is cast from it.
    castFrom: activity.cast
      ? { id: action.id, name: action.name }
      : (action.castFrom ?? null),
    // A spell cast from the item takes concentration as the spell does.
    concentration: activity.cast?.concentration ?? action.concentration,
    identified: action.identified,
    text: action.text,
  }
}

/**
 * dnd5e's copy of a spell an item casts, as the Spells tab lists it under the item: the one with
 * the description given, where just one has it; or else the one of the name given, where just one
 * has it, as dnd5e names a Cast activity for its spell; or else, for a Cast activity, the item's
 * only spell, as for one renamed, such as "Cast Fireball", where that can be its own. None where
 * that leaves more than one.
 */
export function itemSpellOf(
  spellbook: SheetSpellSection[],
  itemId: string,
  {
    name,
    text,
    casts,
    resolved = false,
  }: {
    /** The activity's name. */
    name?: string | null
    /** The spell's description's hash, where the module sent it. */
    text?: string | null
    /** Whether the activity is a Cast. */
    casts: boolean
    /** Whether the module found the spell it casts, as it says how it's cast where it did. */
    resolved?: boolean
  },
): SheetSpell | undefined {
  const copies = spellbook
    .flatMap(section => section.spells)
    .filter(spell => spell.castFrom?.id === itemId)
  const only = (spells: SheetSpell[]) =>
    spells.length === 1 ? spells[0] : undefined
  const lone = casts ? only(copies) : undefined
  return (
    (text ? only(copies.filter(spell => spell.text === text)) : undefined) ??
    (name ? only(copies.filter(spell => spell.name === name)) : undefined) ??
    // The item's only spell is the Cast's own where the module found the spell, or where the copy
    // can't be cast now, as the module then sends nothing of it. Else it may be another Cast's,
    // and this one's spell not set or lost, which dnd5e makes no copy of.
    (lone && (resolved || lone.castFrom?.usable === false) ? lone : undefined)
  )
}

/**
 * A spell as an action, for what it rolls: its attack, saving throw and damage or healing, and
 * while it's prepared, how the game casts it. One not prepared is rolled here only, as the game
 * would have it prepared first. Nothing for a spell that rolls nothing and is cast through
 * nothing, such as one that summons.
 */
export function spellAction(spell: SheetSpell): SheetAction | undefined {
  const rolls = rollsOf(spell, spell.prepared !== 0)
  return (
    rolls && {
      id: spell.id,
      name: spell.name,
      img: spell.img,
      type: 'spell',
      activation: spell.activation,
      range: spell.range,
      target: spell.target,
      ...rolls,
      uses: spell.uses,
      level: spell.level,
      castFrom: spell.castFrom ?? null,
      concentration: spell.concentration,
      identified: true,
      text: spell.text,
    }
  )
}

/**
 * A feature as an action, for what it rolls, and how the game uses it. Nothing for one that rolls
 * nothing and is used through nothing, such as a passive one.
 */
export function featureAction(feature: SheetFeature): SheetAction | undefined {
  const rolls = rollsOf(feature, true)
  return (
    rolls && {
      id: feature.id,
      name: feature.name,
      img: feature.img,
      type: 'feat',
      activation: feature.activation,
      range: feature.range ?? null,
      target: feature.target ?? null,
      ...rolls,
      uses: feature.uses,
      level: null,
      castFrom: null,
      concentration: feature.concentration ?? false,
      identified: true,
      text: feature.text,
    }
  )
}

/**
 * Something carried as an action, for what it rolls, and how the game uses it, whether it's
 * equipped or not, as dnd5e's inventory uses it. Nothing for one that rolls nothing and is used
 * through nothing, such as rope, or isn't identified yet.
 */
export function itemAction(item: SheetItem): SheetAction | undefined {
  const rolls = item.identified ? rollsOf(item, true) : undefined
  return (
    rolls && {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      activation: item.activation ?? null,
      range: item.range ?? null,
      target: item.target ?? null,
      ...rolls,
      uses: item.uses,
      level: null,
      castFrom: null,
      concentration: item.concentration ?? false,
      identified: true,
      text: item.text,
    }
  )
}

/**
 * What something rolls, as an action has it, with the attack and activity the game makes it
 * through only while it may; or nothing, when that leaves nothing to roll or use.
 * @param inGame - Whether the game may make its attack, or use it.
 */
function rollsOf(
  entry: Partial<SheetRolls>,
  inGame: boolean,
): SheetRolls | undefined {
  const activities = entry.activities ?? []
  const rolls: SheetRolls = {
    toHit: entry.toHit ?? null,
    attackId: inGame ? (entry.attackId ?? null) : null,
    activity: inGame ? (entry.activity ?? null) : null,
    attackModes: entry.attackModes ?? null,
    ammunition: entry.ammunition ?? null,
    save: entry.save ?? null,
    damage: entry.damage ?? [],
    ...(entry.consumesSlot === false && { consumesSlot: false }),
    ...(entry.cast && { cast: entry.cast }),
    ...(entry.rollFormula && { rollFormula: entry.rollFormula }),
    ...(entry.attackArea && { attackArea: entry.attackArea }),
    // Each of its activities, for one with more than one, made in the game only while it may be.
    ...(activities.length > 1 && {
      activities: inGame
        ? activities
        : activities.map(activity => ({
            ...activity,
            attackId: null,
            activity: null,
          })),
    }),
  }
  const any = [rolls, ...(rolls.activities ?? [])].some(
    each =>
      each.toHit !== null ||
      !!each.activity ||
      each.save !== null ||
      each.damage.length > 0 ||
      !!each.rollFormula,
  )
  return any ? rolls : undefined
}

function present<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value]
}
