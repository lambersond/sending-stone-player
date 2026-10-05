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
    ...fields,
  }
}
