import { commandPayload, keptLabel, rollPayload } from './payloads'
import { mockCompanionEntry, PARTY } from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'

/** Thorin's player at his sheet. */
const thorin: SheetSeat = {
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: PARTY.thorin,
  role: 'player',
  userId: 'user-1',
  characterId: 'char-1',
}

/** A d20 thrown and typed in, with what only the app keeps of it. */
const typedRoll = (
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'skill',
  key: 'ath',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  label: 'Athletics',
  typed: true,
  ...fields,
})

/** A campaign that lets Thorin's player type in his dice, its game doing these things too. */
const typing = (features: string[] = [], manualDice = true) => ({
  characters: [{ id: PARTY.thorin, name: 'Thorin', manualDice }],
  rollFeatures: ['manualDice', ...features],
})

describe('utils/requests/payloads', () => {
  describe('rollPayload', () => {
    it('marks dice typed in where the player may type theirs, and never sends the label', () => {
      expect(rollPayload(thorin, typedRoll(), typing())).toEqual({
        kind: 'skill',
        key: 'ath',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [14] }],
        typed: true,
      })
    })

    it.each([
      [
        'the game takes no typed dice',
        thorin,
        typedRoll(),
        { ...typing(), rollFeatures: [] },
      ],
      [
        'the character does not type them, as the game said last',
        thorin,
        typedRoll(),
        typing([], false),
      ],
      [
        'the Gamemaster sent it',
        { ...thorin, role: 'gm' as const },
        typedRoll(),
        typing(),
      ],
      ['there are no dice', thorin, typedRoll({ dice: [] }), typing()],
      [
        'the page did not type them',
        thorin,
        typedRoll({ typed: undefined }),
        typing(),
      ],
    ])('sends the same dice unmarked where %s', (_, seat, input, campaign) => {
      const payload = rollPayload(seat, input, campaign)
      expect(payload).not.toHaveProperty('typed')
      expect(payload).not.toHaveProperty('label')
      expect(payload.dice).toEqual(input.dice)
    })

    it("types a companion's dice as its character's are", () => {
      const atWolf: SheetSeat = {
        ...thorin,
        actorId: 'wolfBrakka',
        companion: { of: PARTY.thorin, entry: mockCompanionEntry() },
      }
      expect(rollPayload(atWolf, typedRoll(), typing())).toHaveProperty(
        'typed',
        true,
      )
    })

    it('sends the dice its effects add, and that its rerolls are kept, only to a game that takes them', () => {
      const input = typedRoll({
        effectDice: [{ faces: 4, sign: 1, results: [3] }],
        rerolls: 'kept',
      })

      const taken = rollPayload(
        thorin,
        input,
        typing(['effectDice', 'keptRerolls']),
      )
      expect(taken).toMatchObject({
        effectDice: [{ faces: 4, sign: 1, results: [3] }],
        rerolls: 'kept',
      })

      const untaken = rollPayload(thorin, input, typing())
      expect(untaken).not.toHaveProperty('effectDice')
      expect(untaken).not.toHaveProperty('rerolls')
      // Nor where nothing was typed in.
      const unmarked = rollPayload(
        thorin,
        { ...input, typed: undefined },
        typing(['effectDice', 'keptRerolls']),
      )
      expect(unmarked).not.toHaveProperty('effectDice')
      expect(unmarked).not.toHaveProperty('rerolls')
    })
  })

  describe('commandPayload', () => {
    it('sends neither its label, nor that it was typed in, nor that its rerolls were kept', () => {
      const input = typedRoll({
        kind: 'transfer',
        rerolls: 'kept',
      })
      const payload = commandPayload(input)
      expect(payload).not.toHaveProperty('label')
      expect(payload).not.toHaveProperty('typed')
      expect(payload).not.toHaveProperty('rerolls')
      expect(payload).toMatchObject({ kind: 'transfer', key: 'ath' })
      // Its input is left as it was.
      expect(input).toHaveProperty('label', 'Athletics')
    })
  })

  describe('keptLabel', () => {
    it("keeps what the Gamemaster's page called it, never a player's", () => {
      expect(keptLabel({ role: 'gm' }, 'Athletics')).toEqual({
        label: 'Athletics',
      })
      expect(keptLabel({ role: 'gm' }, undefined)).toEqual({})
      expect(keptLabel({ role: 'player' }, 'Athletics')).toEqual({})
    })
  })
})
