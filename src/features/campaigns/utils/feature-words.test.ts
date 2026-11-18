/**
 * @jest-environment node
 */
import {
  coinsText,
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
      // Changed on purpose (item give): coins given to characters are whispered.
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
