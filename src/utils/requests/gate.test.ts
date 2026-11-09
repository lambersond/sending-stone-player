import { combatOf, companionRefusal, rollGate } from './gate'
import {
  characterSheet,
  combat,
  combatant,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { RollCampaign } from '@/utils/requests/types'

const NOW = Date.parse('2026-11-09T12:00:00Z')

/** A roll of a kind, made normally, with no dice yet. */
const roll = (fields: Partial<RollRequestInput> = {}): RollRequestInput => ({
  kind: 'skill',
  key: 'ath',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  ...fields,
})

/** Thorin's player at his sheet, or the campaign's Gamemaster at it. */
const seat = (fields: Partial<SheetSeat> = {}): SheetSeat => ({
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: PARTY.thorin,
  role: 'player',
  userId: 'user-1',
  characterId: 'char-1',
  ...fields,
})

/** Thorin's wolf's seat, from his own. */
const atWolf = seat({
  actorId: 'wolfBrakka',
  companion: { of: PARTY.thorin, entry: mockCompanionEntry() },
})

/** A campaign whose game is fetching rolls now, of these kinds, doing these things with them. */
const campaign = (fields: Partial<RollCampaign> = {}): RollCampaign => ({
  rollsEnabled: true,
  rollKinds: ['skill', 'ability', 'save', 'attack', 'itemDamage', 'endTurn'],
  rollFeatures: [],
  bridgePolledAt: new Date(NOW - 5000),
  characters: [],
  companions: [],
  companionKinds: ['skill', 'save'],
  companionInitiative: 'own',
  ...fields,
})

describe('utils/requests/gate', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rollGate', () => {
    it('takes a roll of a kind the game takes now, asking nothing it does not do', () => {
      expect(rollGate(seat(), roll(), campaign())).toBeUndefined()
      expect(
        rollGate(
          seat({ role: 'gm', characterId: null }),
          roll(),
          campaign({ rollFeatures: ['gmRolls'] }),
        ),
      ).toBeUndefined()
    })

    it.each([
      ['no campaign', seat(), roll(), null],
      ['rolls off', seat(), roll(), campaign({ rollsEnabled: false })],
      [
        'a module not fetching',
        seat(),
        roll(),
        campaign({ bridgePolledAt: new Date(NOW - 3_600_000) }),
      ],
      [
        'a kind the game does not take',
        seat(),
        roll({ kind: 'tool' }),
        campaign(),
      ],
      [
        "the Gamemaster's where the game does not make them as the character's",
        seat({ role: 'gm', characterId: null }),
        roll(),
        campaign(),
      ],
      [
        "the Gamemaster's of a kind that leaves no mark of theirs",
        seat({ role: 'gm', characterId: null }),
        roll({ kind: 'endTurn' }),
        campaign({ rollFeatures: ['gmRolls'] }),
      ],
      [
        "a companion's of a kind the game takes for no companion",
        atWolf,
        roll({ kind: 'attack' }),
        campaign(),
      ],
    ])('refuses %s as unavailable', (_, at, input, held) => {
      expect(rollGate(at, input, held)).toEqual({
        status: 409,
        reason: 'unavailable',
      })
    })

    it("refuses a companion's answer to what the game asked where the game asks companions nothing", () => {
      const answer = roll({ kind: 'save', key: 'dex', prompt: 'prompt-1' })
      expect(
        rollGate(atWolf, answer, campaign({ rollFeatures: ['prompts'] })),
      ).toEqual({ status: 422, reason: 'prompt' })
      expect(
        rollGate(
          atWolf,
          answer,
          campaign({ rollFeatures: ['prompts', 'companionPrompts'] }),
        ),
      ).toBeUndefined()
    })

    it.each([
      [
        'damage changed',
        roll({ kind: 'itemDamage', modifiers: { extra: 1 } }),
        'modifiers',
      ],
      [
        "damage on its own's slot",
        roll({ kind: 'itemDamage', slot: 'spell2' }),
        'aloneChoices',
      ],
      [
        "damage on its own's attack mode",
        roll({ kind: 'itemDamage', attackMode: 'twoHanded' }),
        'aloneChoices',
      ],
      [
        "damage on its own's ammunition",
        roll({ kind: 'itemDamage', ammunition: 'arrows' }),
        'aloneChoices',
      ],
      [
        "damage on its own's spend",
        roll({ kind: 'itemDamage', consume: true }),
        'aloneChoices',
      ],
      ['an answer', roll({ kind: 'save', key: 'dex', prompt: 'p' }), 'prompts'],
      ['an area attack', roll({ kind: 'attack', targets: [] }), 'areaAttacks'],
      [
        'a check an activity asks for',
        roll({ kind: 'ability', key: 'str', item: 'item-1' }),
        'activityChecks',
      ],
    ] as [string, RollRequestInput, string][])(
      'takes %s only where the game does that',
      (_, input, feature) => {
        expect(rollGate(seat(), input, campaign())).toEqual({
          status: 409,
          reason: 'unavailable',
        })
        expect(
          rollGate(seat(), input, campaign({ rollFeatures: [feature] })),
        ).toBeUndefined()
      },
    )

    it('takes an attack with no targets picked, and damage with no choices, from any game', () => {
      expect(
        rollGate(seat(), roll({ kind: 'attack' }), campaign()),
      ).toBeUndefined()
      expect(
        rollGate(seat(), roll({ kind: 'itemDamage' }), campaign()),
      ).toBeUndefined()
    })
  })

  describe('combatOf', () => {
    const turn = { combatId: 'cmbt-turn', round: 1, combatantId: 'c1' }
    it.each([
      [
        'initiative',
        roll({ kind: 'initiative', combatId: 'cmbt-init' }),
        'cmbt-init',
      ],
      ['an End Turn', roll({ kind: 'endTurn', turn }), 'cmbt-turn'],
      [
        'an End Turn taken back',
        roll({ kind: 'undoEndTurn', turn }),
        'cmbt-turn',
      ],
      [
        "an attack's target",
        roll({
          kind: 'attack',
          target: { combatId: 'cmbt-a', combatantId: 'x' },
        }),
        'cmbt-a',
      ],
      [
        "an area attack's first target",
        roll({
          kind: 'attack',
          targets: [
            { combatId: 'cmbt-b', combatantId: 'x' },
            { combatId: 'cmbt-c', combatantId: 'y' },
          ],
        }),
        'cmbt-b',
      ],
      ['a skill', roll(), undefined],
    ] as [string, RollRequestInput, string | undefined][])(
      'names the combat of %s',
      (_, input, combatId) => {
        expect(combatOf(input)).toBe(combatId)
      },
    )
  })

  describe('companionRefusal', () => {
    const wolf = atWolf.companion
    const fight = combat({
      id: 'cmbt1',
      combatants: [combatant({ id: 'c-thorin', character: PARTY.thorin })],
    })
    const after = { companionInitiative: 'after' }

    it("refuses nothing of a character's own roll", () => {
      expect(
        companionRefusal(
          roll({ kind: 'death' }),
          undefined,
          undefined,
          [fight],
          after,
        ),
      ).toBeUndefined()
    })

    it('refuses a death saving throw but of an important NPC', () => {
      const death = roll({ kind: 'death' })
      const sheet = characterSheet()
      expect(companionRefusal(death, wolf, sheet, [], after)).toBe('not-dying')
      expect(companionRefusal(death, wolf, undefined, [], after)).toBe(
        'not-dying',
      )
      const important = {
        cr: 1,
        type: 'Humanoid',
        size: 'Medium',
        alignment: null,
        important: true,
        legendary: null,
        resistance: null,
        lair: null,
        hitDice: null,
      }
      expect(
        companionRefusal(
          death,
          wolf,
          { ...sheet, creature: important },
          [],
          after,
        ),
      ).toBeUndefined()
    })

    it('refuses its initiative where it acts after its character, who is in that combat', () => {
      const initiative = roll({ kind: 'initiative', combatId: 'cmbt1' })
      expect(
        companionRefusal(initiative, wolf, undefined, [fight], after),
      ).toBe('follows')
      expect(
        companionRefusal(initiative, wolf, undefined, [fight], {
          companionInitiative: 'own',
        }),
      ).toBeUndefined()
      expect(
        companionRefusal(
          roll({ kind: 'initiative', combatId: 'other' }),
          wolf,
          undefined,
          [fight],
          after,
        ),
      ).toBeUndefined()
      expect(
        companionRefusal(
          initiative,
          wolf,
          undefined,
          [combat({ id: 'cmbt1', combatants: [combatant({ id: 'goblin' })] })],
          after,
        ),
      ).toBeUndefined()
    })
  })
})
