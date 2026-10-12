/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import type {
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  SerializedMessage,
  SheetAbility,
  SheetAction,
  SheetActivity,
  SheetEnchantment,
  SheetFavorite,
  SheetItem,
  SheetSpell,
  SheetUse,
} from '@/types/sending-stone'

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
      combatant({ id: 'c-boss', name: 'Goblin Boss', initiative: 19 }),
      combatant({
        id: 'c-thorin',
        name: 'Thorin Oakenshield',
        initiative: 17,
        character: 'actor-thorin',
        playerOwned: true,
        hp: { value: 31, max: 44, temp: 0 },
      }),
    ],
    ...fields,
  }
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
            text: TEXTS.bless,
          },
        ],
      },
      {
        id: 'inactive',
        label: 'Inactive Effects',
        effects: [
          {
            id: 'rage',
            name: 'Rage',
            img: null,
            source: null,
            duration: null,
            disabled: true,
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
