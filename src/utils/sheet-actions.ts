/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { favoriteEntries, type FavoriteEntry } from '@/utils/favorites'
import { allItems } from '@/utils/sheet-texts'
import type {
  SheetAction,
  SheetFeature,
  SheetItem,
  SheetRolls,
  SheetSpell,
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
 * activities, then its spells, features and inventory items, so that an attack or a use is found
 * wherever it was made from, and checked as it would be made.
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
  ]
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
  const rolls: SheetRolls = {
    toHit: entry.toHit ?? null,
    attackId: inGame ? (entry.attackId ?? null) : null,
    activity: inGame ? (entry.activity ?? null) : null,
    attackModes: entry.attackModes ?? null,
    ammunition: entry.ammunition ?? null,
    save: entry.save ?? null,
    damage: entry.damage ?? [],
  }
  const any =
    rolls.toHit !== null ||
    !!rolls.activity ||
    rolls.save !== null ||
    rolls.damage.length > 0
  return any ? rolls : undefined
}

function present<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value]
}
