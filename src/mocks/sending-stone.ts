/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import type { NotePageCommand } from '@/db/note-sync'
import type { FoundrySettings, FoundrySnapshot } from '@/types/foundry-settings'
import type { NotesView } from '@/types/notes'
import type { GroupEntry, GroupSheet, PartyView } from '@/types/party'
import type { FavoriteTarget } from '@/types/roll'
import type {
  CharacterSheet,
  CombatantSummary,
  CommandResult,
  CombatSnapshot,
  CompanionEntry,
  ConnectedCharacter,
  JournalUpdated,
  KnownForm,
  SerializedMessage,
  SheetAbility,
  SheetAction,
  SheetActivity,
  SheetContainer,
  SheetCounter,
  SheetCreature,
  SheetEnchantment,
  SheetFavorite,
  SheetFeature,
  SheetForm,
  SheetInventory,
  SheetItem,
  SheetSpell,
  SheetUse,
  SheetUses,
  SheetWildShape,
  TableDamagePlan,
} from '@/types/sending-stone'
import type {
  CompanionView,
  TableCombat,
  TableMoves,
  TableView,
} from '@/types/table'

// Payloads shaped like the fvtt-sending-stone module's, for tests.

export const roster = [
  { id: 'actor-thorin', name: 'Thorin Oakenshield' },
  { id: 'actor-vex', name: 'Vex' },
]

export function chatMessage(
  fields: Partial<SerializedMessage> = {},
): SerializedMessage {
  return {
    id: 'm1',
    type: 'base',
    timestamp: Date.parse('2026-10-04T19:02:00Z'),
    speaker: { alias: 'Gamemaster', actorId: null },
    author: { id: 'u-gm', name: 'Gamemaster' },
    character: null,
    title: null,
    flavor: '',
    text: 'Roll initiative!',
    audience: { public: true, characters: ['actor-thorin', 'actor-vex'] },
    rolls: [],
    dnd5e: null,
    ...fields,
  }
}

export function combatant(
  fields: Partial<CombatantSummary> & { id: string },
): CombatantSummary {
  return {
    name: fields.id,
    initiative: 10,
    defeated: false,
    character: null,
    playerOwned: false,
    ...fields,
  }
}

export function combat(fields: Partial<CombatSnapshot> = {}): CombatSnapshot {
  return {
    id: 'cmbt1',
    name: null,
    active: true,
    started: true,
    round: 1,
    combatantId: 'c-boss',
    combatants: [
      combatant({
        id: 'c-boss',
        name: 'Goblin Boss',
        initiative: 19,
        disposition: 'hostile',
      }),
      combatant({
        id: 'c-thorin',
        name: 'Thorin Oakenshield',
        initiative: 17,
        character: 'actor-thorin',
        playerOwned: true,
        hp: { value: 31, max: 44, temp: 0 },
        disposition: 'friendly',
      }),
    ],
    ...fields,
  }
}

/**
 * A fight with someone of each disposition, as module 0.29.0 sends them: Thorin, his ally Vex, a
 * hireling the Gamemaster marked Friendly, a neutral merchant, a goblin, and a lurker whose token
 * is secret, so sent as null; with Gamemaster-only information, each with hit points.
 */
export function dispositionCombat(): CombatSnapshot {
  const hp = { value: 7, max: 7, temp: 0 }
  return combat({
    combatantId: 'c-thorin',
    combatants: [
      combatant({
        id: 'c-thorin',
        name: 'Thorin Oakenshield',
        initiative: 20,
        character: 'actor-thorin',
        playerOwned: true,
        hp: { value: 31, max: 44, temp: 0 },
        disposition: 'friendly',
      }),
      combatant({
        id: 'c-vex',
        name: 'Vex',
        initiative: 18,
        character: 'actor-vex',
        playerOwned: true,
        hp: { value: 22, max: 38, temp: 0 },
        // A charmed ally is still an ally.
        disposition: 'hostile',
      }),
      combatant({
        id: 'c-mira',
        name: 'Mira the Hireling',
        initiative: 15,
        hp,
        disposition: 'friendly',
      }),
      combatant({
        id: 'c-merchant',
        name: 'Merchant',
        initiative: 12,
        hp,
        disposition: 'neutral',
      }),
      combatant({
        id: 'c-goblin',
        name: 'Goblin',
        initiative: 9,
        hp,
        disposition: 'hostile',
      }),
      combatant({
        id: 'c-lurker',
        name: 'Lurker',
        initiative: 5,
        hp,
        disposition: null,
      }),
    ],
  })
}

function ability(
  id: string,
  label: string,
  score: number,
  fields: Partial<SheetAbility> = {},
): SheetAbility {
  const mod = Math.floor((score - 10) / 2)
  return {
    id,
    label,
    abbreviation: id.toUpperCase(),
    score,
    mod,
    check: mod,
    save: mod,
    saveProficient: false,
    checkMode: 0,
    saveMode: 0,
    ...fields,
  }
}

/** Thorin's sheet, as the module sends it under dnd5e. */
export function characterSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  return {
    img: 'worlds/erebor/thorin.webp',
    level: 5,
    classes: [{ name: 'Fighter', levels: 5, subclass: 'Champion' }],
    species: 'Dwarf',
    background: 'Soldier',
    hp: { value: 31, max: 44, temp: 0 },
    ac: 18,
    proficiency: 3,
    initiative: 1,
    speed: { value: 25, units: 'ft' },
    inspiration: false,
    abilities: [
      ability('str', 'Strength', 18, { save: 7, saveProficient: true }),
      ability('dex', 'Dexterity', 12),
      ability('con', 'Constitution', 16, { save: 6, saveProficient: true }),
      ability('int', 'Intelligence', 8),
      ability('wis', 'Wisdom', 13),
      ability('cha', 'Charisma', 10),
    ],
    skills: [
      {
        id: 'ath',
        label: 'Athletics',
        ability: 'str',
        total: 7,
        passive: 17,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'prc',
        label: 'Perception',
        ability: 'wis',
        total: 4,
        passive: 14,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'ste',
        label: 'Stealth',
        ability: 'dex',
        total: 1,
        passive: 11,
        proficiency: 0,
        mode: -1,
      },
    ],
    conditions: [],
    features: [],
    effects: [],
    inventory: {
      sections: [],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    spellcasting: null,
    spells: [],
    traits: [],
    deathSaves: null,
    details: {
      about: [],
      personality: [],
      appearance: null,
      xp: null,
      biography: null,
    },
    actions: [],
    favorites: [],
    ...fields,
  }
}

/** Hashes for descriptions, as the module names them: 14 hexadecimal digits. */
export const TEXTS = {
  fighter: '0f1a2b3c4d5e6f',
  secondWind: '1a2b3c4d5e6f70',
  actionSurge: '2b3c4d5e6f7081',
  poisoned: '3c4d5e6f708192',
  bless: '4d5e6f708192a3',
  warhammer: '5e6f708192a3b4',
  ring: '6f708192a3b4c5',
  backpack: '708192a3b4c5d6',
  rope: '8192a3b4c5d6e7',
  shield: '92a3b4c5d6e7f8',
  biography: 'a3b4c5d6e7f809',
} as const

/** An item, as the module sends it from 0.7.0. */
export function sheetItem(
  fields: Partial<SheetItem> & Pick<SheetItem, 'id' | 'name'>,
): SheetItem {
  return {
    img: null,
    type: 'loot',
    quantity: 1,
    weight: null,
    price: null,
    equipped: null,
    attunement: null,
    attuned: false,
    uses: null,
    rarity: null,
    properties: [],
    identified: true,
    text: null,
    ...fields,
  }
}

/** An action, as the module sends it from 0.8.0. */
export function sheetAction(
  fields: Partial<SheetAction> & Pick<SheetAction, 'id' | 'name'>,
): SheetAction {
  return {
    img: null,
    type: 'feat',
    activation: 'Action',
    range: null,
    target: null,
    toHit: null,
    save: null,
    damage: [],
    uses: null,
    level: null,
    concentration: false,
    identified: true,
    text: null,
    ...fields,
  }
}

/** A spell, as the module sends it from 0.7.0. */
export function sheetSpell(
  fields: Partial<SheetSpell> & Pick<SheetSpell, 'id' | 'name'>,
): SheetSpell {
  return {
    img: null,
    level: 1,
    school: 'Abjuration',
    components: 'V, S',
    materials: null,
    concentration: false,
    ritual: false,
    activation: '1 Action',
    range: 'Self',
    duration: 'Instantaneous',
    target: null,
    prepared: null,
    uses: null,
    text: null,
    ...fields,
  }
}

/** Thorin's features, conditions and effects, as the module sends them from 0.6.0. */
export function fullerSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  return characterSheet({
    classes: [
      {
        id: 'fighter',
        identifier: 'fighter',
        name: 'Fighter',
        levels: 5,
        subclass: 'Champion',
        hitDice: { die: 'd10', value: 3, max: 5 },
      },
    ],
    conditions: [
      {
        id: 'concentrating',
        name: 'Concentrating',
        img: 'systems/dnd5e/icons/svg/statuses/concentrating.svg',
        level: null,
        detail: 'Bless',
        text: null,
      },
      {
        id: 'exhaustion',
        name: 'Exhaustion',
        img: 'systems/dnd5e/icons/svg/statuses/exhaustion.svg',
        level: 2,
        detail: null,
        text: null,
      },
      {
        id: 'poisoned',
        name: 'Poisoned',
        img: 'systems/dnd5e/icons/svg/statuses/poisoned.svg',
        level: null,
        detail: null,
        text: TEXTS.poisoned,
      },
    ],
    features: [
      {
        id: 'fighter',
        label: 'Fighter Features',
        text: TEXTS.fighter,
        features: [
          {
            id: 'second-wind',
            name: 'Second Wind',
            img: 'icons/magic/life/heart-cross-green.webp',
            kind: 'Class Feature',
            requirements: 'Fighter 1',
            activation: '1 Bonus Action',
            passive: false,
            uses: { value: 1, max: 1, recovery: 'Short Rest, Long Rest' },
            text: TEXTS.secondWind,
          },
          {
            id: 'action-surge',
            name: 'Action Surge',
            img: null,
            kind: 'Class Feature',
            requirements: 'Fighter 2',
            activation: 'Special',
            passive: false,
            uses: { value: 0, max: 1, recovery: 'Short Rest' },
            text: TEXTS.actionSurge,
          },
        ],
      },
      {
        id: 'species',
        label: 'Species Features',
        text: null,
        features: [
          {
            id: 'darkvision',
            name: 'Darkvision',
            img: 'https://assets.forge-vtt.com/darkvision.webp',
            kind: 'Species Feature',
            requirements: null,
            activation: null,
            passive: true,
            uses: null,
            text: null,
          },
        ],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'weapons',
          label: 'Weapons',
          items: [
            sheetItem({
              id: 'warhammer',
              name: 'Warhammer',
              img: 'icons/weapons/hammers/hammer-war.webp',
              type: 'weapon',
              weight: { value: 5, units: 'lb' },
              price: '15 GP',
              equipped: true,
              properties: ['Versatile'],
              text: TEXTS.warhammer,
            }),
            sheetItem({
              id: 'handaxe',
              name: 'Handaxe',
              type: 'weapon',
              quantity: 2,
              weight: { value: 4, units: 'lb' },
              price: '5 GP',
              equipped: false,
            }),
          ],
        },
        {
          id: 'equipment',
          label: 'Equipment',
          items: [
            sheetItem({
              id: 'ring',
              name: 'Plain Ring',
              type: 'equipment',
              equipped: true,
              attuned: true,
              identified: false,
              text: TEXTS.ring,
            }),
            sheetItem({
              id: 'cloak',
              name: 'Cloak of Protection',
              type: 'equipment',
              equipped: true,
              attunement: 'required',
              attuned: true,
              rarity: 'Uncommon',
              properties: ['Magical'],
              uses: { value: 2, max: 3, recovery: 'Dawn' },
            }),
          ],
        },
      ],
      containers: [
        {
          ...sheetItem({
            id: 'backpack',
            name: 'Backpack',
            type: 'container',
            weight: { value: 5, units: 'lb' },
            text: TEXTS.backpack,
          }),
          capacity: { value: 12.5, max: 30, units: 'lb' },
          contents: [
            sheetItem({
              id: 'rope',
              name: 'Hempen Rope',
              quantity: 1,
              weight: { value: 10, units: 'lb' },
              text: TEXTS.rope,
            }),
            {
              ...sheetItem({ id: 'pouch', name: 'Pouch', type: 'container' }),
              capacity: { value: 2, max: 6, units: 'Items' },
              contents: [
                sheetItem({ id: 'coin', name: 'Old Coin', quantity: 2 }),
              ],
            },
          ],
        },
        {
          ...sheetItem({
            id: 'box',
            name: 'Puzzle Box',
            type: 'container',
            identified: false,
          }),
          capacity: null,
          contents: null,
        },
      ],
      currency: [
        { id: 'pp', label: 'Platinum', abbreviation: 'PP', value: 2 },
        { id: 'gp', label: 'Gold', abbreviation: 'GP', value: 41 },
        { id: 'sp', label: 'Silver', abbreviation: 'SP', value: 0 },
      ],
      encumbrance: {
        value: 62.5,
        max: 270,
        units: 'lb',
        encumbered: 90,
        heavilyEncumbered: 180,
      },
      attunement: { value: 2, max: 3 },
    },
    spellcasting: {
      ability: 'Wisdom',
      dc: 12,
      attack: 4,
      classes: [{ name: 'Fighter', ability: 'Wisdom', dc: 12, attack: 4 }],
    },
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [
          sheetSpell({
            id: 'guidance',
            name: 'Guidance',
            level: 0,
            school: 'Divination',
            concentration: true,
          }),
        ],
      },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 1, max: 2 },
        spells: [
          sheetSpell({
            id: 'shield',
            name: 'Shield',
            img: 'icons/magic/defensive/shield-barrier.webp',
            activation: '1 Reaction',
            duration: '1 Round',
            prepared: 1,
            text: TEXTS.shield,
          }),
          sheetSpell({
            id: 'alarm',
            name: 'Alarm',
            ritual: true,
            components: 'V, S, M',
            materials: 'A tiny bell',
            prepared: 0,
          }),
          sheetSpell({
            id: 'cure',
            name: 'Cure Wounds',
            school: 'Evocation',
            prepared: 2,
          }),
        ],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 0, max: 0 },
        spells: [],
      },
      {
        id: 'innate',
        label: 'Innate',
        slots: null,
        spells: [
          sheetSpell({
            id: 'misty',
            name: 'Misty Step',
            level: 2,
            uses: { value: 0, max: 1, recovery: 'Long Rest' },
          }),
        ],
      },
    ],
    traits: [
      { id: 'senses', label: 'Senses', values: ['Darkvision 60 ft'] },
      { id: 'languages', label: 'Languages', values: ['Common', 'Dwarvish'] },
      { id: 'dr', label: 'Damage Resistances', values: ['Poison'] },
    ],
    deathSaves: { success: 0, failure: 0 },
    details: {
      about: [
        { id: 'alignment', label: 'Alignment', value: 'Lawful Good' },
        { id: 'age', label: 'Age', value: '195' },
      ],
      personality: [
        { id: 'ideal', label: 'Ideals', value: 'Greater good.' },
        { id: 'flaw', label: 'Flaws', value: 'Gold-sick.' },
      ],
      appearance: 'Broad-shouldered, with a braided beard.',
      xp: { value: 6500, max: 14_000 },
      biography: TEXTS.biography,
    },
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'warhammer',
            name: 'Warhammer',
            img: 'icons/weapons/hammers/hammer-war.webp',
            type: 'weapon',
            attackId: 'warhammerAttack',
            range: 'reach 5 ft',
            target: '1 Creature',
            toHit: 7,
            damage: [
              { formula: '1d8 + 4', type: 'Bludgeoning', healing: false },
            ],
            text: TEXTS.warhammer,
          }),
          sheetAction({
            id: 'handaxe',
            name: 'Handaxe',
            type: 'weapon',
            attackId: 'handaxeAttack',
            range: 'reach 5 ft or range 20/60 ft',
            toHit: 7,
            damage: [{ formula: '1d6 + 4', type: 'Slashing', healing: false }],
          }),
          sheetAction({
            id: 'guidance',
            name: 'Guidance',
            type: 'spell',
            range: 'Touch',
            level: 0,
            concentration: true,
          }),
          sheetAction({
            id: 'breath',
            name: 'Fire Breath',
            range: '15 ft',
            target: '15 ft Cone',
            save: { ability: 'DEX', dc: 13 },
            damage: [{ formula: '2d6', type: 'Fire', healing: false }],
            uses: { value: 1, max: 1, recovery: 'Long Rest' },
          }),
        ],
      },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [
          sheetAction({
            id: 'second-wind',
            name: 'Second Wind',
            activation: 'Bonus Action',
            range: 'Self',
            damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
            uses: { value: 1, max: 1, recovery: 'Short Rest, Long Rest' },
            text: TEXTS.secondWind,
          }),
        ],
      },
      {
        id: 'reaction',
        label: 'Reactions',
        actions: [
          sheetAction({
            id: 'shield',
            name: 'Shield',
            type: 'spell',
            activation: 'Reaction',
            range: 'Self',
            level: 1,
            text: TEXTS.shield,
          }),
        ],
      },
      {
        id: 'special',
        label: 'Special',
        actions: [
          sheetAction({
            id: 'action-surge',
            name: 'Action Surge',
            activation: 'Special',
            uses: { value: 0, max: 1, recovery: 'Short Rest' },
            text: TEXTS.actionSurge,
          }),
        ],
      },
    ],
    effects: [
      {
        id: 'temporary',
        label: 'Temporary Effects',
        effects: [
          {
            id: 'blessed',
            name: 'Bless',
            img: 'icons/magic/control/buff-flight-wings-blue.webp',
            source: 'Bless',
            duration: '9 Rounds',
            disabled: false,
            // Module 0.39.0: an ally's spell, which its player may turn off and delete.
            ops: ['disable', 'delete'],
            text: TEXTS.bless,
          },
          // Module 0.39.0: Rage on its feature, turned on, which its player may turn off, never
          // delete, as dnd5e keeps it on the feature (round 0.39.0 §1.6, CM-1).
          {
            id: 'rage.raging',
            name: 'Rage',
            img: null,
            source: 'Rage',
            duration: '10 Rounds',
            disabled: false,
            ops: ['disable'],
            text: null,
          },
        ],
      },
      {
        id: 'inactive',
        label: 'Inactive Effects',
        effects: [
          // Module 0.39.0: an ally's spell its player turned off from the app, which they may turn
          // back on, or delete.
          {
            id: 'shieldOfFaith',
            name: 'Shield of Faith',
            img: null,
            source: 'Shield of Faith',
            duration: '10 Minutes',
            disabled: true,
            ops: ['enable', 'delete'],
            text: null,
          },
        ],
      },
    ],
    ...fields,
  })
}

/**
 * Thorin's favorites, one of each kind, as the module sends them from 0.9.0. Those that refer to
 * the rest of the sheet refer to fullerSheet's.
 */
export function sheetFavorites(): SheetFavorite[] {
  return [
    {
      type: 'resource',
      id: 'primary',
      name: 'Superiority Dice',
      uses: { value: 3, max: 4, recovery: 'Short Rest' },
    },
    {
      type: 'item',
      id: 'warhammer',
      itemType: 'weapon',
      name: 'Warhammer',
      img: 'icons/weapons/hammers/hammer-war.webp',
    },
    {
      type: 'activity',
      id: 'cast-fireball',
      itemId: 'staff',
      itemType: 'weapon',
      itemName: 'Staff of Fire',
      name: 'Cast Fireball',
      img: 'systems/dnd5e/icons/svg/activity/cast.svg',
      activation: 'Action',
      range: '150 ft',
      target: '20 ft Sphere',
      toHit: null,
      save: { ability: 'DEX', dc: 15 },
      damage: [{ formula: '8d6', type: 'Fire', healing: false }],
      uses: null,
      attackId: null,
    },
    {
      type: 'effect',
      id: 'blessed',
      name: 'Bless',
      img: 'icons/magic/control/buff-flight-wings-blue.webp',
      disabled: false,
      suppressed: false,
    },
    { type: 'skill', id: 'prc', name: 'Perception' },
    {
      type: 'tool',
      id: 'thief',
      name: "Thieves' Tools",
      ability: 'dex',
      total: 5,
      passive: null,
      proficiency: 1,
      mode: 0,
    },
    {
      type: 'slots',
      id: 'spell1',
      name: '1st Level',
      value: 1,
      max: 2,
      level: 1,
    },
  ]
}

/** The levels a Wand of Magic Missiles casts its spell at, with 7 charges left, as dnd5e's. */
export const WAND_LEVELS = [
  { level: 1, charges: 1, short: false },
  { level: 2, charges: 2, short: false },
  { level: 3, charges: 3, short: false },
]

/** Whom an activity is used at: so many creatures, more for each level higher, unless said. */
const castTargets = (
  count: number | null,
  perLevel: number | null = null,
  affects = 'creature',
) => ({ self: false, area: false, count, perLevel, affects })

/**
 * Spells cast from items, as the module sends them from 0.20.0: a Wand of Magic Missiles, its spell
 * cast higher for more of its charges, and a weapon that casts Hex, whose Bonus Hex Damage, used
 * after it's cast, spends nothing; each Cast listed as an action, with the copy of its spell the
 * Spells tab lists under its item.
 */
export function castingSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  const wand = { id: 'mm-wand', name: 'Wand of Magic Missiles' }
  const flame = { id: 'flame', name: 'Bardic Flame' }
  const darts = [{ formula: '1d4 + 1', type: 'Force', healing: false }]
  const strike = [{ formula: '1d6 + 1', type: 'Bludgeoning', healing: false }]
  const necrotic = [{ formula: '1d6', type: 'Necrotic', healing: false }]
  const curse = { id: 'cast-hex', type: 'utility' as const }
  const hexDamage = {
    id: 'hex-dmg',
    name: 'Bonus Hex Damage',
    type: 'damage',
    activation: 'Special',
    range: '90 ft',
    target: null,
    toHit: null,
    attackId: null,
    activity: {
      id: 'hex-dmg',
      type: 'damage' as const,
      targets: castTargets(1),
    },
    save: null,
    damage: necrotic,
    consumesSlot: false,
    uses: null,
  }
  return characterSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            ...wand,
            type: 'consumable',
            range: '120 ft',
            activity: {
              id: 'cast-mm',
              type: 'damage',
              targets: castTargets(3, 1),
            },
            damage: darts,
            cast: {
              level: 1,
              concentration: false,
              charges: 1,
              short: false,
              levels: WAND_LEVELS,
            },
            spellId: 'mm',
            uses: { value: 7, max: 7, recovery: 'Dawn' },
          }),
          sheetAction({
            ...flame,
            type: 'weapon',
            range: 'reach 5 ft',
            toHit: 5,
            attackId: 'strike',
            damage: strike,
            uses: { value: 4, max: 10, recovery: 'Dawn' },
            activities: [
              {
                id: 'strike',
                name: 'Attack',
                type: 'attack',
                activation: 'Action',
                range: 'reach 5 ft',
                target: null,
                toHit: 5,
                attackId: 'strike',
                save: null,
                damage: strike,
                uses: null,
              },
              {
                id: 'cast-hex',
                name: 'Hex',
                type: 'cast',
                activation: 'Bonus Action',
                range: '90 ft',
                target: null,
                toHit: null,
                attackId: null,
                activity: {
                  ...curse,
                  targets: castTargets(1, null, 'enemy'),
                },
                save: null,
                damage: [],
                cast: {
                  level: 1,
                  concentration: true,
                  charges: 1,
                  short: false,
                },
                spellId: 'hex',
                uses: { value: 4, max: 10, recovery: 'Dawn' },
              },
            ],
          }),
        ],
      },
    ],
    spells: [
      {
        id: 'item',
        label: 'Item Spells',
        slots: null,
        spells: [
          sheetSpell({
            id: 'mm',
            name: 'Magic Missile',
            school: 'Evocation',
            range: '120 ft',
            castFrom: wand,
            activity: {
              id: 'mm-darts',
              type: 'damage',
              targets: castTargets(3, 1),
            },
            toHit: null,
            save: null,
            damage: darts,
          }),
          sheetSpell({
            id: 'hex',
            name: 'Hex',
            school: 'Enchantment',
            activation: '1 Bonus Action',
            range: '90 ft',
            concentration: true,
            castFrom: flame,
            toHit: null,
            activity: {
              id: 'hex-curse',
              type: 'utility',
              targets: castTargets(1, null, 'enemy'),
            },
            save: null,
            damage: [],
            activities: [
              {
                id: 'hex-curse',
                name: 'Cast',
                type: 'utility',
                activation: '1 Bonus Action',
                range: '90 ft',
                target: null,
                toHit: null,
                attackId: null,
                activity: {
                  id: 'hex-curse',
                  type: 'utility',
                  targets: castTargets(1, null, 'enemy'),
                },
                save: null,
                damage: [],
                uses: null,
              },
              hexDamage,
            ],
          }),
        ],
      },
    ],
    ...fields,
  })
}

/** Whom one of Rook's activities is used at: its user alone, or one creature. */
const selfOnly = {
  self: true,
  area: false,
  count: null,
  perLevel: null,
  affects: null,
}

/** One of Rook's activities that asks for a check, as the module sends it from 0.21.0. */
const checkActivity = (
  id: string,
  name: string,
  check?: SheetActivity['check'],
  fields: Partial<SheetActivity> = {},
): SheetActivity => ({
  id,
  name,
  type: 'check',
  activation: 'Bonus Action',
  activationType: 'bonus',
  range: 'Self',
  target: null,
  toHit: null,
  attackId: null,
  activity: { id, type: 'check', targets: selfOnly },
  save: null,
  damage: [],
  ...(check && { check }),
  uses: null,
  ...fields,
})

/** Fast Hands' Sleight of Hand, a check of Rook's own, against no DC. */
export const SLEIGHT_CHECK = {
  checks: [{ type: 'skill' as const, ability: 'dex', key: 'slt' }],
  dc: null,
  own: true,
}

/** Thieves' Tools' Pick a Lock, a check of Rook's own with the tools' own +1, DC 15. */
export const LOCK_CHECK = {
  checks: [{ type: 'tool' as const, ability: 'dex', key: 'thief', bonus: 1 }],
  dc: 15,
  own: true,
}

/** Maze's, which its target makes: an Investigation check, DC 20. */
export const MAZE_CHECK = {
  checks: [{ type: 'skill' as const, ability: 'int', key: 'inv' }],
  dc: 20,
  own: false,
}

/**
 * Rook, a 3rd-level Thief, as the module sends him from 0.21.0, with the activities that ask for
 * checks: Fast Hands, whose Sleight of Hand and Thieves' Tools are his own to make, then Use an
 * Object; his Thieves' Tools, +1, whose Pick a Lock is DC 15; and the spells he has from a scroll's
 * study: Maze, whose check its target makes, and Bless, once a day without a slot, as dnd5e's
 * forward activity casts it, with none of his 1st-level slots left.
 */
export function checkingSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  const fastHands = [
    checkActivity('fh-slt', 'Sleight of Hand', SLEIGHT_CHECK),
    checkActivity('fh-thief', "Thieves' Tools", {
      checks: [{ type: 'tool', ability: 'dex', key: 'thief' }],
      dc: null,
      own: true,
    }),
    {
      ...checkActivity('fh-use', 'Use an Object'),
      type: 'utility',
      activity: { id: 'fh-use', type: 'utility' as const, targets: selfOnly },
    },
  ]
  const lock = checkActivity('pick', 'Pick a Lock', LOCK_CHECK, {
    activation: '1 Action',
    activationType: 'action',
    range: 'Touch',
    activity: {
      id: 'pick',
      type: 'check',
      targets: { ...selfOnly, self: false, count: 1, affects: 'object' },
    },
  })
  const maze = {
    activity: {
      id: 'maze-cast',
      type: 'check' as const,
      targets: castTargets(1),
    },
    check: MAZE_CHECK,
  }
  const bless = {
    activity: {
      id: 'bless-cast',
      type: 'utility' as const,
      targets: castTargets(3, 1, 'ally'),
    },
    activities: [
      {
        id: 'bless-cast',
        name: 'Cast',
        type: 'utility',
        activation: '1 Action',
        range: '30 ft',
        target: null,
        toHit: null,
        attackId: null,
        activity: {
          id: 'bless-cast',
          type: 'utility' as const,
          targets: castTargets(3, 1, 'ally'),
        },
        save: null,
        damage: [],
        uses: null,
      },
      {
        id: 'bless-free',
        name: 'Cast (free casting)',
        type: 'forward',
        activation: '1 Action',
        range: '30 ft',
        target: null,
        toHit: null,
        attackId: null,
        activity: {
          id: 'bless-free',
          type: 'utility' as const,
          targets: castTargets(3, null, 'ally'),
        },
        save: null,
        damage: [],
        consumesSlot: false,
        forward: { charges: 1, short: false },
        uses: { value: 1, max: 1, recovery: 'Long Rest' },
      },
    ],
  }
  const spells = {
    maze: sheetSpell({
      id: 'maze',
      name: 'Maze',
      level: 8,
      school: 'Conjuration',
      range: '60 ft',
      concentration: true,
      prepared: 1,
      toHit: null,
      save: null,
      damage: [],
      ...maze,
    }),
    bless: sheetSpell({
      id: 'bless',
      name: 'Bless',
      school: 'Enchantment',
      range: '30 ft',
      concentration: true,
      prepared: 1,
      uses: { value: 1, max: 1, recovery: 'Long Rest' },
      toHit: null,
      save: null,
      damage: [],
      ...bless,
    }),
  }
  return characterSheet({
    level: 3,
    classes: [{ name: 'Rogue', levels: 3, subclass: 'Thief' }],
    proficiency: 2,
    abilities: [
      ability('str', 'Strength', 10),
      ability('dex', 'Dexterity', 16),
      ability('con', 'Constitution', 12),
      ability('int', 'Intelligence', 14),
      ability('wis', 'Wisdom', 10),
      ability('cha', 'Charisma', 10),
    ],
    skills: [
      {
        id: 'slt',
        label: 'Sleight of Hand',
        ability: 'dex',
        total: 5,
        passive: 15,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'inv',
        label: 'Investigation',
        ability: 'int',
        total: 2,
        passive: 12,
        proficiency: 0,
        mode: 0,
      },
    ],
    tools: [
      {
        id: 'thief',
        name: "Thieves' Tools",
        ability: 'dex',
        total: 5,
        passive: null,
        proficiency: 1,
        mode: 0,
      },
    ],
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'tools',
            name: "Thieves' Tools",
            type: 'tool',
            range: 'Touch',
            activity: lock.activity,
            check: LOCK_CHECK,
          }),
          sheetAction({
            id: 'maze',
            name: 'Maze',
            type: 'spell',
            activation: '1 Action',
            range: '60 ft',
            level: 8,
            concentration: true,
            ...maze,
          }),
          sheetAction({
            id: 'bless',
            name: 'Bless',
            type: 'spell',
            activation: '1 Action',
            range: '30 ft',
            level: 1,
            concentration: true,
            uses: { value: 1, max: 1, recovery: 'Long Rest' },
            ...bless,
          }),
        ],
      },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [
          sheetAction({
            id: 'fast-hands',
            name: 'Fast Hands',
            activation: 'Bonus Action',
            activationType: 'bonus',
            range: 'Self',
            activity: fastHands[0].activity,
            check: SLEIGHT_CHECK,
            activities: fastHands,
          }),
        ],
      },
    ],
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 0, max: 4, level: 1 },
        spells: [spells.bless],
      },
      {
        id: 'spell8',
        label: '8th Level',
        slots: { value: 1, max: 1, level: 8 },
        spells: [spells.maze],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'tool',
          label: 'Tools',
          items: [
            sheetItem({
              id: 'tools',
              name: "Thieves' Tools",
              type: 'tool',
              activation: '1 Action',
              range: 'Touch',
              activity: lock.activity,
              check: LOCK_CHECK,
              damage: [],
            }),
          ],
        },
      ],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    ...fields,
  })
}

/** Magic Weapon's ways to enchant (2014), as dnd5e offers them by the level it's cast at. */
export const MAGIC_WEAPON_PROFILES = [
  { id: 'SLSudYaACjmmmZsU', name: 'Magic Weapon, +1', min: null, max: 3 },
  { id: '8OhsRxK3dF1JeQXO', name: 'Magic Weapon, +2', min: 4, max: 5 },
  { id: '7L1wKfaEdN85IA0Z', name: 'Magic Weapon, +3', min: 6, max: null },
]

/** Whom an enchant activity is used at, as the module describes it: at an object, ignored. */
const enchantTargets = {
  self: false,
  area: false,
  count: 1,
  perLevel: null,
  affects: 'object',
}

/** An enchant activity, as the module sends it from 0.21.0. */
export const enchantUse = (
  id: string,
  enchant: Partial<NonNullable<SheetUse['enchant']>> = {},
): SheetUse => ({
  id,
  type: 'enchant',
  targets: enchantTargets,
  enchant: {
    self: false,
    toggle: false,
    profiles: [],
    items: [],
    applied: [],
    ...enchant,
  },
})

/** An enchantment on one of Ari's items, as the module sends it from 0.21.0. */
export const enchantment = (
  fields: Partial<SheetEnchantment> & Pick<SheetEnchantment, 'id' | 'name'>,
): SheetEnchantment => ({
  source: null,
  concentration: false,
  duration: null,
  expired: false,
  endable: true,
  ...fields,
})

/** One of an item's activities, after its attack, as the module sends it from 0.21.0. */
const enchantActivity = (
  id: string,
  name: string,
  activity: SheetUse | null,
  fields: Partial<SheetActivity> = {},
): SheetActivity => ({
  id,
  name,
  type: 'enchant',
  activation: '1 Bonus Action',
  activationType: 'bonus',
  range: 'Self',
  target: null,
  toHit: null,
  attackId: null,
  activity,
  save: null,
  damage: [],
  uses: null,
  ...fields,
})

/** A weapon's attack, its first activity. */
const attackActivity = (id: string, toHit: number): SheetActivity => ({
  id,
  name: 'Attack',
  type: 'attack',
  activation: '1 Action',
  activationType: 'action',
  range: '5 ft',
  target: null,
  toHit,
  attackId: id,
  activity: null,
  save: null,
  damage: [{ formula: '1d8 + 3', type: 'Slashing', healing: false }],
  uses: null,
})

/**
 * Ari, a 5th-level wizard, as the module sends her from 0.21.0, with the enchant activities she
 * uses: Magic Weapon (2014), cast with a 2nd-level slot or higher, on her longsword, club or
 * quarterstaff; Shillelagh, whose 1d10 is on her quarterstaff, its time run out; a Flame Tongue,
 * set alight as a switch; Dagger of Venom, whose Coat Blade coats it; a pebble lit by Continual
 * Flame; Bryn's Magic Weapon on her club, which she may end, as the club's owner; a greataxe made
 * +1 by a magic item's template, which she may not; and Eldritch Spear, a build choice dnd5e uses
 * in Foundry alone.
 */
export function enchantingSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  const magicWeapon = enchantUse('mw-cast', {
    profiles: MAGIC_WEAPON_PROFILES,
    items: ['longsword', 'club', 'quarterstaff'],
  })
  const shillelagh = enchantUse('shill-cast', {
    profiles: [
      {
        id: 'Oy8fP2N3q4R5s6T7',
        name: 'Shillelagh (1d10)',
        min: null,
        max: null,
      },
    ],
    items: ['club', 'quarterstaff'],
    applied: [
      {
        item: 'quarterstaff',
        effect: 'shillEffect01',
        profile: 'Oy8fP2N3q4R5s6T7',
      },
    ],
  })
  const engulf = enchantUse('engulf', {
    self: true,
    toggle: true,
    profiles: [{ id: 'ablazeProfile01', name: 'Ablaze', min: null, max: null }],
  })
  const coat = enchantUse('coat', {
    self: true,
    profiles: [{ id: 'venomProfile01', name: 'Venom', min: null, max: null }],
  })
  const weapon = (
    id: string,
    name: string,
    more: Partial<SheetItem> = {},
  ): SheetItem =>
    sheetItem({
      id,
      name,
      type: 'weapon',
      activation: '1 Action',
      range: '5 ft',
      toHit: 5,
      attackId: `${id}-attack`,
      damage: [{ formula: '1d8 + 3', type: 'Slashing', healing: false }],
      ...more,
    })
  const flameTongue = weapon('flametongue', 'Flame Tongue', {
    activities: [
      attackActivity('flametongue-attack', 5),
      enchantActivity('engulf', 'Engulf in Flames', engulf),
    ],
  })
  const venom = weapon('venom', 'Dagger of Venom', {
    uses: { value: 1, max: 1, recovery: 'Dawn' },
    activities: [
      attackActivity('venom-attack', 5),
      enchantActivity('coat', 'Coat Blade', coat, { activation: '1 Action' }),
    ],
  })
  return characterSheet({
    level: 5,
    classes: [{ name: 'Wizard', levels: 5, subclass: 'Evoker' }],
    spellcasting: {
      ability: 'int',
      dc: 15,
      attack: 7,
      classes: [{ name: 'Wizard', ability: 'int', dc: 15, attack: 7 }],
    },
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [
          sheetSpell({
            id: 'shillelagh',
            name: 'Shillelagh',
            level: 0,
            activation: '1 Bonus Action',
            range: 'Touch',
            prepared: 1,
            toHit: null,
            save: null,
            damage: [],
            activity: shillelagh,
          }),
        ],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 2, max: 3, level: 2 },
        spells: [
          sheetSpell({
            id: 'magicweapon',
            name: 'Magic Weapon',
            level: 2,
            school: 'Transmutation',
            activation: '1 Bonus Action',
            range: 'Touch',
            concentration: true,
            prepared: 1,
            toHit: null,
            save: null,
            damage: [],
            activity: magicWeapon,
          }),
        ],
      },
      {
        id: 'spell3',
        label: '3rd Level',
        slots: { value: 1, max: 2, level: 3 },
        spells: [],
      },
      {
        id: 'spell4',
        label: '4th Level',
        slots: { value: 1, max: 1, level: 4 },
        spells: [],
      },
    ],
    features: [
      {
        id: 'warlock',
        label: 'Warlock Features',
        text: null,
        features: [
          {
            id: 'spear',
            name: 'Eldritch Spear',
            img: null,
            kind: 'Eldritch Invocation',
            requirements: null,
            activation: null,
            passive: true,
            uses: null,
            text: null,
          },
        ],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'weapon',
          label: 'Weapons',
          items: [
            weapon('longsword', 'Longsword', {
              img: 'https://game.test/longsword.webp',
            }),
            weapon('club', 'Club', {
              enchantments: [
                enchantment({
                  id: 'brynMagicWeap',
                  name: 'Magic Weapon, +1',
                  source: 'Magic Weapon',
                  concentration: true,
                }),
              ],
            }),
            weapon('quarterstaff', 'Quarterstaff', {
              enchantments: [
                enchantment({
                  id: 'shillEffect01',
                  name: 'Shillelagh (1d10)',
                  source: 'Shillelagh',
                  duration: null,
                  expired: true,
                }),
              ],
            }),
            flameTongue,
            venom,
            weapon('greataxe', 'Greataxe, +1', {
              enchantments: [
                enchantment({
                  id: 'weaponPlusOne1',
                  name: 'Weapon, +1',
                  endable: false,
                }),
              ],
            }),
          ],
        },
        {
          id: 'loot',
          label: 'Loot',
          items: [
            sheetItem({
              id: 'pebble',
              name: 'Pebble',
              enchantments: [
                enchantment({
                  id: 'contFlame01',
                  name: 'Continual Flame',
                  source: 'Continual Flame',
                }),
              ],
            }),
          ],
        },
      ],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    ...fields,
  })
}

/** Whom a utility used on its user alone is used at, as the module describes it. */
const onItsUser = {
  self: true,
  area: false,
  count: null,
  perLevel: null,
  affects: null,
}

/** A utility, as the module sends it from 0.12.0, and what it spends, from 0.29.0. */
export const utilityUse = (
  id: string,
  spends?: SheetUse['spends'],
): SheetUse => ({
  id,
  type: 'utility',
  targets: onItsUser,
  ...(spends && { spends }),
})

/** Uses, as the module sends them from 0.29.0: which counter they are, and if they're spendable. */
export const counted = (
  value: number,
  max: number,
  counter: SheetCounter,
  spendable = true,
): SheetUses => ({
  value,
  max,
  recovery: 'Long Rest',
  counter,
  ...(spendable && { spendable: true as const }),
})

/** A class feature with these uses, used through this activity, if any. */
const classFeature = (
  id: string,
  name: string,
  uses: SheetUses,
  activity?: SheetUse,
) => ({
  id,
  name,
  img: null,
  kind: 'Class Feature',
  requirements: null,
  activation: activity ? 'Special' : null,
  passive: !activity,
  uses,
  text: null,
  ...(activity && { activity, damage: [] }),
})

/**
 * Ember, a sorcerer, as module 0.29.0 sends her: concentrating on Bless; Sorcery Points 8/20, with
 * a Use that spends one of them; Lucky, used up, with a Use that spends it; Replicate Magic Item, a
 * counter with nothing to use; a wand whose charges may be spent, and a potion whose may not; and
 * an old-style resource among her favorites.
 */
export function chargingSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  const sorcery = counted(8, 20, { item: 'sorcery' })
  const lucky = counted(0, 3, { item: 'lucky' })
  return characterSheet({
    classes: [{ name: 'Sorcerer', levels: 5, subclass: null }],
    conditions: [
      {
        id: 'concentrating',
        name: 'Concentrating',
        img: 'systems/dnd5e/icons/svg/statuses/concentrating.svg',
        level: null,
        detail: 'Bless',
        text: null,
      },
    ],
    concentration: {
      effects: [{ id: 'concBless0001', name: 'Bless', item: 'bless' }],
    },
    features: [
      {
        id: 'sorcerer',
        label: 'Sorcerer Features',
        text: null,
        features: [
          classFeature(
            'sorcery',
            'Sorcery Points',
            sorcery,
            utilityUse('spUtility', [
              { counter: { item: 'sorcery' }, amount: 1 },
            ]),
          ),
          classFeature(
            'lucky',
            'Lucky',
            lucky,
            utilityUse('luckyUse', [{ counter: { item: 'lucky' }, amount: 1 }]),
          ),
          classFeature(
            'replicate',
            'Replicate Magic Item',
            counted(3, 3, { item: 'replicate' }),
          ),
        ],
      },
    ],
    effects: [
      {
        id: 'temporary',
        label: 'Temporary Effects',
        effects: [
          {
            id: 'concBless0001',
            name: 'Concentrating: Bless',
            img: 'systems/dnd5e/icons/svg/statuses/concentrating.svg',
            source: 'Bless',
            duration: '9 Rounds',
            disabled: false,
            text: null,
          },
        ],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'equipment',
          label: 'Equipment',
          items: [
            sheetItem({
              id: 'wand',
              name: 'Wand of Secrets',
              type: 'equipment',
              uses: counted(2, 3, { item: 'wand' }),
            }),
            sheetItem({
              id: 'potion',
              name: 'Potion of Healing',
              type: 'consumable',
              uses: counted(1, 1, { item: 'potion' }, false),
            }),
          ],
        },
      ],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    actions: [
      {
        id: 'special',
        label: 'Special',
        actions: [
          sheetAction({
            id: 'sorcery',
            name: 'Sorcery Points',
            activation: 'Special',
            activity: utilityUse('spUtility', [
              { counter: { item: 'sorcery' }, amount: 1 },
            ]),
            uses: sorcery,
          }),
          sheetAction({
            id: 'lucky',
            name: 'Lucky',
            activation: 'Special',
            activity: utilityUse('luckyUse', [
              { counter: { item: 'lucky' }, amount: 1 },
            ]),
            uses: lucky,
          }),
        ],
      },
    ],
    favorites: [
      {
        type: 'resource',
        id: 'primary',
        name: 'Superiority Dice',
        uses: counted(3, 4, { resource: 'primary' }),
      },
    ],
    ...fields,
  })
}

/* -------------------------------------------- */
/*  Groups (module 0.30.0)                      */
/* -------------------------------------------- */

/** Hashes for a party's descriptions, as the module names them: 14 hexadecimal digits. */
export const GROUP_TEXTS = {
  description: 'b4c5d6e7f8091a',
  summary: 'c5d6e7f8091a2b',
  map: 'd6e7f8091a2b3c',
  chest: 'e7f8091a2b3c4d',
} as const

/** A campaign's characters' actor ids as Foundry makes them, as a group's access names them. */
export const PARTY = { thorin: 'thorin', vex: 'vex', balin: 'balin' } as const

/**
 * The Company, a party Group actor as a hello from module 0.30.0 lists it: dnd5e's primary party,
 * which Thorin's player owns and Vex's observes; Balin's has only Limited, so none.
 */
export function groupEntry(fields: Partial<GroupEntry> = {}): GroupEntry {
  return {
    id: 'company',
    uuid: 'Actor.company',
    name: 'The Company',
    img: 'worlds/erebor/company.webp',
    type: 'group',
    primary: true,
    access: { [PARTY.thorin]: 'owner', [PARTY.vex]: 'observer' },
    ...fields,
  }
}

/**
 * The Company's sheet, as module 0.30.0 sends it: three members by name and portrait, its
 * descriptions by hash, and a stash of coin, a map, and a chest holding a wand with charges.
 */
export function groupSheet(fields: Partial<GroupSheet> = {}): GroupSheet {
  return {
    members: [
      {
        id: PARTY.thorin,
        name: 'Thorin Oakenshield',
        img: 'worlds/erebor/thorin.webp',
        type: 'character',
        character: true,
      },
      {
        id: PARTY.vex,
        name: 'Vex',
        img: null,
        type: 'character',
        character: true,
      },
      {
        id: 'myrtle',
        name: 'Myrtle',
        img: 'icons/svg/mystery-man.svg',
        type: 'npc',
        character: false,
      },
    ],
    description: {
      full: GROUP_TEXTS.description,
      summary: GROUP_TEXTS.summary,
    },
    inventory: {
      sections: [
        {
          id: 'loot',
          label: 'Loot',
          items: [
            sheetItem({
              id: 'map',
              name: "Thror's Map",
              img: 'icons/sundries/documents/map.webp',
              text: GROUP_TEXTS.map,
            }),
          ],
        },
      ],
      containers: [
        {
          ...sheetItem({
            id: 'chest',
            name: 'Iron Chest',
            type: 'container',
            text: GROUP_TEXTS.chest,
          }),
          capacity: null,
          contents: [
            sheetItem({
              id: 'wand',
              name: 'Wand of Magic Missiles',
              type: 'consumable',
              uses: counted(5, 7, { item: 'wand' }),
            }),
          ],
        },
      ],
      currency: [
        { id: 'pp', label: 'Platinum', abbreviation: 'PP', value: 0 },
        { id: 'gp', label: 'Gold', abbreviation: 'GP', value: 1250 },
      ],
      encumbrance: null,
      attunement: null,
    },
    ...fields,
  }
}

/* -------------------------------------------- */
/*  Foundry settings (module 0.30.0)            */
/* -------------------------------------------- */

/**
 * What a module from 0.30.0 says of a dnd5e world's settings for a campaign, without Midi-QOL:
 * dnd5e's own visibility settings and the module's, in English, and what players see in chat;
 * with the rows module 0.31.0 adds, whether players move items and coins, and whether hits and
 * saves follow Foundry's visibility settings.
 */
export function foundrySettings(
  fields: Partial<FoundrySettings> = {},
): FoundrySettings {
  return {
    format: 1,
    modules: [
      {
        id: 'lib-wrapper',
        title: 'libWrapper',
        version: '1.13.2.0',
        active: true,
      },
      { id: 'manual-dice', title: 'Manual Dice', version: null, active: false },
    ],
    sections: [
      {
        id: 'campaign',
        title: 'This campaign',
        rows: [
          {
            id: 'rolls',
            label: 'Players roll in the app',
            value: true,
            text: 'On',
          },
          {
            id: 'attacks',
            label: 'Attacks, spells and features',
            value: true,
            text: 'On',
          },
          {
            id: 'prompts',
            label: 'Save and concentration prompts',
            value: false,
            text: 'Off',
          },
          {
            id: 'manualDice',
            label: 'Allow Players to enter dice results manually',
            value: true,
            text: 'On',
            note: 'Manual Dice is not enabled in this world.',
          },
          // From module 0.31.0.
          {
            id: 'transfers',
            label: 'Players move items and coins',
            value: false,
            text: 'Off',
          },
          {
            id: 'groups',
            label: 'Party sheets',
            value: 1,
            text: 'The Company',
          },
        ],
      },
      {
        id: 'sending-stone',
        title: 'Sending Stone, for every campaign',
        rows: [
          { id: 'chatEvents', label: 'Chat messages', value: true, text: 'On' },
          {
            id: 'chatScope',
            label: 'Which messages',
            value: 'all',
            text: 'Every message players can see',
          },
          // From module 0.31.0.
          {
            id: 'chatResults',
            label: 'Hit/miss and save results in the app',
            value: 'foundry',
            text: "Follow Foundry's visibility settings",
          },
          {
            id: 'combatEvents',
            label: 'Combat tracker',
            value: true,
            text: 'On',
          },
          {
            id: 'gmContent',
            label: 'GM-only details',
            value: false,
            text: 'Off',
          },
        ],
      },
      {
        id: 'dnd5e',
        title: 'D&D Fifth Edition',
        rows: [
          {
            id: 'attackRollVisibility',
            label: 'Attack Result Visibility',
            value: 'hideAC',
            text: 'Show only results',
          },
          {
            id: 'challengeVisibility',
            label: 'Challenge Visibility',
            value: 'player',
            text: 'Show only from other players',
          },
        ],
      },
    ],
    results: [
      {
        id: 'hits',
        state: 'shown',
        text: 'Hit and miss: shown (Attack Result Visibility: Show only results)',
      },
      {
        id: 'saves',
        state: 'partial',
        text: "Saves: shown on players' cards and rolls, hidden otherwise (Challenge Visibility: Show only from other players)",
      },
      {
        id: 'checks',
        state: 'partial',
        text: "Checks: shown on players' cards and rolls, hidden otherwise (Challenge Visibility: Show only from other players)",
      },
    ],
    ...fields,
  }
}

/** What Foundry last said of itself for a campaign, as a hello from module 0.30.0 carries it. */
export function foundrySnapshot(
  fields: Partial<FoundrySnapshot> = {},
): FoundrySnapshot {
  return {
    receivedAt: '2026-10-19T18:30:00.000Z',
    module: { id: 'sending-stone', version: '0.30.0' },
    foundry: { version: '14.365', generation: 14 },
    system: { id: 'dnd5e', title: 'D&D Fifth Edition', version: '5.3.3' },
    settings: foundrySettings(),
    ...fields,
  }
}

/* -------------------------------------------- */
/*  Moving items and coins (module 0.31.0)      */
/* -------------------------------------------- */

/**
 * The Iron Company's stash, as module 0.31.0's group.updated sends it: three Potions of Healing,
 * a Rope, a Backpack holding a Bedroll, a Strange Vial not identified yet, a Locked Coffer whose
 * contents are secret, 120 gp and 7 sp.
 */
export function partyStash(): GroupSheet['inventory'] {
  return {
    sections: [
      {
        id: 'consumable',
        label: 'Consumables',
        items: [
          sheetItem({
            id: 'potionHeal01',
            name: 'Potion of Healing',
            type: 'consumable',
            quantity: 3,
          }),
          sheetItem({
            id: 'strangeVial1',
            name: 'Strange Vial',
            type: 'consumable',
            identified: false,
          }),
        ],
      },
      {
        id: 'loot',
        label: 'Loot',
        items: [sheetItem({ id: 'rope00000001', name: 'Rope' })],
      },
    ],
    containers: [
      {
        ...sheetItem({
          id: 'backpack0001',
          name: 'Backpack',
          type: 'container',
        }),
        capacity: null,
        contents: [sheetItem({ id: 'bedroll00001', name: 'Bedroll' })],
      },
      {
        ...sheetItem({
          id: 'coffer000001',
          name: 'Locked Coffer',
          type: 'container',
          identified: false,
        }),
        capacity: null,
        contents: null,
      },
    ],
    currency: [
      { id: 'pp', label: 'Platinum', abbreviation: 'pp', value: 0 },
      { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 120 },
      { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 7 },
    ],
    encumbrance: null,
    attunement: null,
  }
}

/** The Iron Company, as a hello from module 0.30.0 lists it, which Thorin owns and Vex observes. */
export function ironCompany(fields: Partial<GroupEntry> = {}): GroupEntry {
  return groupEntry({
    id: 'groupIronCo01',
    uuid: 'Actor.groupIronCo01',
    name: 'The Iron Company',
    access: { actorThorin1: 'owner', actorVex0001: 'observer' },
    ...fields,
  })
}

/** Where Thorin's player may move to, as their table view says: The Iron Company and Vex. */
export function tableMoves(fields: Partial<TableMoves> = {}): TableMoves {
  return {
    parties: [{ id: 'groupIronCo01', name: 'The Iron Company', primary: true }],
    characters: [{ id: 'actorVex0001', name: 'Vex' }],
    ...fields,
  }
}

/** The Iron Company's sheet view, as its owner sees it while they may take from it. */
export function movingPartyView(fields: Partial<PartyView> = {}): PartyView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    group: { id: 'groupIronCo01', name: 'The Iron Company', primary: true },
    sheet: { members: [], inventory: partyStash(), description: null },
    sheetVersion: '2026-10-20T12:00:00.000Z',
    moves: {},
    ...fields,
  }
}

/** Two Potions of Healing taken from The Iron Company into Thorin, stacked with his own. */
export function movedResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-move',
    status: 'done',
    reason: null,
    error: null,
    messageId: 'm-line',
    visible: true,
    rolls: [],
    transfer: {
      from: 'groupIronCo01',
      to: 'actorThorin1',
      items: [
        {
          id: 'potionHeal01',
          quantity: 2,
          created: null,
          stacked: 'potionThorin',
        },
      ],
      currency: null,
    },
    ...fields,
  }
}

// Module 0.32.0: players typing in what their own dice show.

/** Thorin's table view as his player has it, with whether they may type in their own dice. */
export function manualDiceView(
  manualDice: NonNullable<TableView['manualDice']>,
  fields: Partial<TableView> = {},
): TableView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    connected: true,
    messages: [],
    rollsToTable: ['skill', 'attack', 'damage'],
    rollFeatures: ['manualDice'],
    manualDice,
    ...fields,
  }
}

/** The game lets Thorin's player type in their own dice, which they haven't chosen to. */
export const offeredDiceView = (fields: Partial<TableView> = {}) =>
  manualDiceView({ offered: true, on: false }, fields)

/** Thorin's player chose to type in their own dice, which the game no longer lets them. */
export const storedDiceView = (fields: Partial<TableView> = {}) =>
  manualDiceView({ offered: false, on: true }, fields)

/** A finesse rapier dnd5e gives Elven Accuracy, as its sheet says from module 0.32.0. */
export function rapierAction(fields: Partial<SheetAction> = {}): SheetAction {
  return sheetAction({
    id: 'rapierThorin',
    name: 'Rapier',
    type: 'weapon',
    toHit: 7,
    attackId: 'rapierAttack',
    damage: [{ formula: '1d8 + 3', type: 'Piercing', healing: false }],
    elvenAccuracy: true,
    ...fields,
  })
}

/** A greataxe swung with Strength, which Elven Accuracy is never for. */
export function greataxeAction(fields: Partial<SheetAction> = {}): SheetAction {
  return sheetAction({
    id: 'greataxeThor',
    name: 'Greataxe',
    type: 'weapon',
    toHit: 5,
    attackId: 'greataxeAttack',
    damage: [{ formula: '1d12 + 3', type: 'Slashing', healing: false }],
    ...fields,
  })
}

/** Thorin in a hello's roster, whose player may type in their own dice, as module 0.32.0 says. */
export function typingRosterEntry(
  fields: Partial<ConnectedCharacter> = {},
): ConnectedCharacter {
  return { id: 'actorThorin1', name: 'Thorin', manualDice: true, ...fields }
}

// Module 0.32.0: a party's things sent elsewhere by its Owner, and its coin distributed.

/** What a hello from module 0.32.0 says of moves, on, under dnd5e. */
export const SENDING_TRANSFERS = {
  enabled: true,
  kinds: ['transfer'],
  reason: null,
  partySends: true,
  distribute: true,
} as const

/** The Iron Company's members that are the campaign's characters, in its sheet's order. */
export const COMPANY_CHARACTERS = [
  { id: 'actorBram001', name: 'Bram' },
  { id: 'actorLia0001', name: 'Lia' },
  { id: 'actorThorin1', name: 'Thorin' },
  { id: 'actorVex0001', name: 'Vex' },
]

/**
 * The Iron Company's sheet view, as Thorin's player has it from module 0.32.0: its things may be
 * sent to the Wardens of the Vale, which he owns too, or any of the campaign's characters, his own
 * included; its coin distributed among its four characters; and his own 65 gp given it.
 */
export function sendingPartyView(fields: Partial<PartyView> = {}): PartyView {
  return movingPartyView({
    moves: {
      send: {
        parties: [
          { id: 'groupWarden1', name: 'Wardens of the Vale', primary: false },
        ],
        characters: [
          { id: 'actorThorin1', name: 'Thorin' },
          { id: 'actorVex0001', name: 'Vex' },
          { id: 'actorBram001', name: 'Bram' },
          { id: 'actorLia0001', name: 'Lia' },
        ],
      },
      distribute: COMPANY_CHARACTERS,
      give: {
        currency: [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 65 }],
      },
    },
    ...fields,
  })
}

/** 100 gp of The Iron Company's distributed among its four characters, 25 gp each. */
export function distributedResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-move',
    status: 'done',
    reason: null,
    error: null,
    messageId: 'm-line',
    visible: true,
    rolls: [],
    transfer: {
      from: 'groupIronCo01',
      to: null,
      items: [],
      currency: { gp: 100 },
      among: COMPANY_CHARACTERS.map(({ id }) => id),
    },
    ...fields,
  }
}

// Module 0.33.0: an item removed from a character.

/** What a hello from module 0.33.0 says of removals under dnd5e, with no switch: on. */
export const REMOVING = {
  enabled: true,
  kinds: ['remove'],
  reason: null,
} as const

/** What a hello from module 0.33.0 says of removals under another system: off, and why. */
export const NOT_REMOVING = {
  enabled: false,
  kinds: [],
  reason: 'system',
} as const

/** Two of Thorin's three Potions of Healing removed. */
export function removedResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-remove',
    status: 'done',
    reason: null,
    error: null,
    messageId: 'm-line',
    visible: true,
    rolls: [],
    removed: { item: 'potionThorin', quantity: 2 },
    ...fields,
  }
}

/** Thorin's table view as his player has it while the game removes his items, moves off. */
export function removingTableView(fields: Partial<TableView> = {}): TableView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    connected: true,
    messages: [],
    removes: true,
    ...fields,
  }
}

// Module 0.37.0: a character's favorites added and removed from the app.

/** What a hello from module 0.37.0 says of favorites under dnd5e, with no switch: on. */
export const FAVORITING = {
  enabled: true,
  kinds: ['favorite'],
  reason: null,
} as const

/** What a hello from module 0.37.0 says of favorites under another system: off, and why. */
export const NOT_FAVORITING = {
  enabled: false,
  kinds: [],
  reason: 'system',
} as const

/** Thorin's table view as his player has it while the game takes his favorites, rolls off. */
export function favoritingTableView(
  fields: Partial<TableView> = {},
): TableView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    connected: true,
    messages: [],
    favorites: true,
    ...fields,
  }
}

/** What a row's favorites entry was chosen for, as `offeringFavorites` notes it. */
export type ChosenFavorite = {
  target: FavoriteTarget
  name: string
  op: 'add' | 'remove'
}

/** A favorite's key, as `targetKey` makes it: "activity:<itemId>.<id>" or "<type>:<id>". */
const favoriteKeyOf = (target: FavoriteTarget) =>
  target.type === 'activity'
    ? `activity:${target.item}.${target.id}`
    : `${target.type}:${target.id}`

/**
 * What a pane offers of its character's favorites, for a row drawn alone, from module 0.37.0: each
 * row's entry adds, but removes those keyed among `favorites`, as "item:<id>" or
 * "activity:<itemId>.<id>", and waits for those among `waiting`. What's chosen is noted.
 */
export function offeringFavorites(
  favorites: string[] = [],
  waiting: string[] = [],
): {
  chosen: ChosenFavorite[]
  value: {
    choiceFor: (
      target: FavoriteTarget,
      name: string,
    ) => { op: 'add' | 'remove'; waiting: boolean; choose: () => void }
  }
} {
  const chosen: ChosenFavorite[] = []
  return {
    chosen,
    value: {
      choiceFor: (target, name) => {
        const op = favorites.includes(favoriteKeyOf(target)) ? 'remove' : 'add'
        return {
          op,
          waiting: waiting.includes(favoriteKeyOf(target)),
          choose: () => {
            chosen.push({ target, name, op })
          },
        }
      },
    },
  }
}

/** A favorite added: it's one of Thorin's favorites now, nothing posted. */
export function favoritedResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-favorite',
    status: 'done',
    reason: null,
    error: null,
    messageId: null,
    visible: true,
    rolls: [],
    favorited: true,
    ...fields,
  }
}

// Module 0.38.0: dishes from the Magical Recipe Book.

/** What a hello from module 0.38.0 says of dishes with the campaign's switch on, under dnd5e 5. */
export const TAKING_DISHES = {
  enabled: true,
  kinds: ['dish'],
  reason: null,
  versions: [1],
} as const

/** What it says with the campaign's switch off, the default. */
export const DISHES_SWITCHED_OFF = {
  enabled: false,
  kinds: [],
  reason: 'off',
  versions: [],
} as const

/** What it says with the switch on under another system, or under dnd5e 6. */
export const DISHES_OTHER_SYSTEM = {
  enabled: false,
  kinds: [],
  reason: 'system',
  versions: [],
} as const

/** A dish's card posted in Foundry, waiting for the Gamemaster. */
export function dishResult(fields: Partial<CommandResult> = {}): CommandResult {
  return {
    id: 'dish-cmh9q2x7k0003ssdish0001',
    status: 'done',
    reason: null,
    error: null,
    messageId: 'Xy12ChatCardId00',
    visible: false,
    rolls: [],
    dish: { card: 'Xy12ChatCardId00', state: 'waiting' },
    ...fields,
  }
}

// Module 0.39.0: a player's own effects.

/** What a hello from module 0.39.0 says of effects with the campaign's switch on, under dnd5e. */
export const TAKING_EFFECTS = {
  enabled: true,
  kinds: ['effect'],
  reason: null,
} as const

/** What it says with the campaign's switch off, the default. */
export const EFFECTS_SWITCHED_OFF = {
  enabled: false,
  kinds: [],
  reason: 'off',
} as const

/** What it says with the switch on under another system. */
export const EFFECTS_OTHER_SYSTEM = {
  enabled: false,
  kinds: [],
  reason: 'system',
} as const

/** Bless turned off from the app: off now, its sheet sent first, nothing posted. */
export function effectResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-effect',
    status: 'done',
    reason: null,
    error: null,
    messageId: null,
    visible: true,
    rolls: [],
    effect: { id: 'blessed', disabled: true, deleted: false },
    ...fields,
  }
}

// Module 0.40.0: Wild Shape.

/** What a hello from module 0.40.0 says of Wild Shape, its campaign's switch on, under dnd5e. */
export const TAKING_WILD_SHAPE = {
  enabled: true,
  kinds: ['wildShape'],
  reason: null,
} as const

/** What it says with the campaign's switch off, the default. */
export const WILD_SHAPE_SWITCHED_OFF = {
  enabled: false,
  kinds: [],
  reason: 'off',
} as const

/** What it says with the switch on under another system. */
export const WILD_SHAPE_OTHER_SYSTEM = {
  enabled: false,
  kinds: [],
  reason: 'system',
} as const

/**
 * Elowen's Wild Shape feature's id, its row's on her sheet and on her form's, which dnd5e copies
 * with her items' ids.
 */
export const WILD_SHAPE_ITEM = 'phbdrdWildShape0'

/** The ids of the profiles of the forms Elowen knows, as dnd5e makes them. */
export const FORM_IDS = {
  wolf: 'Kp3vQ8mZr2LdW0aB',
  blackBear: 'Bb4wR9nAs3MeX1cC',
  panther: 'Pn5xS0oBt4NfY2dD',
  giantBadger: 'Gb6yT1pCu5OgZ3eE',
  crocodile: 'Cr7zU2qDv6PhA4fF',
  reefShark: 'Rs8aV3rEw7QiB5gG',
  brownBear: 'Br9bW4sFx8RjC6hH',
  direWolf: 'Dw0cX5tGy9SkD7iI',
} as const

/** A Beast of dnd5e's 2024 Actors, by its uuid. */
export const actors24 = (id: string) => `Compendium.dnd5e.actors24.Actor.${id}`

/** One of a druid's known forms, from the campaign's compendiums and within the rules, as given. */
export function knownForm(
  fields: Partial<KnownForm> & Pick<KnownForm, 'id' | 'name'>,
): KnownForm {
  return {
    uuid: actors24(`mm${fields.name.replaceAll(' ', '')}`.padEnd(16, '0')),
    img: null,
    size: 'Medium',
    cr: 0.25,
    ac: 12,
    speeds: ['Walk 30 ft'],
    attack: null,
    pool: true,
    fits: true,
    ...fields,
  }
}

/** The Beasts Elowen may know, with their statistics as the game summarises them. */
export const KNOWN_FORMS = {
  wolf: knownForm({
    id: FORM_IDS.wolf,
    name: 'Wolf',
    img: 'systems/dnd5e/tokens/beast/Wolf.webp',
    speeds: ['Walk 40 ft'],
    attack: { name: 'Bite', toHit: 4, damage: '1d6 + 2' },
  }),
  blackBear: knownForm({
    id: FORM_IDS.blackBear,
    name: 'Black Bear',
    cr: 0.5,
    ac: 11,
    speeds: ['Walk 30 ft', 'Climb 30 ft', 'Swim 30 ft'],
    attack: { name: 'Rend', toHit: 4, damage: '1d6 + 2' },
  }),
  panther: knownForm({
    id: FORM_IDS.panther,
    name: 'Panther',
    ac: 13,
    speeds: ['Walk 50 ft', 'Climb 40 ft'],
    attack: { name: 'Rend', toHit: 5, damage: '1d6 + 3' },
  }),
  giantBadger: knownForm({
    id: FORM_IDS.giantBadger,
    name: 'Giant Badger',
    ac: 13,
    speeds: ['Walk 30 ft', 'Burrow 10 ft'],
    attack: { name: 'Bite', toHit: 3, damage: '2d4 + 1' },
  }),
  crocodile: knownForm({
    id: FORM_IDS.crocodile,
    name: 'Crocodile',
    size: 'Large',
    cr: 0.5,
    speeds: ['Walk 20 ft', 'Swim 30 ft'],
    attack: { name: 'Bite', toHit: 4, damage: '1d8 + 2' },
  }),
  reefShark: knownForm({
    id: FORM_IDS.reefShark,
    name: 'Reef Shark',
    cr: 0.5,
    speeds: ['Walk 5 ft', 'Swim 30 ft'],
    attack: { name: 'Bite', toHit: 4, damage: '2d4 + 2' },
  }),
  brownBear: knownForm({
    id: FORM_IDS.brownBear,
    name: 'Brown Bear',
    size: 'Large',
    cr: 1,
    ac: 11,
    speeds: ['Walk 40 ft', 'Climb 30 ft'],
    attack: { name: 'Bite', toHit: 5, damage: '1d8 + 3' },
  }),
  direWolf: knownForm({
    id: FORM_IDS.direWolf,
    name: 'Dire Wolf',
    size: 'Large',
    cr: 1,
    ac: 14,
    speeds: ['Walk 50 ft'],
    attack: { name: 'Bite', toHit: 5, damage: '1d10 + 3' },
  }),
} as const

/**
 * Elowen's Wild Shape, a druid 5 with Wild Resurgence, 2 of 2 uses, knowing six forms (the
 * design's): up to CR 1/2, none with a Fly Speed, for 2 hours, with 5 temporary hit points.
 */
export function wildShapeBlock(
  fields: Partial<SheetWildShape> = {},
): SheetWildShape {
  return {
    item: WILD_SHAPE_ITEM,
    uses: { value: 2, max: 2 },
    level: 5,
    circle: null,
    limits: { count: 6, cr: 0.5, fly: false },
    hours: 2,
    temp: 5,
    acFloor: null,
    known: [
      KNOWN_FORMS.wolf,
      KNOWN_FORMS.blackBear,
      KNOWN_FORMS.panther,
      KNOWN_FORMS.giantBadger,
      KNOWN_FORMS.crocodile,
      KNOWN_FORMS.reefShark,
    ],
    swap: false,
    resurgence: true,
    ended: null,
    ...fields,
  }
}

/**
 * Elowen's Wild Shape were she of the Circle of the Moon at level 5, as the design draws her: up to
 * CR 1, 15 temporary hit points, an AC of at least 13 + her Wisdom modifier, six forms still.
 */
export function moonBlock(
  fields: Partial<SheetWildShape> = {},
): SheetWildShape {
  return wildShapeBlock({
    circle: 'moon',
    limits: { count: 6, cr: 1, fly: false },
    temp: 15,
    acFloor: 16,
    known: [
      KNOWN_FORMS.brownBear,
      KNOWN_FORMS.direWolf,
      KNOWN_FORMS.wolf,
      KNOWN_FORMS.blackBear,
      KNOWN_FORMS.panther,
      KNOWN_FORMS.crocodile,
    ],
    ...fields,
  })
}

/** Elowen's Wild Shape row, as Features lists it, with its uses. */
function wildShapeFeature(uses: { value: number; max: number }): SheetFeature {
  return {
    id: WILD_SHAPE_ITEM,
    name: 'Wild Shape',
    img: 'icons/magic/nature/wolf-paw-glow-large-green.webp',
    kind: 'Class Feature',
    requirements: 'Druid 2',
    activation: '1 Bonus Action',
    passive: false,
    uses: {
      ...uses,
      recovery: 'Short Rest, Long Rest',
      counter: { item: WILD_SHAPE_ITEM },
      spendable: true,
    },
    text: null,
  }
}

/** Elowen's Wild Shape row, as Actions lists it among her Bonus Actions, with its uses. */
function wildShapeAction(uses: { value: number; max: number }): SheetAction {
  return sheetAction({
    id: WILD_SHAPE_ITEM,
    name: 'Wild Shape',
    img: 'icons/magic/nature/wolf-paw-glow-large-green.webp',
    activation: 'Bonus Action',
    uses: {
      ...uses,
      recovery: 'Short Rest, Long Rest',
      counter: { item: WILD_SHAPE_ITEM },
      spendable: true,
    },
  })
}

/** Elowen's druid features: Wild Shape, with these uses, and Wild Resurgence. */
function druidFeatures(uses: { value: number; max: number }) {
  return {
    id: 'druid',
    label: 'Druid Features',
    text: null,
    features: [
      wildShapeFeature(uses),
      {
        id: 'phbdrdWildResurg',
        name: 'Wild Resurgence',
        img: null,
        kind: 'Class Feature',
        requirements: 'Druid 5',
        activation: null,
        passive: true,
        uses: null,
        text: null,
      },
    ],
  }
}

/** Elowen's spell slots, which wait while she's shaped. */
const elowenSlots = (spells: boolean) => [
  {
    id: 'spell1',
    label: '1st Level',
    slots: { value: 4, max: 4, level: 1 },
    spells: spells ? [sheetSpell({ id: 'goodberry', name: 'Goodberry' })] : [],
  },
  {
    id: 'spell2',
    label: '2nd Level',
    slots: { value: 3, max: 3, level: 2 },
    spells: spells
      ? [
          sheetSpell({
            id: 'moonbeam',
            name: 'Moonbeam',
            level: 2,
            concentration: true,
          }),
        ]
      : [],
  },
]

/**
 * Elowen, Alice's druid 5, a Wood Elf, as module 0.40.0 sends her to an app that takes Wild Shape:
 * her Wild Shape row among her Bonus Actions and Druid Features, Wild Resurgence, her slots and
 * spells, and her Wild Shape (`wildShapeBlock`).
 */
export function druidSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  return characterSheet({
    img: 'worlds/erebor/elowen.webp',
    level: 5,
    classes: [
      {
        id: 'druid',
        identifier: 'druid',
        name: 'Druid',
        levels: 5,
        subclass: null,
        hitDice: { die: 'd8', value: 5, max: 5 },
      },
    ],
    species: 'Wood Elf',
    background: 'Guide',
    hp: { value: 31, max: 38, temp: 0 },
    ac: 14,
    proficiency: 3,
    initiative: 2,
    speed: { value: 35, units: 'ft' },
    abilities: [
      ability('str', 'Strength', 10),
      ability('dex', 'Dexterity', 14),
      ability('con', 'Constitution', 14),
      ability('int', 'Intelligence', 12, { save: 4, saveProficient: true }),
      ability('wis', 'Wisdom', 17, { save: 6, saveProficient: true }),
      ability('cha', 'Charisma', 10),
    ],
    skills: [
      {
        id: 'ani',
        label: 'Animal Handling',
        ability: 'wis',
        total: 6,
        passive: 16,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'nat',
        label: 'Nature',
        ability: 'int',
        total: 4,
        passive: 14,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'prc',
        label: 'Perception',
        ability: 'wis',
        total: 3,
        passive: 13,
        proficiency: 0,
        mode: 0,
      },
      {
        id: 'ste',
        label: 'Stealth',
        ability: 'dex',
        total: 2,
        passive: 12,
        proficiency: 0,
        mode: 0,
      },
    ],
    features: [druidFeatures({ value: 2, max: 2 })],
    actions: [
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [wildShapeAction({ value: 2, max: 2 })],
      },
    ],
    spellcasting: {
      ability: 'wis',
      dc: 14,
      attack: 6,
      classes: [{ name: 'Druid', ability: 'wis', dc: 14, attack: 6 }],
    },
    spells: elowenSlots(true),
    traits: [{ id: 'senses', label: 'Senses', values: ['Darkvision 60 ft'] }],
    wildShape: wildShapeBlock(),
    ...fields,
  })
}

/**
 * What Elowen is as a Wolf, from module 0.40.0: her 2024 Wild Shape, taken as her known Wolf, with
 * 1 h 58 m of its 2 hours left; the Wolf's Strength, Dexterity and Constitution, its Strength save,
 * Perception and Stealth above her own.
 */
export function wolfForm(fields: Partial<SheetForm> = {}): SheetForm {
  return {
    kind: 'wildShape',
    name: 'Wolf',
    img: 'systems/dnd5e/tokens/beast/Wolf.webp',
    size: 'Medium',
    cr: 0.25,
    type: 'Beast',
    profile: FORM_IDS.wolf,
    hours: 2,
    minutesLeft: 118,
    flooredAc: false,
    beast: {
      abilities: ['str', 'dex', 'con'],
      saves: ['str'],
      skills: ['prc', 'ste'],
    },
    ...fields,
  }
}

/**
 * Elowen as a Wolf, as module 0.40.0 sends her form's sheet under her own id: the Wolf's portrait,
 * AC 12, Walk 40 ft and physical scores, her own hit points with its 5 temporary ones, her mind,
 * class features and slots, its Bite and Pack Tactics, her Wild Shape with a use spent, and `form`
 * (`wolfForm`). Its spells are none, as dnd5e gives a form none but the Moon's.
 */
export function shapedSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  const bite = sheetAction({
    id: 'wolfBite0000000a',
    name: 'Bite',
    img: 'icons/creatures/abilities/mouth-teeth-long-red.webp',
    type: 'weapon',
    toHit: 4,
    damage: [{ formula: '1d6 + 2', type: 'Piercing', healing: false }],
  })
  return druidSheet({
    img: 'systems/dnd5e/tokens/beast/Wolf.webp',
    hp: { value: 31, max: 38, temp: 5 },
    ac: 12,
    initiative: 2,
    speed: { value: 40, units: 'ft' },
    abilities: [
      ability('str', 'Strength', 14),
      ability('dex', 'Dexterity', 15),
      ability('con', 'Constitution', 12),
      ability('int', 'Intelligence', 12, { save: 4, saveProficient: true }),
      ability('wis', 'Wisdom', 17, { save: 6, saveProficient: true }),
      ability('cha', 'Charisma', 10),
    ],
    skills: [
      {
        id: 'ani',
        label: 'Animal Handling',
        ability: 'wis',
        total: 6,
        passive: 16,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'nat',
        label: 'Nature',
        ability: 'int',
        total: 4,
        passive: 14,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'prc',
        label: 'Perception',
        ability: 'wis',
        total: 5,
        passive: 15,
        proficiency: 1,
        mode: 0,
      },
      {
        id: 'ste',
        label: 'Stealth',
        ability: 'dex',
        total: 4,
        passive: 14,
        proficiency: 1,
        mode: 0,
      },
    ],
    features: [
      druidFeatures({ value: 1, max: 2 }),
      {
        id: 'traits',
        label: 'Traits',
        text: null,
        features: [
          {
            id: 'wolfPackTactics',
            name: 'Pack Tactics',
            img: null,
            kind: null,
            requirements: null,
            activation: null,
            passive: true,
            uses: null,
            text: null,
          },
        ],
      },
    ],
    actions: [
      { id: 'action', label: 'Actions', actions: [bite] },
      {
        id: 'bonus',
        label: 'Bonus Actions',
        actions: [wildShapeAction({ value: 1, max: 2 })],
      },
    ],
    inventory: {
      sections: [
        {
          id: 'weapons',
          label: 'Weapons',
          items: [
            sheetItem({
              id: bite.id,
              name: 'Bite',
              img: bite.img,
              type: 'weapon',
              equipped: true,
            }),
          ],
        },
      ],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    spells: elowenSlots(false),
    wildShape: wildShapeBlock({ uses: { value: 1, max: 2 } }),
    form: wolfForm(),
    ...fields,
  })
}

/** Elowen changed into her known Wolf from the app: 5 temporary hit points, for 2 hours. */
export function wildShapeResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return {
    id: 'req-wildshape',
    status: 'done',
    reason: null,
    error: null,
    messageId: null,
    visible: true,
    rolls: [],
    wildShape: {
      op: 'transform',
      form: {
        id: FORM_IDS.wolf,
        name: 'Wolf',
        uuid: KNOWN_FORMS.wolf.uuid ?? '',
      },
      temp: 5,
      hours: 2,
    },
    ...fields,
  }
}

/** A Beast the game lists to learn, from dnd5e's 2024 Actors. */
const beast = (
  name: string,
  cr: number,
  ac: number | null,
  speeds: string[],
  known = false,
) => ({
  uuid: actors24(`mm${name.replaceAll(' ', '')}`.padEnd(16, '0')),
  name,
  img: `systems/dnd5e/tokens/beast/${name.replaceAll(' ', '')}.webp`,
  size: name === 'Crocodile' || name === 'Riding Horse' ? 'Large' : 'Medium',
  cr,
  ac,
  speeds,
  known,
})

/**
 * The Beasts Elowen may learn, as the game lists them from dnd5e's 2024 Actors: up to CR 1/2, none
 * with a Fly Speed, by CR then name, her six known forms among them.
 */
export function beastsResult(
  fields: Partial<CommandResult> = {},
): CommandResult {
  return wildShapeResult({
    id: 'req-beasts',
    wildShape: {
      op: 'forms',
      forms: [
        beast('Rat', 0, 10, ['Walk 20 ft', 'Climb 20 ft']),
        beast('Spider', 0, 12, ['Walk 20 ft', 'Climb 20 ft']),
        beast('Giant Badger', 0.25, 13, ['Walk 30 ft', 'Burrow 10 ft'], true),
        beast('Panther', 0.25, 13, ['Walk 50 ft', 'Climb 40 ft'], true),
        beast('Riding Horse', 0.25, 11, ['Walk 60 ft']),
        beast('Wolf', 0.25, 12, ['Walk 40 ft'], true),
        beast('Black Bear', 0.5, 11, ['Walk 30 ft', 'Climb 30 ft'], true),
        beast('Crocodile', 0.5, 12, ['Walk 20 ft', 'Swim 30 ft'], true),
        beast('Reef Shark', 0.5, 12, ['Walk 5 ft', 'Swim 30 ft'], true),
      ],
      more: false,
      limits: { count: 6, cr: 0.5, fly: false },
    },
    ...fields,
  })
}

/** A container of the sheet's, as sheetItem makes an item: holding these, or something secret. */
export function sheetContainer(
  fields: Partial<SheetContainer> &
    Pick<SheetContainer, 'id' | 'name' | 'contents'>,
): SheetContainer {
  return {
    ...sheetItem({ type: 'container', ...fields }),
    capacity: null,
    ...fields,
  }
}

/**
 * Thorin's things, as his sheet lists them, for removing them: 3 Potions of Healing, a Rope, an
 * unidentified Strange Vial, 0 Arrows; a Backpack holding a Bedroll and a Pouch holding a Gem; and
 * a Sealed Chest whose contents are secret.
 */
export function removalInventory(): SheetInventory {
  return {
    sections: [
      {
        id: 'consumable',
        label: 'Consumables',
        items: [
          sheetItem({
            id: 'potionThorin',
            name: 'Potion of Healing',
            type: 'consumable',
            quantity: 3,
          }),
          sheetItem({
            id: 'vialThorin01',
            name: 'Strange Vial',
            type: 'consumable',
            identified: false,
          }),
          sheetItem({
            id: 'arrowsThorin',
            name: 'Arrows',
            type: 'consumable',
            quantity: 0,
          }),
        ],
      },
      {
        id: 'loot',
        label: 'Loot',
        items: [sheetItem({ id: 'ropeThorin01', name: 'Rope' })],
      },
    ],
    containers: [
      sheetContainer({
        id: 'backpackThor',
        name: 'Backpack',
        contents: [
          sheetItem({ id: 'bedrollThorn', name: 'Bedroll' }),
          sheetContainer({
            id: 'pouchThorin1',
            name: 'Pouch',
            contents: [sheetItem({ id: 'gemThorin001', name: 'Gem' })],
          }),
        ],
      }),
      sheetContainer({
        id: 'chestThorin1',
        name: 'Sealed Chest',
        contents: null,
      }),
    ],
    currency: [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 15 }],
    encumbrance: null,
    attunement: null,
  }
}

/**
 * Journal notes' ids, from module 0.34.0: 16 letters and digits, as Foundry's pages' are and
 * the app makes them.
 */
export const NOTE_IDS = {
  session: 'sessionChapter01',
  cave: 'goblinCaveNote01',
  rumour: 'rumourInFoundry1',
  map: 'mapInHtmlEditor1',
  long: 'longFoundryPage1',
  road: 'roadToEreborCh01',
  wolves: 'wolvesEntryVex01',
  traitor: 'traitorSecretGm1',
} as const

/** A page's revision, 14 hexadecimal digits, one for each. */
const rev = (n: number) => n.toString(16).padStart(14, '0')

/** When the notes were written: from 21 October 2026, a minute apart. */
const written = (minutes: number) =>
  Date.parse('2026-10-21T19:00:00Z') + minutes * 60_000

/**
 * A journal of notes as module 0.34.0 sends it: Thorin's own in Erebor, a chapter with an entry
 * written in the app, one written in Foundry, one in Foundry's HTML editor and one cut short; or
 * The Iron Company's, a chapter with Vex's entry, and a page of the Gamemaster's sent as HTML for
 * its secret, which from module 0.35.0 says the Gamemaster last deleted a page of it in Foundry.
 */
export function mockJournalUpdated(
  kind: 'personal' | 'party' = 'personal',
  fields: Partial<JournalUpdated> = {},
): JournalUpdated {
  if (kind === 'party') {
    return {
      kind: 'party',
      actorId: 'company',
      journal: {
        id: 'companyJournal01',
        name: 'The Iron Company: party notes',
        notes: [
          {
            id: NOTE_IDS.road,
            role: 'chapter',
            chapter: null,
            title: 'Road to Erebor',
            format: 2,
            markdown: '',
            createdAt: written(0),
            modifiedAt: written(0),
            modifiedBy: 'Vex',
            modifiedIn: 'app',
            author: { actorId: PARTY.vex, gm: false, name: 'Vex' },
            rev: rev(1),
          },
          {
            id: NOTE_IDS.wolves,
            role: 'entry',
            chapter: NOTE_IDS.road,
            title: 'Wolves',
            format: 2,
            markdown: 'Three of them, *hungry*.',
            createdAt: written(1),
            modifiedAt: written(1),
            modifiedBy: 'Vex',
            modifiedIn: 'app',
            author: { actorId: PARTY.vex, gm: false, name: 'Vex' },
            rev: rev(2),
          },
          {
            id: NOTE_IDS.traitor,
            role: 'entry',
            chapter: NOTE_IDS.road,
            title: 'Who to trust',
            format: 1,
            html: '<p>Keep watch at night.</p>',
            secret: true,
            createdAt: written(2),
            modifiedAt: written(3),
            modifiedBy: 'Gamemaster',
            modifiedIn: 'foundry',
            author: null,
            rev: rev(3),
          },
        ],
        changed: { what: 'delete', by: 'Gamemaster', at: written(10) },
      },
      ...fields,
    }
  }
  return {
    kind: 'personal',
    actorId: PARTY.thorin,
    journal: {
      id: 'thorinJournal001',
      name: "Thorin's notes (Erebor)",
      notes: [
        {
          id: NOTE_IDS.session,
          role: 'chapter',
          chapter: null,
          title: 'Session 1',
          format: 2,
          markdown: '',
          createdAt: written(0),
          modifiedAt: written(0),
          modifiedBy: 'Thorin',
          modifiedIn: 'app',
          author: { actorId: PARTY.thorin, gm: false, name: 'Thorin' },
          rev: rev(11),
        },
        {
          id: NOTE_IDS.cave,
          role: 'entry',
          chapter: NOTE_IDS.session,
          title: 'The goblin cave',
          format: 2,
          markdown: '### Loot\n- 30 gp\n- a *strange* key',
          createdAt: written(1),
          modifiedAt: written(2),
          modifiedBy: 'Thorin',
          modifiedIn: 'app',
          author: { actorId: PARTY.thorin, gm: false, name: 'Thorin' },
          rev: rev(12),
        },
        {
          id: NOTE_IDS.rumour,
          role: 'entry',
          chapter: NOTE_IDS.session,
          title: 'A rumour',
          format: 2,
          markdown: 'Written in Foundry.',
          createdAt: written(3),
          modifiedAt: written(4),
          modifiedBy: 'Gamemaster',
          modifiedIn: 'foundry',
          author: null,
          rev: rev(13),
        },
        {
          id: NOTE_IDS.map,
          role: 'entry',
          chapter: null,
          title: 'The map',
          format: 1,
          html: '<p><strong>North</strong> of the river.</p>',
          createdAt: written(5),
          modifiedAt: written(6),
          modifiedBy: 'Thorin',
          modifiedIn: 'foundry',
          author: null,
          rev: rev(14),
        },
        {
          id: NOTE_IDS.long,
          role: 'entry',
          chapter: null,
          title: 'The long tale',
          format: 2,
          markdown: 'Once upon a time…',
          cut: true,
          createdAt: written(7),
          modifiedAt: written(7),
          modifiedBy: 'Gamemaster',
          modifiedIn: 'foundry',
          author: null,
          rev: rev(15),
        },
      ],
    },
    ...fields,
  }
}

/**
 * A book of notes as its page is sent it, from module 0.34.0: Thorin's own, a chapter with an entry
 * of his synced and one waiting for the game. From module 0.35.0 each of its groups, the notes in
 * no chapter first, has its order synced, unless the fields give them.
 */
export function mockNotesView(fields: Partial<NotesView> = {}): NotesView {
  const view: Omit<NotesView, 'groups'> = {
    version: 3,
    kind: 'personal',
    journal: "Thorin's notes (Erebor)",
    live: true,
    enabled: true,
    canAdd: true,
    connected: true,
    canReorder: true,
    orders: true,
    chapters: [
      {
        id: NOTE_IDS.session,
        title: 'Session 1',
        html: '',
        createdAt: '2026-10-21T19:00:00.000Z',
        modifiedAt: '2026-10-21T19:00:00.000Z',
        modifiedBy: 'Thorin',
        modifiedIn: 'app',
        state: 'synced',
        canRename: true,
        stamp: `n:${rev(11)}`,
      },
    ],
    entries: [
      {
        id: NOTE_IDS.cave,
        chapterId: NOTE_IDS.session,
        title: 'The goblin cave',
        html: '<h5>Loot</h5><ul><li>30 gp</li><li>a <em>strange</em> key</li></ul>',
        body: '### Loot\n- 30 gp\n- a *strange* key',
        createdAt: '2026-10-21T19:01:00.000Z',
        author: { name: 'Thorin' },
        modifiedAt: '2026-10-21T19:02:00.000Z',
        modifiedBy: 'Thorin',
        modifiedIn: 'app',
        state: 'synced',
        canEdit: true,
        canDelete: true,
        stamp: `n:${rev(12)}`,
      },
      {
        id: 'waitingNote00001',
        chapterId: NOTE_IDS.session,
        title: 'Waiting',
        html: '<p>Not yet in Foundry.</p>',
        body: 'Not yet in Foundry.',
        createdAt: '2026-10-21T19:05:00.000Z',
        author: { name: 'Thorin' },
        modifiedAt: '2026-10-21T19:05:00.000Z',
        modifiedBy: 'Thorin',
        modifiedIn: 'app',
        state: 'waiting',
        canEdit: true,
        canDelete: true,
        stamp: 'w:7d2c3f5e-1b0a-4c8e-9f6d-2a1b3c4d5e6f.0',
      },
    ],
    ...fields,
  }
  return {
    ...view,
    groups:
      fields.groups ??
      [null, ...view.chapters.map(({ id }) => id)].map(chapterId => ({
        chapterId,
        state: 'synced',
        stamp: 'g:0000000000000000',
      })),
  }
}

/** A note command as the module fetches it, from module 0.34.0: Thorin's player adding an entry. */
export function mockNoteCommand(
  fields: Partial<NotePageCommand['note']> = {},
): NotePageCommand {
  return {
    id: '7d2c3f5e-1b0a-4c8e-9f6d-2a1b3c4d5e6f.0',
    actorId: PARTY.thorin,
    kind: 'note',
    note: {
      book: 'personal',
      op: 'create',
      id: NOTE_IDS.cave,
      role: 'entry',
      base: null,
      writer: PARTY.thorin,
      at: written(1),
      title: 'The goblin cave',
      markdown: '### Loot',
      chapter: NOTE_IDS.session,
      createdAt: written(1),
      ...fields,
    },
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
  }
}

// Module 0.36.0: a character's companions, damage on its own, and recharges.

/** Brakka, a wolf Thorin's player owns in Foundry, linked: an owned companion. */
export function mockCompanionEntry(
  fields: Partial<CompanionEntry> = {},
): CompanionEntry {
  return {
    key: 'wolfBrakka',
    of: [PARTY.thorin],
    kind: 'owned',
    actorId: 'wolfBrakka',
    tokenId: null,
    sceneId: null,
    uuid: 'Actor.wolfBrakka',
    name: 'Wolf',
    img: 'worlds/frost-road/wolf.webp',
    summon: null,
    ...fields,
  }
}

/** An imp Thorin summoned with Find Familiar, on the active scene: a token's creature. */
export function mockSummonedEntry(
  fields: Partial<CompanionEntry> = {},
): CompanionEntry {
  return {
    key: 'sceneFrost-tokenImp',
    of: [PARTY.thorin],
    kind: 'summoned',
    actorId: 'impTemplate',
    tokenId: 'tokenImp',
    sceneId: 'sceneFrost',
    uuid: 'Scene.sceneFrost.Token.tokenImp.Actor.impTemplate',
    name: 'Imp',
    img: 'worlds/frost-road/imp.webp',
    summon: {
      itemId: 'findFamiliar',
      item: 'Find Familiar',
      activityId: 'summonFamiliar',
    },
    ...fields,
  }
}

/** What a wolf's sheet says of it as a creature: a CR 1/4 beast. */
export function mockCreature(
  fields: Partial<SheetCreature> = {},
): SheetCreature {
  return {
    cr: 0.25,
    type: 'Beast',
    size: 'Medium',
    alignment: 'Unaligned',
    important: false,
    legendary: null,
    resistance: null,
    lair: null,
    hitDice: { denomination: 'd8', value: 2, max: 2 },
    ...fields,
  }
}

/** A Bite's damage on its own, 1d8 + 3 slashing, and a critical hit's, 2d8 + 3. */
export function mockTableDamage(
  fields: Partial<TableDamagePlan> = {},
): TableDamagePlan {
  return {
    normal: {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 3',
          type: 'Slashing',
          dice: [{ faces: 8, number: 1 }],
          perDie: 1,
        },
      ],
    },
    critical: {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '2d8 + 3',
          type: 'Slashing',
          dice: [{ faces: 8, number: 2 }],
          perDie: 2,
        },
      ],
    },
    ...fields,
  }
}

/** The wolf's Bite, an attack whose damage may go on its own. */
export function biteAction(fields: Partial<SheetAction> = {}): SheetAction {
  return sheetAction({
    id: 'wolfBite',
    name: 'Bite',
    type: 'weapon',
    toHit: 4,
    attackId: 'biteAttack',
    damage: [{ formula: '1d8 + 3', type: 'Slashing', healing: false }],
    tableDamage: mockTableDamage(),
    ...fields,
  })
}

/**
 * A breath of frost, a save whose damage may go on its own, never a critical hit's, and whose
 * uses recharge on a 5 or 6, spent.
 */
export function frostBreathAction(
  fields: Partial<SheetAction> = {},
): SheetAction {
  const damage = {
    critical: false,
    plannable: true,
    rolls: [
      {
        formula: '2d6',
        type: 'Cold',
        dice: [{ faces: 6, number: 2 }],
        perDie: 1,
      },
    ],
  }
  return sheetAction({
    id: 'frostBreath',
    name: 'Frost Breath',
    activity: {
      id: 'frostSave',
      type: 'save',
      targets: {
        self: false,
        area: true,
        count: null,
        perLevel: null,
        affects: null,
      },
    },
    save: { ability: 'DEX', dc: 12 },
    damage: [{ formula: '2d6', type: 'Cold', healing: false }],
    tableDamage: { normal: damage, critical: null },
    uses: {
      value: 0,
      max: 1,
      recovery: 'Recharge [5+]',
      recharge: 5,
      counter: { item: 'frostBreath' },
    },
    ...fields,
  })
}

/** The wolf's sheet, as module 0.36.0 sends an NPC's: its creature, its Bite and Frost Breath. */
export function mockCompanionSheet(
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  return characterSheet({
    img: 'worlds/frost-road/wolf.webp',
    level: null,
    classes: [],
    species: null,
    background: null,
    hp: { value: 11, max: 11, temp: 0 },
    ac: 13,
    proficiency: 2,
    initiative: 2,
    creature: mockCreature(),
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [biteAction(), frostBreathAction()],
      },
    ],
    ...fields,
  })
}

/** A table view of Thorin's, as the app serves it, with no sheet unless given. */
export function mockTableView(fields: Partial<TableView> = {}): TableView {
  return {
    version: 7,
    live: true,
    campaign: { title: 'The Frost Road' },
    connected: true,
    messages: [],
    ...fields,
  }
}

/** The wolf's own view, for its pane, each its own roll unless given. */
export function mockCompanionView(
  fields: Partial<CompanionView> = {},
): CompanionView {
  return {
    version: 7,
    live: true,
    connected: true,
    companion: { key: 'wolfBrakka', name: 'Wolf', kind: 'owned' },
    rollsToTable: ['attack', 'damage', 'use', 'itemDamage', 'recharge'],
    rollFeatures: ['modifiers'],
    initiative: { mode: 'own' },
    ...fields,
  }
}

/** Thorin's player's Character in The Frost Road, by his Foundry id, as his companions name him. */
export const FROST_THORIN = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Frost Road',
  campaignId: 'c1',
  actorId: PARTY.thorin,
}

/**
 * The Frost Road as held, for a companion's routes: Thorin and Vex, Thorin's wolf and imp listed,
 * its game taking their attacks and damage, each rolling its own initiative.
 */
export function mockCompanionCampaign(fields: object = {}) {
  return {
    id: 'c1',
    title: 'The Frost Road',
    origin: 'https://my-game.forge-vtt.com',
    ownerId: 'gm-1',
    version: 7,
    lastSeenAt: new Date(Date.now() - 5000),
    characters: [
      { id: PARTY.thorin, name: 'Thorin' },
      { id: PARTY.vex, name: 'Vex' },
    ],
    companions: [mockCompanionEntry(), mockSummonedEntry()],
    companionKinds: ['attack', 'damage'],
    companionInitiative: 'own',
    rollsEnabled: true,
    rollKinds: ['skill', 'attack', 'damage'],
    rollFeatures: [] as string[],
    bridgePolledAt: new Date(Date.now() - 5000),
    transfersEnabled: false,
    removalsEnabled: false,
    ...fields,
  }
}

/**
 * A fight as Thorin's page shows it (module 0.36.0, End Turn): started, in round 1, Thorin first,
 * then his wolf Brakka, a goblin, Vex, Vex's own wolf, and the Bat Thorin summoned, for a turn
 * after Brakka's that's his too (Undo); Thorin's turn unless another is given.
 */
export function mockTurnCombat(fields: Partial<TableCombat> = {}): TableCombat {
  return {
    id: 'cmbt1',
    name: null,
    started: true,
    round: 1,
    currentId: 'c-thorin',
    combatants: [
      {
        id: 'c-thorin',
        name: 'Thorin',
        initiative: 20,
        defeated: false,
        side: 'me',
        hp: { value: 31, max: 44, temp: 0 },
      },
      {
        id: 'c-brakka',
        name: 'Brakka',
        initiative: 18,
        defeated: false,
        side: 'party',
        hp: { value: 11, max: 11, temp: 0 },
        yours: true,
        companion: 'wolfBrakka',
      },
      {
        id: 'c-goblin',
        name: 'Goblin',
        initiative: 12,
        defeated: false,
        side: 'other',
      },
      {
        id: 'c-vex',
        name: 'Vex',
        initiative: 10,
        defeated: false,
        side: 'party',
        hp: { value: 20, max: 27, temp: 0 },
      },
      {
        id: 'c-vex-wolf',
        name: 'Wolf',
        initiative: 8,
        defeated: false,
        side: 'party',
        hp: { value: 11, max: 11, temp: 0 },
      },
      {
        id: 'c-bat',
        name: 'Bat',
        initiative: 6,
        defeated: false,
        side: 'party',
        hp: { value: 1, max: 1, temp: 0 },
        yours: true,
        companion: 'scene1-batToken',
      },
    ],
    ...fields,
  }
}
