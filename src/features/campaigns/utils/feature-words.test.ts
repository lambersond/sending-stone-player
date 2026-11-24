/**
 * @jest-environment node
 */
import {
  coinsText,
  companionsLine,
  constantText,
  healthText,
  hitPointsText,
  movesText,
} from './feature-words'
import type { OwnedCampaign } from '@/types/campaign'

/** A campaign as its card is drawn, with what's given. */
const campaign = (fields: Partial<OwnedCampaign> = {}): OwnedCampaign => ({
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  inviteCode: 'code-1',
  connected: true,
  rosterReceived: true,
  live: true,
  rolls: {
    enabled: false,
    reaching: false,
    attacks: false,
    spells: false,
    prompts: false,
  },
  transfers: { enabled: false, reaching: false },
  chat: { messages: 0 },
  characters: [],
  groups: [],
  ...fields,
})
/** What Foundry last said of itself: the module's version, and its system. */
const foundry = (version: string | null, system = 'dnd5e') => ({
  receivedAt: '2026-11-06T09:00:00.000Z',
  module: { id: 'sending-stone', version },
  system: { id: system, title: system, version: '5.3.3' },
})

describe('features/campaigns/utils/feature-words, hit points from the app (module 0.43.0)', () => {
  it.each([
    [
      'on in Foundry',
      { hitPoints: { enabled: true }, foundry: foundry('0.44.0') },
      'On in Foundry. Your players set their characters’, forms’ and companions’ hit points and temporary hit points from here.',
    ],
    [
      'a module before 0.43.0',
      { foundry: foundry('0.42.1') },
      'Your Sending Stone module doesn’t let players change hit points yet. Version 0.43.0 or later does.',
    ],
    [
      'module 0.43.0, its switch off (ROADMAP item 51)',
      { hitPoints: { enabled: false }, foundry: foundry('0.43.0') },
      'Off. To let them, tick Allow Players to change their hit points from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
    [
      'another system',
      { hitPoints: { enabled: false }, foundry: foundry('0.44.0', 'pf2e') },
      'Off. Players’ hit points need D&D Fifth Edition in Foundry.',
    ],
    [
      'its switch off',
      { hitPoints: { enabled: false }, foundry: foundry('0.44.0') },
      'Off. To let them, tick Allow Players to change their hit points from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
  ])('says so with %s', (_name, fields, text) => {
    expect(hitPointsText(campaign(fields))).toBe(text)
  })
})

describe('features/campaigns/utils/feature-words, coins from the app (module 0.49.0)', () => {
  it.each([
    [
      'on in Foundry, other coins paying',
      { coins: { enabled: true, change: true }, foundry: foundry('0.49.0') },
      'On in Foundry. Your players add coins to their characters and remove them from here, and each change posts a line in your game’s chat. A character short of a coin pays with their other coins.',
    ],
    [
      'on in Foundry, no other coin paying',
      { coins: { enabled: true, change: false }, foundry: foundry('0.49.0') },
      'On in Foundry. Your players add coins to their characters and remove them from here, and each change posts a line in your game’s chat. A character short of a coin is refused.',
    ],
    [
      'a module before 0.49.0',
      { foundry: foundry('0.47.0') },
      'Your Sending Stone module doesn’t let players change coins yet. Version 0.49.0 or later does.',
    ],
    [
      'module 0.48.0, which has no switch for coins',
      { foundry: foundry('0.48.0') },
      'Your Sending Stone module doesn’t let players change coins yet. Version 0.49.0 or later does.',
    ],
    [
      'another system',
      {
        coins: { enabled: false, change: false },
        foundry: foundry('0.49.0', 'pf2e'),
      },
      'Off. Players’ coins need D&D Fifth Edition in Foundry.',
    ],
    [
      'its switch off',
      { coins: { enabled: false, change: false }, foundry: foundry('0.49.0') },
      'Off. To let them, tick Allow Players to add and take away coins from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
  ])('says so with %s', (_name, fields, text) => {
    expect(coinsText(campaign(fields))).toBe(text)
  })

  it.each([
    [
      // Changed on purpose (item 89): coins given to characters are whispered.
      'a module that hands coins out',
      true,
      'Your players take from and give to the parties they own in Foundry, and give to each other, from here; coins can go to several characters at once. Each move is made in your game at once and posts a line in its chat, but coins given to characters are whispered to each, and you are told.',
    ],
    [
      'a module before it',
      false,
      'Your players take from and give to the parties they own in Foundry, and give to each other, from here. Each move is made in your game at once and posts a line in its chat.',
    ],
  ])('says what moves reach the game with %s', (_name, handOut, text) => {
    const transfers = { enabled: true, reaching: true, handOut }
    expect(movesText(campaign({ transfers }))).toBe(text)
  })
})

describe('features/campaigns/utils/feature-words, other creatures’ health (module 0.50.0)', () => {
  it.each([
    [
      'on in Foundry, with their hit points',
      {
        health: { enabled: true, hitPoints: true },
        foundry: foundry('0.50.0'),
      },
      'On in Foundry. Your players see how hurt other creatures in a fight are, and their hit points.',
    ],
    [
      'on in Foundry, without their hit points',
      {
        health: { enabled: true, hitPoints: false },
        foundry: foundry('0.50.0'),
      },
      'On in Foundry. Your players see how hurt other creatures in a fight are, but not their hit points.',
    ],
    [
      'module 0.49.0, which has no switch for it',
      { foundry: foundry('0.49.0') },
      'Your Sending Stone module doesn’t show players other creatures’ health yet. Version 0.50.0 or later does.',
    ],
    [
      'another system',
      {
        health: { enabled: false, hitPoints: false },
        foundry: foundry('0.50.0', 'pf2e'),
      },
      'Off. Other creatures’ health needs D&D Fifth Edition in Foundry.',
    ],
    [
      'its switch off',
      {
        health: { enabled: false, hitPoints: false },
        foundry: foundry('0.50.0'),
      },
      'Off. To let them, tick Allow Players to see other creatures’ health in the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
  ])('says so with %s', (_name, fields, text) => {
    expect(healthText(campaign(fields))).toBe(text)
  })
})

// Module 0.51.0 (item 18): the Gamemaster's card marks a companion on another scene, so that
// tokens left on past maps can be found and tidied.
describe('features/campaigns/utils/feature-words, companions on another scene (module 0.51.0)', () => {
  it('marks one owned or summoned on another scene, numbering repeated names as before', () => {
    expect(
      companionsLine([
        { key: 'brakka', name: 'Brakka', kind: 'owned' },
        { key: 'sB-wolf', name: 'Wolf', kind: 'owned', away: true },
        {
          key: 'sA-bat1',
          name: 'Bat',
          kind: 'summoned',
          from: 'Find Familiar',
        },
        {
          key: 'sB-bat2',
          name: 'Bat',
          kind: 'summoned',
          from: 'Find Familiar',
          away: true,
        },
      ]),
    ).toBe(
      'Companions: Brakka, Wolf (on another scene), Bat 1 (summoned), Bat 2 (summoned, on another scene)',
    )
  })
})

// Module 0.54.0 (item 98): the companions the Gamemaster keeps beside a character, marked on the
// card's line and counted in its own row.
describe('features/campaigns/utils/feature-words, constant companions (module 0.54.0)', () => {
  it('marks a constant one, and one with no token on any scene', () => {
    expect(
      companionsLine([
        { key: 'brakka', name: 'Brakka', kind: 'owned' },
        { key: 'sA-bat1', name: 'Bat', kind: 'summoned', away: true },
        {
          key: 'steel',
          name: 'Steel Defender',
          kind: 'constant',
          unplaced: true,
        },
        { key: 'owl', name: 'Owl', kind: 'constant' },
        { key: 'hawk', name: 'Hawk', kind: 'constant', away: true },
      ]),
    ).toBe(
      'Companions: Brakka, Bat (summoned, on another scene), Steel Defender (constant, not on a scene), Owl (constant), Hawk (constant, on another scene)',
    )
  })

  /** Thorin's campaign with this many constant companions. */
  const many = (count: number) =>
    campaign({
      foundry: foundry('0.54.0'),
      characters: [
        {
          id: 't',
          name: 'Thorin',
          companions: Array.from({ length: count }, (_, at) => ({
            key: `c${at}`,
            name: `Construct ${at + 1}`,
            kind: 'constant' as const,
          })),
        },
      ],
    })

  const HOW =
    'A constant companion shows beside its character in the app with no token on a scene. Mark one on the campaign’s Companions tab in Sending Stone’s settings in Foundry.'
  const steel = {
    key: 'steel',
    name: 'Steel Defender',
    kind: 'constant' as const,
  }
  const owl = { key: 'owl', name: 'Owl', kind: 'constant' as const }
  const brakka = { key: 'brakka', name: 'Brakka', kind: 'owned' as const }

  it.each([
    [
      'an older module',
      {
        foundry: foundry('0.53.0'),
        characters: [{ id: 't', name: 'Thorin', companions: [steel] }],
      },
      'Your Sending Stone module doesn’t keep constant companions yet. Version 0.54.0 or later does.',
    ],
    [
      'none',
      {
        foundry: foundry('0.54.0'),
        characters: [{ id: 't', name: 'Thorin', companions: [brakka] }],
      },
      `None yet. ${HOW}`,
    ],
    [
      'one',
      {
        foundry: foundry('0.54.0'),
        characters: [{ id: 't', name: 'Thorin', companions: [brakka, steel] }],
      },
      `One in Foundry: Steel Defender, Thorin’s. ${HOW}`,
    ],
    [
      'two',
      {
        foundry: foundry('0.54.0'),
        characters: [
          { id: 't', name: 'Thorin', companions: [steel] },
          { id: 'v', name: 'Vex', companions: [owl] },
        ],
      },
      `Two in Foundry: Steel Defender, Thorin’s; Owl, Vex’s. ${HOW}`,
    ],
    [
      'one shared by two characters, said once',
      {
        foundry: foundry('0.54.0'),
        characters: [
          { id: 't', name: 'Thorin', companions: [steel] },
          { id: 'v', name: 'Vex', companions: [steel] },
        ],
      },
      `One in Foundry: Steel Defender, Thorin’s and Vex’s. ${HOW}`,
    ],
    [
      'one shared by three characters, the last after "and"',
      {
        foundry: foundry('0.54.0'),
        characters: [
          { id: 't', name: 'Thorin', companions: [steel] },
          { id: 'v', name: 'Vex', companions: [steel] },
          { id: 'm', name: 'Mira', companions: [steel] },
        ],
      },
      `One in Foundry: Steel Defender, Thorin’s, Vex’s and Mira’s. ${HOW}`,
    ],
    [
      'two of one name, told apart by key',
      {
        foundry: foundry('0.54.0'),
        characters: [
          {
            id: 't',
            name: 'Thorin',
            companions: [{ ...steel, key: 'sd-t' }],
          },
          { id: 'v', name: 'Vex', companions: [{ ...steel, key: 'sd-v' }] },
        ],
      },
      `Two in Foundry: Steel Defender, Thorin’s; Steel Defender, Vex’s. ${HOW}`,
    ],
    [
      'a module that hasn’t said its version',
      { characters: [{ id: 't', name: 'Thorin', companions: [steel] }] },
      `One in Foundry: Steel Defender, Thorin’s. ${HOW}`,
    ],
  ])('says so with %s', (_name, fields, text) => {
    expect(constantText(campaign(fields))).toBe(text)
  })

  it('counts in words to nine, then in digits', () => {
    expect(constantText(many(9))).toMatch(
      /^Nine in Foundry: Construct 1, Thorin’s; /,
    )
    expect(constantText(many(10))).toMatch(
      /^10 in Foundry: Construct 1, Thorin’s; .*Construct 10, Thorin’s\. /,
    )
  })
})
