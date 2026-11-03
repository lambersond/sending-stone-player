import { GM_UNSENT, toCommand } from './commands'
import { TEXTS } from '@/mocks/sending-stone'
import type { HeldRollRequest } from './types'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const request = (fields: Partial<RollRequestInput>): RollRequestInput => ({
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  ...fields,
})

const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
  id: 'req-1',
  actorId: 'actor-thorin',
  role: 'player',
  kind: 'skill',
  payload: request({}),
  status: 'pending',
  result: null,
  createdAt: ago(1000),
  claimedAt: null,
  ...fields,
})

describe('utils/roll-requests', () => {
  describe('GM_UNSENT', () => {
    it('holds Wild Shape, from module 0.40.0, which would be the player’s in the game', () => {
      expect(GM_UNSENT.has('wildShape')).toBe(true)
    })

    it('holds a favorite, from module 0.37.0, which posts nothing to mark it theirs', () => {
      expect(GM_UNSENT.has('favorite')).toBe(true)
      expect(GM_UNSENT.has('remove')).toBe(false)
    })

    it('holds an effect changed, from module 0.39.0, which posts nothing either', () => {
      expect(GM_UNSENT.has('effect')).toBe(true)
    })
  })

  describe('toCommand', () => {
    it('sends the module what to roll, whose, and with which dice', () => {
      expect(toCommand(held())).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
      })
    })

    it("sends the link a description's roll is for, and the kinds of damage chosen", () => {
      const payload = request({
        kind: 'textDamage',
        key: undefined,
        text: TEXTS.secondWind,
        link: 3,
        dice: [{ faces: 6, results: [2, 6] }],
        types: ['cold', null],
      })

      expect(toCommand(held({ kind: 'textDamage', payload }))).toEqual({
        ...payload,
        id: 'req-1',
        actorId: 'actor-thorin',
      })
    })

    it("says a roll is the Gamemaster's as the character, and a player's as ever, saying nothing of it (#156)", () => {
      expect(toCommand(held({ role: 'gm' }))).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
        by: 'gm',
      })
      const player = toCommand(held({ role: 'player' }))
      expect(player).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
      })
      expect(player).not.toHaveProperty('by')
      expect(JSON.stringify(player)).toBe(
        JSON.stringify({
          ...request({}),
          id: 'req-1',
          actorId: 'actor-thorin',
        }),
      )
    })
  })
})

/** What a request of the kinds from module 0.29.0 throws: nothing. */
const plain = { mode: 0, explicit: false, extras: [], dice: [] } as const

/** A turn as the page was shown it: this combatant's, in round 2 unless said. */
const turnOf = (combatantId: string, round = 2) => ({
  combatId: 'cmbt1',
  round,
  combatantId,
})

describe('utils/roll-requests, a turn ended, from module 0.36.0', () => {
  it('sends the module a turn ended as it is, the character’s, with no companion named', () => {
    const payload = {
      kind: 'endTurn' as const,
      turn: turnOf('c-brakka'),
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [],
    }
    const command = toCommand(
      held({ kind: 'endTurn', payload, ofActorId: null }),
    )
    expect(command).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
    expect(command).not.toHaveProperty('of')
    expect(command).not.toHaveProperty('by')
  })
})

describe('utils/roll-requests, a turn taken back, from module 0.36.0', () => {
  it('sends the module a turn taken back as it is, the character’s, with no companion named', () => {
    const payload = {
      kind: 'undoEndTurn' as const,
      undo: 'req-0',
      turn: turnOf('c-brakka'),
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [],
    }
    const command = toCommand(
      held({ kind: 'undoEndTurn', payload, ofActorId: null }),
    )
    expect(command).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
    expect(command).not.toHaveProperty('of')
    expect(command).not.toHaveProperty('by')
  })
})

/** Damage on its own of one of Thorin's rows, with these dice and fields. */
const choosing = (
  item: string,
  activity: string,
  dice: { faces: number; results: number[] }[],
  fields: Partial<RollRequestInput> = {},
) =>
  request({
    kind: 'itemDamage',
    key: undefined,
    item,
    activity,
    dice,
    ...fields,
  })
/** Burning Hands' fire: so many d6s. */
const handsAlone = (count: number, fields: Partial<RollRequestInput> = {}) =>
  choosing(
    'hands',
    'handsSave',
    [{ faces: 6, results: Array.from({ length: count }, () => 3) }],
    fields,
  )

describe("utils/roll-requests, damage on its own's choices, from module 0.41.0", () => {
  it('sends the module the choices as they were asked for', () => {
    const payload = handsAlone(4, { slot: 'spell2', consume: true })
    expect(toCommand(held({ kind: 'itemDamage', payload }))).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
  })
})

describe('utils/roll-requests, a spell slot spent or restored, from module 0.42.1', () => {
  it('is no roll the Gamemaster never sends: their page spends and restores one, marked theirs', () => {
    expect(GM_UNSENT.has('spellSlot')).toBe(false)
  })

  it('is sent to the game as it came, the Gamemaster’s marked theirs', () => {
    const payload = {
      kind: 'spellSlot',
      ...plain,
      spellSlot: { op: 'restore', id: 'pact', from: 0 },
    }
    expect(toCommand(held({ kind: 'spellSlot', role: 'gm', payload }))).toEqual(
      { ...payload, id: 'req-1', actorId: 'actor-thorin', by: 'gm' },
    )
    expect(toCommand(held({ kind: 'spellSlot', payload }))).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
  })
})

describe('utils/roll-requests, a spell prepared or unprepared, from module 0.42.1', () => {
  it('is sent to the game as it came', () => {
    const payload = {
      kind: 'prepare',
      ...plain,
      prepare: { op: 'unprepare', id: 'bless' },
    }
    expect(toCommand(held({ kind: 'prepare', payload }))).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
  })
})
