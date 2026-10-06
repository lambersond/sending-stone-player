/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import type {
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  SerializedMessage,
  SheetAbility,
  SheetAction,
  SheetItem,
  SheetSpell,
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
