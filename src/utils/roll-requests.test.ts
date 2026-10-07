/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  availableRollKinds,
  checkDamage,
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
  sheetAction,
  sheetFavorites,
  sheetSpell,
} from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'
import type { CommandResult, DamagePreview } from '@/types/sending-stone'

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

/** A warhammer attack, with these fields instead. */
const attackRequest = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'attack',
    key: undefined,
    item: 'warhammer',
    activity: 'warhammerAttack',
    ...fields,
  })

/** At this combatant of the combat. */
const targetAt = (combatantId: string) => ({
  target: { combatId: 'cmbt1', combatantId },
})

/** The damage of the attack req-1, with these dice. */
const damageRequest = (dice: RollRequestInput['dice']) =>
  request({ kind: 'damage', key: undefined, use: 'req-1', dice })

/** A part of damage the game made, totalling this, or saying no total. */
const damagePart = (total: number | null) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, results: [{ result: 5, active: true }] }],
})

describe('utils/roll-requests', () => {
  describe('availableRollKinds', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['save', 'skill', 'attack', 'heal'],
      bridgePolledAt: ago(10_000),
    }

    it('offers the rolls the game takes, while the module is fetching them', () => {
      expect(availableRollKinds(campaign, NOW)).toEqual([
        'skill',
        'save',
        'attack',
      ])
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

  describe('checkRoll for an attack', () => {
    const sheet = fullerSheet({ favorites: sheetFavorites() })
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-lurker', name: 'Lurker', hidden: true }),
        combatant({ id: 'c-thorin', character: 'actor-thorin' }),
      ],
    })

    /** Thorin with a Fire Bolt staff among his favorites, and Guiding Bolt's slots as given. */
    const caster = (slots: { value: number; max: number }) =>
      fullerSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'guidingBolt',
                name: 'Guiding Bolt',
                type: 'spell',
                level: 1,
                toHit: 5,
                attackId: 'bolt',
              }),
            ],
          },
        ],
        spells: [
          {
            id: 'spell1',
            label: '1st Level',
            slots: { ...slots, level: 1 },
            spells: [sheetSpell({ id: 'guidingBolt', name: 'Guiding Bolt' })],
          },
        ],
        favorites: [
          {
            type: 'activity',
            id: 'fireBolt',
            itemId: 'staff',
            itemType: 'weapon',
            itemName: 'Staff of Embers',
            name: 'Fire Bolt',
            img: null,
            activation: 'Action',
            range: '120 ft',
            target: null,
            toHit: 5,
            attackId: 'fireBolt',
            save: null,
            damage: [{ formula: '1d10', type: 'Fire', healing: false }],
            uses: { value: 0, max: 3, recovery: 'Dawn' },
          },
        ],
      })

    it("lets the character attack with an action's attack, at a combatant its player sees, or none", () => {
      expect(
        checkRoll(attackRequest(), sheet, [], 'actor-thorin'),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest(targetAt('c-goblin')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest({ target: null }),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest({ item: 'handaxe', activity: 'handaxeAttack' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })

    it('refuses an attack the sheet has no such action for', () => {
      expect(
        checkRoll(
          attackRequest({ activity: 'thrown' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          attackRequest({ item: 'handaxe' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      // Fire Breath has no attack to make.
      expect(
        checkRoll(
          attackRequest({ item: 'breath', activity: 'breath' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(checkRoll(attackRequest(), undefined, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('refuses an attack with an item not identified yet', () => {
      const unknown = fullerSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'warhammer',
                name: 'Warhammer',
                attackId: 'warhammerAttack',
                identified: false,
              }),
            ],
          },
        ],
      })
      expect(checkRoll(attackRequest(), unknown, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('refuses an attack at a combatant its player cannot see, or not in the combat', () => {
      expect(
        checkRoll(
          attackRequest(targetAt('c-lurker')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBe('target')
      expect(
        checkRoll(
          attackRequest(targetAt('c-dragon')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBe('target')
      expect(
        checkRoll(
          attackRequest(targetAt('c-goblin')),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('target')
    })

    it('refuses a spell attack with no spell slot left, and lets a favorite activity attack', () => {
      const bolt = attackRequest({ item: 'guidingBolt', activity: 'bolt' })
      expect(
        checkRoll(bolt, caster({ value: 1, max: 2 }), [], 'actor-thorin'),
      ).toBeUndefined()
      expect(
        checkRoll(bolt, caster({ value: 0, max: 2 }), [], 'actor-thorin'),
      ).toBe('slots')
      // The game checks the uses it spends, if any: a staff's attack may spend none.
      expect(
        checkRoll(
          attackRequest({ item: 'staff', activity: 'fireBolt' }),
          caster({ value: 0, max: 2 }),
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })
  })

  describe('checkDamage', () => {
    const preview: DamagePreview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 1 }],
        },
        { formula: '2d6', type: 'fire', dice: [{ faces: 6, number: 2 }] },
      ],
    }
    const result = (damage: DamagePreview | null): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage,
    })
    const use = (fields: Partial<HeldRollRequest> = {}) =>
      held({
        kind: 'attack',
        status: 'done',
        createdAt: ago(60_000),
        result: result(preview),
        ...fields,
      })
    const thrown = damageRequest([
      { faces: 8, results: [5] },
      { faces: 6, results: [2, 6] },
    ])

    it('lets the damage of an attack made lately be rolled once, with the dice it said', () => {
      expect(checkDamage(thrown, use(), [], NOW)).toBeUndefined()
      expect(
        checkDamage(thrown, use(), [held({ status: 'failed' })], NOW),
      ).toBeUndefined()
      // One that never reached the game doesn't count.
      expect(
        checkDamage(thrown, use(), [held({ createdAt: ago(30_000) })], NOW),
      ).toBeUndefined()
    })

    it('rolls no dice for damage the game rolls itself', () => {
      const unplannable = use({
        result: result({ ...preview, plannable: false }),
      })
      expect(
        checkDamage(damageRequest([]), unplannable, [], NOW),
      ).toBeUndefined()
      expect(checkDamage(thrown, unplannable, [], NOW)).toBe('dice')
    })

    it.each([
      ['no attack', null],
      ['an attack still on its way', use({ status: 'claimed' })],
      ['an attack not made', use({ status: 'failed' })],
      ['a check', use({ kind: 'skill' })],
      ['an attack made too long ago', use({ createdAt: ago(600_001) })],
    ])('refuses the damage of %s', (_name, attack) => {
      expect(checkDamage(thrown, attack, [], NOW)).toBe('gone')
    })

    it('refuses the damage of an attack no damage follows', () => {
      expect(checkDamage(thrown, use({ result: result(null) }), [], NOW)).toBe(
        'no-damage',
      )
    })

    it.each([
      ['on its way', held()],
      ['being rolled', held({ status: 'claimed', claimedAt: ago(1000) })],
      ['rolled', held({ status: 'done' })],
    ])('refuses damage already %s', (_name, other) => {
      expect(checkDamage(thrown, use(), [other], NOW)).toBe('damaged')
    })

    it.each([
      ['a part missing', [{ faces: 8, results: [5] }]],
      [
        'a die too few',
        [
          { faces: 8, results: [5] },
          { faces: 6, results: [2] },
        ],
      ],
      [
        'the wrong die',
        [
          { faces: 10, results: [5] },
          { faces: 6, results: [2, 6] },
        ],
      ],
      [
        'the parts the other way about',
        [
          { faces: 6, results: [2, 6] },
          { faces: 8, results: [5] },
        ],
      ],
    ])('refuses damage with %s', (_name, dice) => {
      expect(checkDamage(damageRequest(dice), use(), [], NOW)).toBe('dice')
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

  describe('toRollRequestView for attacks', () => {
    const preview: DamagePreview = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '2d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 2 }],
        },
      ],
    }
    const attackResult = (visible: boolean): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible,
      rolls: visible
        ? [
            {
              formula: '1d20 + 7',
              total: 27,
              dice: [{ faces: 20, results: [{ result: 20, active: true }] }],
            },
          ]
        : [],
      attack: { critical: true, fumble: false, outcome: 'hit' },
      damage: preview,
    })

    it('shows what came of an attack, and the dice its damage throws', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(true) }),
          NOW,
        ),
      ).toMatchObject({
        status: 'done',
        visible: true,
        total: 27,
        attack: { critical: true, fumble: false, outcome: 'hit' },
        damage: preview,
      })
    })

    it('gives the damage of an attack its player may not see, for them to roll it', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(false) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        damage: preview,
      })
    })

    /** Damage the game made, with these rolls. */
    const madeDamage = (rolls: CommandResult['rolls']) =>
      held({
        kind: 'damage',
        status: 'done',
        result: {
          ...attackResult(true),
          attack: undefined,
          damage: undefined,
          rolls,
        },
      })

    it("totals damage's parts, when the game said each", () => {
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(7)]), NOW),
      ).toMatchObject({
        total: 16,
      })
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(null)]), NOW)
          .total,
      ).toBeUndefined()
      expect(toRollRequestView(madeDamage([]), NOW).total).toBeUndefined()
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
