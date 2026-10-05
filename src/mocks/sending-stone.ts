/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import type {
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  SerializedMessage,
  SheetAbility,
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
} as const

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
