/**
 * @jest-environment node
 */
import { hitPointsText } from './feature-words'
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

describe('features/campaigns/utils/feature-words, hit points from the app (module 0.44.0)', () => {
  it.each([
    [
      'on in Foundry',
      { hitPoints: { enabled: true }, foundry: foundry('0.44.0') },
      'On in Foundry. Your players set their characters’, forms’ and companions’ hit points and temporary hit points from here.',
    ],
    [
      'a module before 0.44.0',
      { foundry: foundry('0.42.1') },
      'Your Sending Stone module doesn’t let players change hit points yet. Version 0.44.0 or later does.',
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
