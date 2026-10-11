/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { act, renderHook } from '@testing-library/react'
import {
  BUSY_FOR,
  BUSY_WAIT,
  CHECK_EVERY,
  choicesOf,
  damageRollOf,
  FOLLOW_FOR,
  LATE_FOLLOW,
  SEND_KEY,
  toFormulaRequest,
  toRollRequest,
  useTableRolls,
} from './use-table-rolls'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  LocalUse,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from './use-sheet-roller'
import type { RollFeature, RollKind } from '@/types/roll'
import type { DamagePreview } from '@/types/sending-stone'

const perception: SheetRoll = {
  label: 'Perception check',
  modifier: 4,
  advantage: 'adv',
  extras: [
    { sign: 1, count: 1, sides: 4 },
    { sign: -1, flat: 1 },
    { sign: 1, count: 2, sides: 6 },
  ],
  source: { kind: 'skill', key: 'prc' },
  explicit: true,
}

const check = (fields: Partial<LocalCheck> = {}): LocalCheck => ({
  kind: 'check',
  id: 'r1',
  label: 'Perception check',
  total: 28,
  modifier: 4,
  advantage: 'adv',
  d20s: [17, 3],
  natural: 17,
  extras: [
    { text: '+1d4', values: [2], value: 2 },
    { text: '−1', values: [], value: -1 },
    { text: '+2d6', values: [5, 1], value: 6 },
  ],
  at: 0,
  ...fields,
})

const longsword: SheetRoll = {
  label: 'Longsword attack',
  modifier: 7,
  source: {
    kind: 'attack',
    item: 'longsword',
    activity: 'swing',
    target: { combatId: 'cmbt1', combatantId: 'goblin' },
  },
}

/** The damage the game said a hit with the longsword throws: 1d8 + 4, then 1d6 fire. */
const preview = (fields: Partial<DamagePreview> = {}): DamagePreview => ({
  critical: false,
  plannable: true,
  rolls: [
    { formula: '1d8 + 4', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
    { formula: '1d6', type: 'fire', dice: [{ faces: 6, number: 1 }] },
  ],
  ...fields,
})

const thrownDamage = (fields: Partial<LocalDamage> = {}): LocalDamage => ({
  kind: 'damage',
  id: 'r2',
  label: 'Longsword damage',
  total: 15,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'slashing',
      total: 9,
      terms: [
        { text: '1d8', values: [5], value: 5 },
        { text: '+4', values: [], value: 4 },
      ],
    },
    { type: 'fire', total: 6, terms: [{ text: '1d6', values: [6], value: 6 }] },
  ],
  at: 0,
  ...fields,
})

/** A d10 hit die spent, with Thorin's Constitution modifier of +3. */
const hitDie: SheetFormulaRoll = {
  label: 'Hit die (d10)',
  terms: [
    { sign: 1, count: 1, sides: 10 },
    { sign: 1, flat: 3 },
  ],
  healing: true,
  minimum: 1,
  source: { kind: 'hitDie', denomination: 'd10' },
}

/** It landed on 6, giving back 9. */
const spent = (fields: Partial<LocalFormula> = {}): LocalFormula => ({
  kind: 'formula',
  id: 'f1',
  label: 'Hit die (d10)',
  total: 9,
  healing: true,
  terms: [
    { text: '1d10', values: [6], value: 6 },
    { text: '+3', values: [], value: 3 },
  ],
  at: 0,
  ...fields,
})

/** Three d10 hit dice spent at once, thrown together. */
const hitDice: SheetFormulaRoll = {
  ...hitDie,
  label: 'Hit dice (3d10)',
  times: 3,
}

/** They landed on 6, 2 and 5, giving back 9, 5 and 8. */
const spentThree = (): LocalFormula =>
  spent({
    label: 'Hit dice (3d10)',
    total: 22,
    terms: [
      { text: '3d10', values: [6, 2, 5], value: 13 },
      { text: '+9', values: [], value: 9 },
    ],
    times: 3,
  })

/** Whether a roll sent threw the second of the three d10s spent at once, which landed on 2. */
const isSecond = (dice: unknown) =>
  JSON.stringify(dice) === JSON.stringify([{ faces: 10, results: [2] }])

/** The bodies of the rolls sent, in order. */
const posted = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
    )

/** A lantern's light, whose radius is 2 + 1d4 − 1d6, as dnd5e has it. */
const lantern: SheetFormulaRoll = {
  label: 'Lantern: Light radius',
  terms: [
    { sign: 1, flat: 2 },
    { sign: 1, count: 1, sides: 4 },
    { sign: -1, count: 1, sides: 6 },
  ],
  source: { kind: 'formula', item: 'lantern', activity: 'shine' },
}

const shone: LocalFormula = {
  kind: 'formula',
  id: 'f2',
  label: 'Lantern: Light radius',
  total: 1,
  healing: false,
  terms: [
    { text: '2', values: [], value: 2 },
    { text: '+1d4', values: [3], value: 3 },
    { text: '−1d6', values: [4], value: -4 },
  ],
  at: 0,
}

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

const render = (
  kinds: RollKind[] = ['skill', 'save'],
  features: RollFeature[] = [],
) =>
  renderHook(props => useTableRolls('char-1', props.kinds, props.features), {
    initialProps: { kinds, features },
  })

/** What was sent last, as the app has it. */
const sent = () =>
  JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)) as Record<
    string,
    unknown
  >

describe('hooks/use-table-rolls', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('toRollRequest', () => {
    it('asks for the roll as it was made, with every die thrown, in order', () => {
      expect(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ).toEqual({
        kind: 'skill',
        key: 'prc',
        mode: 1,
        explicit: true,
        extras: perception.extras,
        dice: [
          { faces: 20, results: [17, 3] },
          { faces: 4, results: [2] },
          { faces: 6, results: [5, 1] },
        ],
      })
    })

    it('asks for initiative in its combat, and a death save, which name nothing', () => {
      const plain = { label: 'Initiative', modifier: 2 }
      const thrown = check({ advantage: 'dis', d20s: [9, 4], extras: [] })
      expect(
        toRollRequest(plain, { kind: 'initiative', combatId: 'cmbt1' }, thrown),
      ).toEqual({
        kind: 'initiative',
        combatId: 'cmbt1',
        mode: -1,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [9, 4] }],
      })
      expect(
        toRollRequest(
          plain,
          { kind: 'death' },
          check({ advantage: undefined, d20s: [11], extras: [] }),
        ),
      ).toMatchObject({ kind: 'death', mode: 0 })
    })

    it('asks for an attack with its item, its attack and its target', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      expect(toRollRequest(longsword, longsword.source!, thrown)).toEqual({
        kind: 'attack',
        item: 'longsword',
        activity: 'swing',
        target: { combatId: 'cmbt1', combatantId: 'goblin' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [15] }],
      })
      expect(
        toRollRequest(
          longsword,
          { kind: 'attack', item: 'longsword', activity: 'swing' },
          thrown,
        ),
      ).toMatchObject({ kind: 'attack', target: null })
    })

    it('asks for an attack with the spell slot, ammunition and attack mode chosen', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      expect(
        toRollRequest(
          longsword,
          {
            kind: 'attack',
            item: 'bow',
            activity: 'shoot',
            slot: 'spell2',
            ammunition: 'arrows',
            attackMode: 'twoHanded',
          },
          thrown,
        ),
      ).toMatchObject({
        slot: 'spell2',
        ammunition: 'arrows',
        attackMode: 'twoHanded',
      })
    })

    it('asks for an area attack at those in its area, in place of a target', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      const targets = [
        { combatId: 'cmbt1', combatantId: 'goblin' },
        { combatId: 'cmbt1', combatantId: 'ogre' },
      ]
      const request = toRollRequest(
        longsword,
        {
          kind: 'attack',
          item: 'breath',
          activity: 'exhale',
          targets,
          slot: 'spell2',
        },
        thrown,
      )
      expect(request).toEqual({
        kind: 'attack',
        item: 'breath',
        activity: 'exhale',
        targets,
        slot: 'spell2',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [15] }],
      })
      expect(request).not.toHaveProperty('target')
      // At no one in its area, it's still an area attack.
      expect(
        toRollRequest(
          longsword,
          { kind: 'attack', item: 'breath', activity: 'exhale', targets: [] },
          thrown,
        ),
      ).not.toHaveProperty('target')
    })
  })

  describe('toFormulaRequest', () => {
    it('asks for a hit die by its size, with its die as thrown, and none of its numbers', () => {
      expect(
        toFormulaRequest(
          hitDie,
          { kind: 'hitDie', denomination: 'd10' },
          spent(),
        ),
      ).toEqual({
        kind: 'hitDie',
        denomination: 'd10',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 10, results: [6] }],
      })
    })

    it('asks for one of several hit dice thrown together with its own die', () => {
      const source = { kind: 'hitDie', denomination: 'd10' } as const
      expect(
        [0, 1, 2].map(
          copy => toFormulaRequest(hitDice, source, spentThree(), copy).dice,
        ),
      ).toEqual([
        [{ faces: 10, results: [6] }],
        [{ faces: 10, results: [2] }],
        [{ faces: 10, results: [5] }],
      ])
    })

    it("asks for an activity's own formula by its item and activity, with the dice of each term, in order", () => {
      const request = toFormulaRequest(
        lantern,
        { kind: 'formula', item: 'lantern', activity: 'shine' },
        shone,
      )
      expect(request).toEqual({
        kind: 'formula',
        item: 'lantern',
        activity: 'shine',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 4, results: [3] },
          { faces: 6, results: [4] },
        ],
      })
      expect(request).not.toHaveProperty('denomination')
    })
  })

  describe('damageRollOf', () => {
    it('rolls the damage the game said, part by part, with its formula', () => {
      expect(
        damageRollOf('Longsword', { use: 'req-1', damage: preview() }),
      ).toEqual<SheetDamageRoll>({
        label: 'Longsword damage',
        critical: false,
        healing: false,
        exact: true,
        use: 'req-1',
        perDie: 1,
        parts: [
          {
            type: 'slashing',
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
          { type: 'fire', terms: [{ sign: 1, count: 1, sides: 6 }] },
        ],
      })
    })

    it("rolls a critical hit's dice as the game doubled them, and only dice the app can't read", () => {
      const critical = preview({
        critical: true,
        rolls: [
          {
            formula: '2d8 + 4',
            type: 'slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie: 2,
          },
          {
            formula: '1d6 + @mod',
            type: 'fire',
            dice: [{ faces: 6, number: 2 }],
            perDie: 2,
          },
        ],
      })
      expect(
        damageRollOf('Longsword', { use: 'req-1', damage: critical }),
      ).toEqual({
        label: 'Longsword damage',
        critical: true,
        healing: false,
        exact: true,
        use: 'req-1',
        perDie: 2,
        parts: [
          {
            type: 'slashing',
            terms: [
              { sign: 1, count: 2, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
          { type: 'fire', terms: [{ sign: 1, count: 2, sides: 6 }] },
        ],
      })
    })

    it('keeps how the player changed it, now or as they used it, and how many dice the game throws for each added', () => {
      const critical = preview({
        critical: true,
        rolls: [
          {
            formula: '2d8 + 4',
            type: 'slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie: 2,
          },
        ],
      })
      const used = { use: 'req-1', damage: critical, modifiers: { extra: 1 } }

      expect(damageRollOf('Longsword', used)).toMatchObject({
        modifiers: { extra: 1 },
        perDie: 2,
      })
      expect(
        damageRollOf('Longsword', used, undefined, { maximize: true }),
      ).toMatchObject({ modifiers: { maximize: true } })
      // Changes that change nothing aren't kept.
      expect(
        damageRollOf('Longsword', used, undefined, { extra: 0 }),
      ).not.toHaveProperty('modifiers')
    })

    it('rolls healing as healing, and the kind of damage chosen for each roll that offers it', () => {
      const fire = { key: 'fire', label: 'Fire' }
      const cold = { key: 'cold', label: 'Cold' }
      expect(
        damageRollOf('Cure Wounds', {
          use: 'req-1',
          damage: preview({
            healing: true,
            rolls: [
              {
                formula: '2d8 + 3',
                type: 'Healing',
                dice: [{ faces: 8, number: 2 }],
              },
            ],
          }),
        }),
      ).toMatchObject({ label: 'Cure Wounds healing', healing: true })

      const orb = preview({
        rolls: [
          {
            formula: '3d8',
            type: 'Acid',
            types: [{ key: 'acid', label: 'Acid' }, fire, cold],
            dice: [{ faces: 8, number: 3 }],
          },
          {
            formula: '1d6',
            type: 'Acid',
            types: [fire, cold],
            dice: [{ faces: 6, number: 1 }],
          },
          { formula: '2', type: 'Force', dice: [] },
        ],
      })
      expect(choicesOf(orb)).toEqual([
        { key: 'acid', label: 'Acid' },
        fire,
        cold,
      ])
      expect(choicesOf(preview())).toEqual([])
      const chosen = damageRollOf(
        'Chromatic Orb',
        { use: 'req-1', damage: orb },
        'acid',
      )
      expect(chosen.types).toEqual(['acid', null, null])
      expect(chosen.parts.map(part => part.type)).toEqual([
        'Acid',
        'Acid',
        'Force',
      ])
      const cooled = damageRollOf(
        'Chromatic Orb',
        { use: 'req-1', damage: orb },
        'cold',
      )
      expect(cooled.types).toEqual(['cold', 'cold', null])
      expect(cooled.parts.map(part => part.type)).toEqual([
        'Cold',
        'Cold',
        'Force',
      ])
      expect(
        damageRollOf('Chromatic Orb', { use: 'req-1', damage: orb }).types,
      ).toBeUndefined()
    })

    it('throws no dice for damage the game rolls itself', () => {
      const roll = damageRollOf('Club', {
        use: 'req-1',
        damage: preview({ plannable: false }),
      })
      expect(roll.parts).toEqual([
        { type: 'slashing', terms: [] },
        { type: 'fire', terms: [] },
      ])
    })
  })

  it('sends a roll the game takes, and follows it until the game has made it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
      .mockResolvedValueOnce(
        respond(200, { id: 'req-1', status: 'done', visible: true, total: 23 }),
      )
    const { result } = render()
    expect(result.current.available).toBe(true)
    expect(result.current.sending).toBe(true)

    act(() => result.current.send(perception, check()))
    expect(result.current.states.get('r1')).toEqual({ status: 'sending' })
    expect(fetch).toHaveBeenCalledWith('/api/characters/char-1/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ),
      signal: expect.any(AbortSignal),
    })

    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/rolls/req-1',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    )
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(CHECK_EVERY)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'done',
      visible: true,
      total: 23,
    })
    await advance(CHECK_EVERY * 5)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each<[string, RollKind[], SheetRoll]>([
    ['a roll the game does not take', ['save'], perception],
    ['a roll the game cannot make', ['skill'], { label: 'Axe', modifier: 5 }],
  ])("doesn't send %s", (_, kinds, roll) => {
    const { result } = render(kinds)

    act(() => result.current.send(roll, check()))

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.states.size).toBe(0)
  })

  it('takes no rolls while the game takes none', () => {
    const { result } = render([])

    expect(result.current.available).toBe(false)
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("doesn't send rolls from a device the player turned sending off on, remembering it", () => {
    const { result } = render()

    act(() => result.current.setSending(false))
    expect(result.current.sending).toBe(false)
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBe('off')
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()

    act(() => result.current.setSending(true))
    act(() => result.current.send(perception, check()))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends with what the game takes as it changes', () => {
    const { result, rerender } = render(['save'])

    rerender({ kinds: ['skill'], features: [] })
    act(() => result.current.send(perception, check()))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the app refused it', respond(422, { reason: 'not-dying' }), 'not-dying'],
    ['too many were sent', respond(429, { reason: 'busy' }), 'busy'],
    ['the app failed', respond(500), 'error'],
  ])('says why a roll was not sent when %s', async (_, response, reason) => {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason,
    })
  })

  it('says when the app could not be reached', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason: 'network',
    })
  })

  it("keeps asking through a failed check, and gives up on a roll that's never answered", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(respond(200, { id: 'req-1', status: 'rolling' }))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY * 2)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(FOLLOW_FOR)
    expect(result.current.states.get('r1')).toEqual({
      status: 'lost',
      requestId: 'req-1',
    })
  })

  it('stops following a roll the page may no longer see', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(404))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY)

    expect(result.current.states.get('r1')).toEqual({
      status: 'lost',
      requestId: 'req-1',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('goes on asking after a roll that took the game too long, which it may make after all', async () => {
    const timedOut = { id: 'req-1', status: 'failed', reason: 'timeout' }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(200, timedOut))
      .mockResolvedValueOnce(respond(200, timedOut))
      .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'done' }))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    })

    await advance(CHECK_EVERY * 2)
    expect(result.current.states.get('r1')).toMatchObject({ status: 'done' })
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it("stops asking after a roll that took too long, once the game can't make it any more", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'failed', reason: 'timeout' }),
      )
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(LATE_FOLLOW + CHECK_EVERY * 2)
    const asked = jest.mocked(fetch).mock.calls.length
    await advance(CHECK_EVERY * 5)

    expect(fetch).toHaveBeenCalledTimes(asked)
    // It stays as the game last said, rather than lost.
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    })
  })

  describe('attacks', () => {
    const made = {
      id: 'req-1',
      status: 'done',
      visible: true,
      total: 19,
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: preview(),
    }
    const attackCheck = check({
      label: 'Longsword attack',
      advantage: undefined,
      d20s: [12],
      extras: [],
    })

    it('sends an attack, then rolls its damage at the table once, with the dice the game said', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, made))
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['attack', 'damage'])
      expect(result.current.takes('attack')).toBe(true)

      act(() => result.current.send(longsword, attackCheck))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('r1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        source: { item: 'longsword', activity: 'swing' },
        attack: { outcome: 'hit' },
      })
      const due = { use: 'req-1', damage: preview() }
      expect(result.current.dueDamage('req-1')).toEqual(due)
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'swing' }),
      ).toEqual(due)
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'thrown' }),
      ).toBeUndefined()

      act(() =>
        result.current.sendDamage(
          damageRollOf('Longsword', due),
          thrownDamage(),
        ),
      )
      expect(fetch).toHaveBeenLastCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'damage',
          use: 'req-1',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [
            { faces: 8, results: [5] },
            { faces: 6, results: [6] },
          ],
        }),
        signal: expect.any(AbortSignal),
      })
      expect(result.current.states.get('r1')).toMatchObject({ damaged: true })
      expect(result.current.states.get('r2')).toEqual({ status: 'sending' })
      // Its damage is on its way: it isn't offered again.
      expect(result.current.dueDamage('req-1')).toBeUndefined()
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'swing' }),
      ).toBeUndefined()
    })

    it('offers no damage for an attack that missed, or whose damage the game rolls with nothing to follow', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, { ...made, damage: null }))
      const { result } = render(['attack', 'damage'])

      act(() => result.current.send(longsword, attackCheck))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('r1')).toMatchObject({ status: 'done' })
      expect(result.current.dueDamage('req-1')).toBeUndefined()
    })

    it("sends no damage the game doesn't take, nor damage of no attack at the table", () => {
      const { result } = render(['attack'])
      const due = { use: 'req-1', damage: preview() }

      act(() =>
        result.current.sendDamage(
          damageRollOf('Longsword', due),
          thrownDamage(),
        ),
      )
      expect(fetch).not.toHaveBeenCalled()

      const { result: taking } = render(['attack', 'damage'])
      act(() =>
        taking.current.sendDamage(
          { label: 'Longsword damage', parts: [] },
          thrownDamage(),
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('uses', () => {
    const fireball: LocalUse = {
      kind: 'use',
      id: 'u1',
      label: 'Fireball',
      spell: true,
      at: 0,
    }
    const cast = {
      kind: 'use' as const,
      item: 'fireball',
      activity: 'blast',
      targets: [{ combatId: 'cmbt1', combatantId: 'goblin' }],
      slot: 'spell4',
    }

    it('sends a use, with no dice, and follows it until the game has made it, its damage then due', async () => {
      const fire = { key: 'fire', label: 'Fire' }
      const damage = preview({
        rolls: [
          {
            formula: '9d6',
            type: 'Fire',
            types: [fire, { key: 'cold', label: 'Cold' }],
            dice: [{ faces: 6, number: 9 }],
          },
        ],
      })
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
            use: { type: 'save' },
            damage,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['use', 'damage'])
      expect(result.current.takes('use')).toBe(true)

      act(() => result.current.sendUse(fireball, cast))
      expect(fetch).toHaveBeenLastCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'use',
          item: 'fireball',
          activity: 'blast',
          targets: cast.targets,
          slot: 'spell4',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        }),
        signal: expect.any(AbortSignal),
      })
      await advance(CHECK_EVERY)

      expect(result.current.states.get('u1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        name: 'Fireball',
        source: { item: 'fireball', activity: 'blast' },
        use: { type: 'save' },
      })
      const due = { use: 'req-1', damage }
      expect(
        result.current.dueFor({ item: 'fireball', activity: 'blast' }),
      ).toEqual(due)

      act(() =>
        result.current.sendDamage(damageRollOf('Fireball', due, 'fire'), {
          ...thrownDamage(),
          parts: [
            {
              type: 'Fire',
              total: 9,
              terms: [
                { text: '9d6', values: [1, 1, 1, 1, 1, 1, 1, 1, 1], value: 9 },
              ],
            },
          ],
        }),
      )
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toEqual({
        kind: 'damage',
        use: 'req-1',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 6, results: [1, 1, 1, 1, 1, 1, 1, 1, 1] }],
        types: ['fire'],
      })
      expect(
        result.current.dueFor({ item: 'fireball', activity: 'blast' }),
      ).toBeUndefined()
    })

    it('keeps how the player changed the damage that follows a use, to roll it so, where the game takes it', async () => {
      const damage = preview({
        rolls: [
          {
            formula: '8d6',
            type: 'Fire',
            dice: [{ faces: 6, number: 8 }],
            perDie: 1,
          },
        ],
      })
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
            use: { type: 'save' },
            damage,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result, rerender } = render(['use', 'damage'])
      expect(result.current.modifies).toBe(false)
      rerender({ kinds: ['use', 'damage'], features: ['modifiers'] })
      expect(result.current.modifies).toBe(true)

      act(() => result.current.sendUse(fireball, cast, { maximize: true }))
      // The use itself carries none: they're its damage's.
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).not.toHaveProperty('modifiers')
      await advance(CHECK_EVERY)

      const due = result.current.dueFor({ item: 'fireball', activity: 'blast' })
      expect(due).toEqual({
        use: 'req-1',
        damage,
        modifiers: { maximize: true },
      })
      const roll = damageRollOf('Fireball', due as NonNullable<typeof due>)
      act(() =>
        result.current.sendDamage(roll, {
          ...thrownDamage(),
          maximized: true,
          parts: [
            {
              type: 'Fire',
              total: 48,
              terms: [
                {
                  text: '8d6',
                  values: [6, 6, 6, 6, 6, 6, 6, 6],
                  value: 48,
                },
              ],
            },
          ],
        }),
      )
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 6, results: [6, 6, 6, 6, 6, 6, 6, 6] }],
        modifiers: { maximize: true },
      })
    })

    it("sends the game's own slot for none chosen, and no use the game doesn't take", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['attack', 'damage'])
      act(() => result.current.sendUse(fireball, cast))
      expect(fetch).not.toHaveBeenCalled()

      const { result: taking } = render(['use'])
      act(() => taking.current.sendUse(fireball, { ...cast, slot: undefined }))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toMatchObject({
        kind: 'use',
        slot: null,
      })
    })
  })

  describe('area attacks', () => {
    const targets = [
      { combatId: 'cmbt1', combatantId: 'goblin' },
      { combatId: 'cmbt1', combatantId: 'ogre' },
    ]
    const targetNames = { goblin: 'Goblin', ogre: 'Ogre' }
    const breath: SheetRoll = {
      label: 'Dragon Breath attack',
      modifier: 5,
      source: { kind: 'attack', item: 'breath', activity: 'exhale', targets },
      targetNames,
    }
    const breathCheck = check({
      label: 'Dragon Breath attack',
      advantage: undefined,
      d20s: [12],
      extras: [],
    })

    it('makes area attacks only where the game makes them at those picked, from a device sending rolls', () => {
      const { result, rerender } = render(['attack', 'damage'])
      expect(result.current.areas).toBe(false)

      rerender({ kinds: ['attack', 'damage'], features: ['areaAttacks'] })
      expect(result.current.areas).toBe(true)
      rerender({ kinds: ['damage'], features: ['areaAttacks'] })
      expect(result.current.areas).toBe(false)

      rerender({ kinds: ['attack', 'damage'], features: ['areaAttacks'] })
      act(() => result.current.setSending(false))
      expect(result.current.areas).toBe(false)
    })

    it('sends an area attack at those picked, keeping their names, to show what came of it at each', async () => {
      const attack = {
        critical: false,
        fumble: false,
        outcome: null,
        targets: [
          { ...targets[0], outcome: 'hit' },
          { ...targets[1], outcome: 'miss' },
        ],
      }
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 17,
            attack,
            damage: preview(),
          }),
        )
      const { result } = render(['attack', 'damage'], ['areaAttacks'])

      act(() => result.current.send(breath, breathCheck))
      const sent = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
      expect(sent).toMatchObject({
        kind: 'attack',
        item: 'breath',
        activity: 'exhale',
        targets,
      })
      expect(sent).not.toHaveProperty('target')
      expect(result.current.states.get('r1')).toEqual({
        status: 'sending',
        source: { item: 'breath', activity: 'exhale' },
        targetNames,
      })

      await advance(CHECK_EVERY)
      expect(result.current.states.get('r1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        targetNames,
        attack,
      })
      expect(
        result.current.dueFor({ item: 'breath', activity: 'exhale' }),
      ).toEqual({ use: 'req-1', damage: preview() })
    })

    it("keeps no combatants' names for a roll that isn't an attack", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render()

      act(() => result.current.send({ ...perception, targetNames }, check()))
      expect(result.current.states.get('r1')).toEqual({ status: 'sending' })
    })
  })

  describe('hit dice and formulas', () => {
    it('sends a hit die spent where the game takes them, and follows it until the game has made it', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 7,
          }),
        )
      const { result } = render(['hitDie', 'formula'])
      expect(result.current.takes('hitDie')).toBe(true)

      act(() => result.current.sendFormula(hitDie, spent()))
      expect(fetch).toHaveBeenCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'hitDie',
          denomination: 'd10',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 10, results: [6] }],
        }),
        signal: expect.any(AbortSignal),
      })
      expect(result.current.states.get('f1')).toEqual({ status: 'sending' })

      await advance(CHECK_EVERY)
      expect(result.current.states.get('f1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        total: 9,
        healed: 7,
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('sends hit dice spent at once a request a die, each once the game has made the one before, keeping where they are as one', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 5,
            healed: 5,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])
      const state = () => result.current.states.get('f1')

      act(() => result.current.sendFormula(hitDice, spentThree()))
      // The first die alone, as the game spends one a request.
      expect(posted()).toEqual([
        {
          kind: 'hitDie',
          denomination: 'd10',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 10, results: [6] }],
        },
      ])
      expect(state()).toEqual({
        status: 'sending',
        together: { count: 3, made: 0 },
      })

      // While the game makes it, the next waits, so that no more than one is on its way at once.
      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        status: 'rolling',
        together: { count: 3, made: 0 },
      })
      expect(posted()).toHaveLength(1)

      await advance(CHECK_EVERY)
      expect(posted().map(({ dice }) => dice)).toEqual([
        [{ faces: 10, results: [6] }],
        [{ faces: 10, results: [2] }],
      ])
      expect(state()).toEqual({
        status: 'sending',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })

      await advance(CHECK_EVERY)
      expect(posted()).toHaveLength(3)
      expect(posted()[2].dice).toEqual([{ faces: 10, results: [5] }])

      // Once each is made, what they came to, and gave back, added up.
      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        together: { count: 3, made: 3 },
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(7)
    })

    it("sends none after one the game didn't take or make, keeping how many it made, and why not the rest", async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(422, { reason: 'no-hit-dice' }))
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('f1')).toEqual({
        status: 'refused',
        reason: 'no-hit-dice',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })
      await advance(CHECK_EVERY * 3)
      expect(posted()).toHaveLength(2)
    })

    it('sends one the app turned away as one too many at once again a moment later, with the same dice, then the rest', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(429, { reason: 'busy' }))
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 5,
            healed: 5,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])
      const state = () => result.current.states.get('f1')

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      // Turned away, the second is still on its way, rather than the rest given up on.
      expect(posted()).toHaveLength(2)
      expect(state()).toEqual({
        status: 'sending',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })

      await advance(BUSY_WAIT - 1)
      expect(posted()).toHaveLength(2)
      await advance(1)
      expect(posted().map(({ dice }) => dice)).toEqual([
        [{ faces: 10, results: [6] }],
        [{ faces: 10, results: [2] }],
        [{ faces: 10, results: [2] }],
      ])

      await advance(CHECK_EVERY * 2)
      expect(posted()).toHaveLength(4)
      expect(state()).toEqual({
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        together: { count: 3, made: 3 },
      })
    })

    it('gives up on one the app turns away for over a minute, keeping how many it made, and why not the rest', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValue(respond(429, { reason: 'busy' }))
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY + BUSY_FOR - BUSY_WAIT)
      expect(result.current.states.get('f1')).toMatchObject({
        status: 'sending',
        together: { count: 3, made: 1 },
      })
      await advance(BUSY_WAIT)

      expect(result.current.states.get('f1')).toEqual({
        status: 'refused',
        reason: 'busy',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })
      // The second, sent again every few seconds; the third never.
      const sent = posted()
      expect(sent.slice(1).every(({ dice }) => isSecond(dice))).toBe(true)
      expect(sent).toHaveLength(2 + BUSY_FOR / BUSY_WAIT)
      await advance(BUSY_WAIT * 3)
      expect(posted()).toHaveLength(sent.length)
    })

    it('sends none of the rest once the page is left, nor sends one turned away again', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result, unmount } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      expect(posted()).toHaveLength(2)
      unmount()
      await advance(CHECK_EVERY * 5)

      // The second, on its way, isn't asked after; the third isn't sent.
      expect(fetch).toHaveBeenCalledTimes(3)

      // Nor is one turned away sent again.
      jest
        .mocked(fetch)
        .mockClear()
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
        .mockResolvedValueOnce(respond(429, { reason: 'busy' }))
      const again = render(['hitDie'])
      act(() => again.result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      again.unmount()
      await advance(BUSY_WAIT * 2)
      expect(posted()).toHaveLength(2)
    })

    it('says no total or hit points given back where the game made any of them blind', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-2', status: 'done', visible: false }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY * 3)

      expect(result.current.states.get('f1')).toEqual({
        status: 'done',
        visible: false,
        together: { count: 3, made: 3 },
      })
    })

    it('keeps that the game made none of them, where it made the first not', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'gone' }),
        )
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('f1')).toEqual({
        status: 'failed',
        reason: 'gone',
        together: { count: 3, made: 0 },
      })
      await advance(CHECK_EVERY * 3)
      expect(posted()).toHaveLength(1)
    })

    it("sends an activity's own formula where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['formula'])

      act(() => result.current.sendFormula(lantern, shone))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toEqual(
        toFormulaRequest(
          lantern,
          { kind: 'formula', item: 'lantern', activity: 'shine' },
          shone,
        ),
      )
      expect(result.current.states.get('f2')).toEqual({ status: 'sending' })
    })

    it.each<[string, RollKind[], SheetFormulaRoll]>([
      ['a hit die where the game takes only formulas', ['formula'], hitDie],
      ['a formula where the game takes only hit dice', ['hitDie'], lantern],
      [
        'a formula the game cannot make',
        ['hitDie', 'formula'],
        { ...lantern, source: undefined },
      ],
    ])("doesn't send %s", (_name, kinds, roll) => {
      const { result } = render(kinds)

      act(() => result.current.sendFormula(roll, spent()))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })

    it("doesn't send a hit die or a formula from a device the player turned sending off on", () => {
      const { result } = render(['hitDie', 'formula'])

      act(() => result.current.setSending(false))
      act(() => result.current.sendFormula(hitDie, spent()))
      act(() => result.current.sendFormula(lantern, shone))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })
  })

  describe('saves the game asked for', () => {
    /** A Dexterity saving throw answering the game's prompt. */
    const answer: SheetRoll = {
      label: 'Dexterity saving throw',
      modifier: 1,
      source: { kind: 'save', key: 'dex', prompt: 'msg1-thorin' },
    }

    it("sends a save answering the game's prompt, and says it's answering it until it fails", async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'cancelled' }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 16,
            outcome: 'success',
          }),
        )
      const { result } = render(['save'], ['prompts'])

      act(() => result.current.send(answer, check({ advantage: undefined })))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)),
      ).toMatchObject({ kind: 'save', key: 'dex', prompt: 'msg1-thorin' })
      expect(result.current.answering).toEqual(new Set(['msg1-thorin']))

      // One that failed may be answered again.
      await advance(CHECK_EVERY)
      expect(result.current.answering).toEqual(new Set())

      act(() =>
        result.current.send(answer, check({ id: 'r2', advantage: undefined })),
      )
      await advance(CHECK_EVERY)
      expect(result.current.states.get('r2')).toMatchObject({
        status: 'done',
        total: 16,
        outcome: 'success',
        prompt: 'msg1-thorin',
      })
      expect(result.current.answering).toEqual(new Set(['msg1-thorin']))
    })
  })

  describe('links in descriptions', () => {
    const HASH = '0f1a2b3c4d5e6f'

    it("sends a saving throw a description calls for, the player's own, by its link", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['save'])

      act(() =>
        result.current.send(
          {
            label: 'Dexterity saving throw',
            modifier: 1,
            source: { kind: 'save', key: 'dex', text: HASH, link: 3 },
            dc: 15,
          },
          check({ advantage: undefined, d20s: [11], extras: [] }),
        ),
      )

      expect(sent()).toEqual({
        kind: 'save',
        key: 'dex',
        text: HASH,
        link: 3,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [11] }],
      })
    })

    it.each([
      ['skill', 'ath'],
      ['tool', 'thief'],
      ['ability', 'int'],
    ] as const)(
      "sends a %s check a description calls for, the player's own, by its link",
      (kind, key) => {
        jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        const { result } = render([kind])

        act(() =>
          result.current.send(
            {
              label: 'A check',
              modifier: 1,
              source: { kind, key, text: HASH, link: 4 },
              dc: 15,
            },
            check({ advantage: 'adv', d20s: [11, 17], extras: [] }),
          ),
        )

        expect(sent()).toEqual({
          kind,
          key,
          text: HASH,
          link: 4,
          mode: 1,
          explicit: false,
          extras: [],
          dice: [{ faces: 20, results: [11, 17] }],
        })
      },
    )

    it("sends a description's damage by its link, with the dice thrown and the kinds chosen, where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['textDamage'])
      const roll: SheetDamageRoll = {
        label: 'Flame damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
            type: 'slashing',
          },
          { terms: [{ sign: 1, count: 1, sides: 6 }], type: 'fire' },
        ],
        text: { text: HASH, link: 1 },
        types: [null, 'fire'],
      }

      act(() => result.current.sendDamage(roll, thrownDamage()))

      expect(sent()).toEqual({
        kind: 'textDamage',
        text: HASH,
        link: 1,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 8, results: [5] },
          { faces: 6, results: [6] },
        ],
        types: [null, 'fire'],
      })
      expect(result.current.states.get('r2')).toEqual({ status: 'sending' })

      // With no choice to make, no kinds.
      act(() =>
        result.current.sendDamage(
          { ...roll, types: undefined },
          thrownDamage({ id: 'r3' }),
        ),
      )
      expect(sent()).not.toHaveProperty('types')
    })

    it("sends a description's critical hit, as the world's rules made it, and its damage changed, as the player chose", () => {
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
      const { result } = render(['textDamage'], ['modifiers'])
      const roll: SheetDamageRoll = {
        label: 'Flame damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 8 },
              { sign: 1, flat: 4 },
            ],
            type: 'slashing',
          },
          { terms: [{ sign: 1, count: 2, sides: 6 }], type: 'fire' },
        ],
        text: { text: HASH, link: 1 },
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
        },
        modifiers: { extra: 0, maximize: true },
      }
      const thrown = thrownDamage({
        critical: true,
        maximized: true,
        parts: [
          {
            type: 'slashing',
            total: 20,
            terms: [
              { text: '2d8', values: [8, 8], value: 16 },
              { text: '+4', values: [], value: 4 },
            ],
          },
          {
            type: 'fire',
            total: 12,
            terms: [{ text: '+2d6', values: [6, 6], value: 12 }],
          },
        ],
      })

      act(() => result.current.sendDamage(roll, thrown))

      expect(sent()).toEqual({
        kind: 'textDamage',
        text: HASH,
        link: 1,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 8, results: [8, 8] },
          { faces: 6, results: [6, 6] },
        ],
        critical: true,
        modifiers: { extra: 0, maximize: true },
      })

      // Unchanged after all, it says nothing of them.
      act(() =>
        result.current.sendDamage(
          { ...roll, critical: false, modifiers: { extra: 0 } },
          thrownDamage({ id: 'r3' }),
        ),
      )
      expect(sent()).not.toHaveProperty('critical')
      expect(sent()).not.toHaveProperty('modifiers')
    })

    it("keeps a description's critical hit with its dice doubled here, rather than as the game makes one, from the game", () => {
      const { result } = render(['textDamage'], ['modifiers'])

      act(() =>
        result.current.sendDamage(
          {
            label: 'Flame damage',
            parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: null }],
            text: { text: HASH, link: 1 },
            critical: true,
          },
          thrownDamage({ critical: true }),
        ),
      )

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })

    it("says whether the game takes a description's damage changed, as it takes an attack's", () => {
      const { result, rerender } = render(['textDamage'])
      expect(result.current.modifiesText).toBe(false)
      rerender({ kinds: ['textDamage'], features: ['modifiers'] })
      expect(result.current.modifiesText).toBe(true)
      // An attack's damage it takes changed is not a description's.
      expect(result.current.modifies).toBe(false)
      rerender({ kinds: ['damage'], features: ['modifiers'] })
      expect(result.current.modifiesText).toBe(false)
      rerender({ kinds: ['textDamage'], features: ['modifiers'] })
      act(() => result.current.setSending(false))
      expect(result.current.modifiesText).toBe(false)
    })

    it("sends a description's own roll by its link, where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['textRoll'])

      act(() =>
        result.current.sendFormula(
          {
            label: 'Luckstone roll',
            terms: [{ sign: 1, count: 1, sides: 4 }],
            source: { kind: 'textRoll', text: HASH, link: 2 },
          },
          spent({ id: 'f3', terms: [{ text: '1d4', values: [3], value: 3 }] }),
        ),
      )

      expect(sent()).toEqual({
        kind: 'textRoll',
        text: HASH,
        link: 2,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 4, results: [3] }],
      })
    })

    it('asks the table for a saving throw, by its link, with no dice, and follows it until it is posted', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
      const { result } = render(['ask'])
      const asked: LocalAsk = {
        kind: 'ask',
        id: 'a1',
        label: 'DC 15 Dexterity saving throw',
        at: 0,
      }

      act(() => result.current.sendAsk(asked, { text: HASH, link: 3 }))

      expect(sent()).toEqual({
        kind: 'ask',
        text: HASH,
        link: 3,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      await advance(CHECK_EVERY)
      expect(result.current.states.get('a1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
      })
    })

    it("sends none of them where the game doesn't take them, or from a device that doesn't send", () => {
      const { result, rerender } = render(['save', 'damage', 'formula'])
      const asked: LocalAsk = { kind: 'ask', id: 'a1', label: 'Ask', at: 0 }

      act(() => {
        result.current.sendAsk(asked, { text: HASH, link: 0 })
        result.current.sendDamage(
          {
            label: 'Flame damage',
            parts: [],
            text: { text: HASH, link: 1 },
            // As though it followed a use, which a description's damage never does.
            use: 'req-9',
          },
          thrownDamage(),
        )
        result.current.sendFormula(
          {
            label: 'Luckstone roll',
            terms: [],
            source: { kind: 'textRoll', text: HASH, link: 2 },
          },
          spent(),
        )
      })
      rerender({ kinds: ['ask', 'textDamage', 'textRoll'], features: [] })
      act(() => result.current.setSending(false))
      act(() => result.current.sendAsk(asked, { text: HASH, link: 0 }))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })
  })

  it('stops following its rolls once gone', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
    const { result, unmount } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)
    const { signal } = jest.mocked(fetch).mock.calls[0][1] as RequestInit
    unmount()

    expect(signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
