/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  availableRollKinds,
  checkRoll,
  isDying,
  rollStatus,
  toCommand,
  toRollRequestView,
  type HeldRollRequest,
} from './roll-requests'
import {
  characterSheet,
  combat,
  combatant,
  fullerSheet,
  sheetFavorites,
} from '@/mocks/sending-stone'
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
  kind: 'skill',
  payload: request({}),
  status: 'pending',
  result: null,
  createdAt: ago(1000),
  claimedAt: null,
  ...fields,
})

describe('utils/roll-requests', () => {
  describe('availableRollKinds', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['save', 'skill', 'attack'],
      bridgePolledAt: ago(10_000),
    }

    it('offers the rolls the game takes, while the module is fetching them', () => {
      expect(availableRollKinds(campaign, NOW)).toEqual(['skill', 'save'])
    })

    it('offers none while the Gamemaster has them off, or the module has stopped fetching', () => {
      expect(
        availableRollKinds({ ...campaign, rollsEnabled: false }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: ago(45_000) }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: null }, NOW),
      ).toEqual([])
    })
  })

  describe('checkRoll', () => {
    const sheet = fullerSheet({ favorites: sheetFavorites() })

    it('lets the character roll a skill, ability, save or tool its sheet has', () => {
      expect(checkRoll(request({}), sheet, [], 'actor-thorin')).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'save', key: 'con' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'ability', key: 'str' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'thief' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })

    it('refuses what the sheet lacks, or a roll without a sheet', () => {
      expect(
        checkRoll(request({ key: 'xyz' }), sheet, [], 'actor-thorin'),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'save', key: 'luck' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'herb' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'thief' }),
          characterSheet(),
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(checkRoll(request({}), undefined, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('lets only a dying character roll a death save', () => {
      const death = request({ kind: 'death', key: undefined })
      const dying = characterSheet({
        hp: { value: 0, max: 44, temp: 0 },
        deathSaves: { success: 1, failure: 2 },
      })
      expect(checkRoll(death, dying, [], 'actor-thorin')).toBeUndefined()
      expect(checkRoll(death, characterSheet(), [], 'actor-thorin')).toBe(
        'not-dying',
      )
    })

    it('lets the character roll initiative only in the combat, and only once', () => {
      const initiative = request({
        kind: 'initiative',
        key: undefined,
        combatId: 'cmbt1',
      })
      const waiting = combat({
        combatants: [
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            initiative: null,
          }),
        ],
      })
      expect(
        checkRoll(initiative, sheet, [waiting], 'actor-thorin'),
      ).toBeUndefined()
      expect(checkRoll(initiative, sheet, [combat()], 'actor-thorin')).toBe(
        'already-rolled',
      )
      expect(checkRoll(initiative, sheet, [waiting], 'actor-vex')).toBe(
        'not-in-combat',
      )
      expect(checkRoll(initiative, sheet, [], 'actor-thorin')).toBe(
        'not-in-combat',
      )
    })
  })

  describe('isDying', () => {
    it('is so at 0 hit points, until three successes or failures, as dnd5e has it', () => {
      const at = (value: number, success: number, failure: number) =>
        isDying({
          hp: { value, max: 44, temp: 0 },
          deathSaves: { success, failure },
        })
      expect(at(0, 0, 0)).toBe(true)
      expect(at(0, 2, 2)).toBe(true)
      expect(at(0, 3, 0)).toBe(false)
      expect(at(0, 0, 3)).toBe(false)
      expect(at(1, 0, 0)).toBe(false)
      expect(
        isDying({ hp: { value: 0, max: 44, temp: 0 }, deathSaves: null }),
      ).toBe(false)
      expect(isDying()).toBe(false)
    })
  })

  describe('rollStatus', () => {
    it('is sending until the module fetches it, then expired', () => {
      expect(rollStatus(held(), NOW)).toBe('sending')
      expect(rollStatus(held({ createdAt: ago(30_000) }), NOW)).toBe('expired')
    })

    it('is rolling once fetched, then lost without an answer', () => {
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(74_000) }), NOW),
      ).toBe('rolling')
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(75_000) }), NOW),
      ).toBe('lost')
      expect(
        rollStatus(
          held({ status: 'claimed', claimedAt: null, createdAt: ago(76_000) }),
          NOW,
        ),
      ).toBe('lost')
    })

    it('is what the module answered', () => {
      expect(rollStatus(held({ status: 'done' }), NOW)).toBe('done')
      expect(rollStatus(held({ status: 'failed' }), NOW)).toBe('failed')
    })
  })

  describe('toRollRequestView', () => {
    const summary = {
      formula: '1d20 + 4',
      total: 18,
      dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
    }

    it("shows the game's roll and total once made", () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: true,
              rolls: [summary],
            },
          }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 18,
        rolls: [
          {
            formula: '1d20 + 4',
            total: 18,
            dice: [{ faces: 20, value: 14, active: true }],
            advantage: false,
            disadvantage: false,
            critical: false,
            fumble: false,
            damageType: undefined,
          },
        ],
      })
    })

    it('keeps a roll the game made blind from its player', () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: false,
              rolls: [],
            },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'done', visible: false })
    })

    it("says why a roll wasn't made, and where one stands until it is", () => {
      expect(
        toRollRequestView(
          held({
            status: 'failed',
            result: { id: 'req-1', status: 'failed', reason: 'not-dying' },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'not-dying' })
      expect(toRollRequestView(held({ status: 'failed' }), NOW)).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: undefined,
      })
      expect(toRollRequestView(held(), NOW)).toEqual({
        id: 'req-1',
        status: 'sending',
      })
      expect(toRollRequestView(held({ status: 'done' }), NOW)).toEqual({
        id: 'req-1',
        status: 'done',
      })
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
  })
})
