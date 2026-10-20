/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { allItems } from '@/utils/sheet-texts'
import type {
  CharacterSheet,
  SheetAction,
  SheetActivityFavorite,
  SheetClass,
  SheetContainer,
  SheetEffect,
  SheetFavorite,
  SheetFeature,
  SheetItem,
  SheetItemFavorite,
  SheetResourceFavorite,
  SheetRolls,
  SheetSkill,
  SheetSlotsFavorite,
  SheetSpell,
} from '@/types/sending-stone'

/**
 * A favorite, with what it refers to on the rest of the sheet, so that it can be shown as the
 * sheet shows that elsewhere. An item is shown as an action if it's one, rolled as the Actions tab
 * rolls it; otherwise as a spell, as something carried, as a feature or as a class. An activity is
 * shown as an action, for that activity alone. A skill or a tool rolls as the Character tab rolls a
 * skill. An old-style resource that stands for a feature is shown as that feature, as an action if
 * it's one, with the resource's uses; one that stands for none is a counter of its own.
 */
export type FavoriteView =
  | {
      kind: 'action'
      action: SheetAction
      /** What to say of it first, such as the item an activity is one of. */
      note?: string
      /** The resource it stands for, whose uses it shows in place of its own. */
      resource?: SheetResourceFavorite
    }
  | { kind: 'spell'; spell: SheetSpell }
  | { kind: 'item'; item: SheetItem | SheetContainer }
  | {
      kind: 'feature'
      feature: SheetFeature
      /** The resource it stands for, whose uses it shows in place of its own. */
      resource?: SheetResourceFavorite
    }
  | { kind: 'class'; entry: SheetClass }
  | { kind: 'effect'; effect: SheetEffect; suppressed: boolean }
  | {
      kind: 'check'
      check: SheetSkill
      /** A skill's or a tool's, for the Gamemaster's game to roll it too. */
      source: { kind: 'skill' | 'tool'; key: string }
    }
  | { kind: 'slots'; slots: SheetSlotsFavorite }
  | { kind: 'resource'; resource: SheetResourceFavorite }
  /** An item the sheet lists nowhere else, such as a background. */
  | { kind: 'other'; item: SheetItemFavorite }

/** A favorite as it's shown, by a key unique among them. */
export type FavoriteEntry = FavoriteView & { key: string }

/** The sheet's lists, by id, to find what a favorite refers to. */
type Index = {
  actions: Map<string, SheetAction>
  spells: Map<string, SheetSpell>
  items: Map<string, SheetItem | SheetContainer>
  features: Map<string, SheetFeature>
  /** The features, in the order the sheet lists them. */
  listed: SheetFeature[]
  classes: Map<string, SheetClass>
  effects: Map<string, SheetEffect>
  skills: Map<string, SheetSkill>
}

/**
 * The character's favorites, in their order, each with what it refers to. One that refers to
 * nothing the sheet has any longer, such as a skill a later system dropped, is left out, as is one
 * listed twice. A resource that stands for a feature is that feature's row, in the resource's
 * place, which dnd5e gives first: a favorite of the feature after it is left out, as it's shown,
 * but not one of its activities, which is a row of its own.
 */
export function favoriteEntries(
  sheet: Pick<
    CharacterSheet,
    | 'actions'
    | 'spells'
    | 'inventory'
    | 'features'
    | 'classes'
    | 'effects'
    | 'skills'
    | 'favorites'
  >,
): FavoriteEntry[] {
  const index = indexOf(sheet)
  const seen = new Set<string>()
  // The features resources stand for, each for one at most.
  const claimed = new Set<string>()
  return sheet.favorites.flatMap(favorite => {
    const linked =
      favorite.type === 'resource'
        ? linkedEntry(favorite, index, claimed)
        : undefined
    if (linked && !seen.has(linked.key)) {
      seen.add(linked.key)
      return [linked]
    }
    // A resource that stands for none, or for a feature already shown, is a counter.
    const key = `${favorite.type}:${favorite.id}`
    if (seen.has(key)) return []
    seen.add(key)
    const entry = entryOf(favorite, index)
    return entry ? [{ key, ...entry }] : []
  })
}

/** The kinds of favorite marked where the sheet lists them elsewhere. */
const MARKED: ReadonlySet<SheetFavorite['type']> = new Set([
  'item',
  'effect',
  'skill',
])

/**
 * What's marked as a favorite where the sheet lists it elsewhere: items, effects and skills, by
 * keys such as "item:<id>", and the features resources stand for, among the favorites' entries. An
 * activity marks no item, as dnd5e's sheet marks none.
 */
export function favoriteKeys(
  favorites: SheetFavorite[],
  entries: FavoriteEntry[] = [],
): Set<string> {
  return new Set([
    ...favorites.flatMap(({ type, id }) =>
      MARKED.has(type) ? [`${type}:${id}`] : [],
    ),
    ...entries.flatMap(entry =>
      (entry.kind === 'action' || entry.kind === 'feature') && entry.resource
        ? [entry.key]
        : [],
    ),
  ])
}

/**
 * A name as a resource's and a feature's are compared, as the module compares them from 0.23.0:
 * without case, runs of spacing as one, and typographic apostrophes as plain ones, so that
 * "Warden’s Ward" and "Warden's Ward" are one name.
 */
export function foldName(name: string): string {
  return name
    .normalize('NFKC')
    .replaceAll(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * What a feature's row says first where it stands for a resource of another name, such as a pool
 * one of its activities spends: the resource's name. Nothing where they share theirs.
 */
export function resourceNote(
  resource: SheetResourceFavorite | undefined,
  name: string,
): string | undefined {
  return resource && foldName(resource.name) !== foldName(name)
    ? resource.name
    : undefined
}

/**
 * Does any favorite roll, as an attack, damage or healing, a formula, or a check does: an action,
 * or a spell, something carried or a feature that rolls, or a class whose hit dice are spent?
 */
export function rollsAny(entries: FavoriteEntry[]): boolean {
  return entries.some(entry => {
    switch (entry.kind) {
      case 'check': {
        return true
      }
      case 'class': {
        return !!entry.entry.hitDice
      }
      case 'action': {
        return rolls(entry.action)
      }
      case 'spell': {
        return rolls(entry.spell)
      }
      case 'item': {
        return entry.item.identified && rolls(entry.item)
      }
      case 'feature': {
        return rolls(entry.feature)
      }
      default: {
        return false
      }
    }
  })
}

/**
 * Does this roll an attack, damage or healing, a formula of its own, or a check an activity asks
 * of the character?
 */
function rolls(entry: Partial<SheetRolls>): boolean {
  return (
    (entry.toHit ?? null) !== null ||
    (entry.damage ?? []).length > 0 ||
    !!entry.rollFormula ||
    entry.check?.own === true ||
    (entry.activities ?? []).some(activity => rolls(activity))
  )
}

function entryOf(
  favorite: SheetFavorite,
  index: Index,
): FavoriteView | undefined {
  switch (favorite.type) {
    case 'item': {
      return itemEntry(favorite, index)
    }
    case 'activity': {
      return { kind: 'action', ...activityAction(favorite, index) }
    }
    case 'effect': {
      const effect = index.effects.get(favorite.id) ?? {
        // One the Effects tab doesn't list, such as a condition's.
        id: favorite.id,
        name: favorite.name,
        img: favorite.img,
        source: null,
        duration: null,
        disabled: favorite.disabled,
        text: null,
      }
      return { kind: 'effect', effect, suppressed: favorite.suppressed }
    }
    case 'skill': {
      const skill = index.skills.get(favorite.id)
      return (
        skill && {
          kind: 'check',
          check: skill,
          source: { kind: 'skill', key: skill.id },
        }
      )
    }
    case 'tool': {
      const { id, name, ability, total, passive, proficiency, mode } = favorite
      return {
        kind: 'check',
        check: {
          id,
          label: name,
          ability: ability ?? '',
          total,
          passive,
          proficiency,
          mode,
        },
        source: { kind: 'tool', key: id },
      }
    }
    case 'slots': {
      return { kind: 'slots', slots: favorite }
    }
    case 'resource': {
      return { kind: 'resource', resource: favorite }
    }
  }
}

/**
 * A resource as the feature it stands for: that feature's row, as a favorite of it would be, with
 * the resource; or nothing for one that stands for none.
 */
function linkedEntry(
  resource: SheetResourceFavorite,
  index: Index,
  claimed: Set<string>,
): FavoriteEntry | undefined {
  const feature = resourceFeature(resource, index, claimed)
  if (!feature) return undefined
  const { id, name, img } = feature
  const view = itemEntry(
    { type: 'item', id, itemType: 'feat', name, img },
    index,
  )
  if (view.kind !== 'action' && view.kind !== 'feature') return undefined
  return { key: `item:${id}`, ...view, resource }
}

/**
 * The feature a resource stands for, not yet taken by another: the one the module names, from
 * 0.23.0, whose null stands for none; or before, the first the sheet lists of the resource's name.
 */
function resourceFeature(
  { name, itemId }: SheetResourceFavorite,
  index: Index,
  claimed: Set<string>,
): SheetFeature | undefined {
  if (itemId === null) return undefined
  const folded = foldName(name)
  const feature =
    itemId === undefined
      ? index.listed.find(
          listed => !claimed.has(listed.id) && foldName(listed.name) === folded,
        )
      : index.features.get(itemId)
  if (!feature || claimed.has(feature.id)) return undefined
  claimed.add(feature.id)
  return feature
}

/**
 * An item, as the sheet lists it: as an action if it's one, then as a spell, as something carried,
 * as a feature or as a class.
 */
function itemEntry(favorite: SheetItemFavorite, index: Index): FavoriteView {
  const { id } = favorite
  const action = index.actions.get(id)
  const item = index.items.get(id)
  if (action) {
    return { kind: 'action', action, note: actionNote(action, item) }
  }
  const spell = index.spells.get(id)
  if (spell) return { kind: 'spell', spell }
  if (item) return { kind: 'item', item }
  const feature = index.features.get(id)
  if (feature) return { kind: 'feature', feature }
  const entry = index.classes.get(id)
  if (entry) return { kind: 'class', entry }
  return { kind: 'other', item: favorite }
}

/**
 * What the Actions tab shows by an action's group, which a favorite shows by it instead: the item a
 * spell is cast from, and how many there are of a thing carried, such as potions.
 */
function actionNote(
  action: SheetAction,
  item: SheetItem | undefined,
): string | undefined {
  if (action.castFrom) return `From ${action.castFrom.name}`
  if (item && item.quantity !== 1) return `×${item.quantity}`
  return undefined
}

/**
 * An activity as an action: what it does, from the favorite, and of its item, from the rest of the
 * sheet, its spell level, whether it's identified, and its description. One of a spell not
 * prepared, or that its item can't cast now, is rolled here only, as on the Spells tab, as the game
 * would have it prepared, or the item able to cast it, first.
 */
function activityAction(
  favorite: SheetActivityFavorite,
  index: Index,
): { action: SheetAction; note?: string } {
  const { itemId } = favorite
  const action = index.actions.get(itemId)
  const spell = index.spells.get(itemId)
  const item = index.items.get(itemId)
  const feature = index.features.get(itemId)
  const inGame = spell?.prepared !== 0 && spell?.castFrom?.usable !== false
  return {
    action: {
      // The item's, as an action's is, by which its spell is found in the spellbook.
      id: itemId,
      name: favorite.name,
      img: favorite.img,
      type: favorite.itemType,
      activation: favorite.activation,
      range: favorite.range,
      target: favorite.target,
      toHit: favorite.toHit,
      attackId: inGame ? (favorite.attackId ?? null) : null,
      activity: inGame ? (favorite.activity ?? null) : null,
      attackModes: favorite.attackModes ?? null,
      ammunition: favorite.ammunition ?? null,
      save: favorite.save,
      damage: favorite.damage,
      ...(favorite.consumesSlot === false && { consumesSlot: false }),
      ...(favorite.cast && { cast: favorite.cast }),
      // For a Cast, its spell's copy, whose other activities are used beneath it.
      ...(favorite.spellId && { spellId: favorite.spellId }),
      ...(favorite.rollFormula && { rollFormula: favorite.rollFormula }),
      ...(favorite.attackArea && { attackArea: favorite.attackArea }),
      // The check it asks for, and what it spends where it uses another activity.
      ...(favorite.check && { check: favorite.check }),
      ...(favorite.forward && { forward: favorite.forward }),
      // A third d20 with advantage, where dnd5e gives its attack Elven Accuracy.
      ...(favorite.elvenAccuracy && { elvenAccuracy: true as const }),
      uses: favorite.uses,
      level: spell?.level ?? action?.level ?? null,
      // A spell the item casts is cast from it.
      castFrom: favorite.cast
        ? { id: itemId, name: favorite.itemName }
        : (action?.castFrom ?? spell?.castFrom ?? null),
      // A spell the item casts takes concentration as the spell does.
      concentration:
        favorite.cast?.concentration ??
        action?.concentration ??
        spell?.concentration ??
        false,
      identified: item?.identified ?? action?.identified ?? true,
      text: action?.text ?? spell?.text ?? item?.text ?? feature?.text ?? null,
    },
    note:
      favorite.itemName && favorite.itemName !== favorite.name
        ? favorite.itemName
        : undefined,
  }
}

/**
 * Each item as one action, as Favorites, which has no sections, shows it: an item the Actions tab
 * lists under each kind of action it has, such as a staff that strikes as an action and casts
 * Silvery Barbs as a reaction, is its row for its first activity, with every activity of its other
 * rows besides.
 */
function wholeActions(actions: SheetAction[]): Map<string, SheetAction> {
  const whole = new Map<string, SheetAction>()
  for (const action of actions) {
    const kept = whole.get(action.id)
    if (!kept) {
      whole.set(action.id, action)
      continue
    }
    const [first, other] =
      kept.activityName && !action.activityName
        ? [action, kept]
        : [kept, action]
    whole.set(action.id, {
      ...first,
      activities: [...(first.activities ?? []), ...(other.activities ?? [])],
    })
  }
  return whole
}

function indexOf(sheet: Parameters<typeof favoriteEntries>[0]): Index {
  const byId = <T extends { id: string }>(entries: T[]) =>
    new Map(entries.map(entry => [entry.id, entry]))
  const listed = sheet.features.flatMap(section => section.features)
  return {
    actions: wholeActions(sheet.actions.flatMap(section => section.actions)),
    spells: byId(sheet.spells.flatMap(section => section.spells)),
    items: byId(allItems(sheet)),
    features: byId(listed),
    listed,
    classes: new Map(
      sheet.classes.flatMap(entry => (entry.id ? [[entry.id, entry]] : [])),
    ),
    effects: byId(sheet.effects.flatMap(section => section.effects)),
    skills: byId(sheet.skills),
  }
}
