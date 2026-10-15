/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import {
  checkPrompt,
  offers,
  shownPrompts,
  toTablePrompt,
  toTablePrompts,
  waitingPrompts,
} from './prompts'
import type { RollRequestInput } from '@/types/roll'
import type { TablePrompt } from '@/types/table'

const NOW = Date.parse('2026-10-08T12:05:00Z')

/** The save the game asks of Thorin, as held: Dexterity or Strength, DC 15. */
const held = (fields: object = {}) => ({
  promptId: 'msg1-thorin',
  actorId: 'actor-thorin',
  data: {
    type: 'save',
    abilities: ['dex', 'str'],
    dc: 15,
    label: 'Burning Hands',
    messageId: 'msg1',
  },
  expiresAt: new Date('2026-10-08T12:10:00Z'),
  closedAt: null,
  ...fields,
})

/** Thorin's Dexterity saving throw, answering it. */
const answer: RollRequestInput = {
  kind: 'save',
  key: 'dex',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [12] }],
  prompt: 'msg1-thorin',
}

/** Midi-QOL asks Thorin for Athletics or Acrobatics to escape a web, with advantage on his. */
const web = (fields: object = {}) =>
  held({
    promptId: 'k3y-thorin',
    data: {
      type: 'skill',
      abilities: [],
      skills: ['ath', 'acr'],
      dc: 12,
      label: 'Web',
      messageId: 'k3y',
      source: 'overtime',
      advantage: { ath: 'adv' },
      askedInFoundry: true,
    },
    expiresAt: new Date(NOW + 30_000),
    closedReason: null,
    ...fields,
  })

/** A card's save, as held. */
const card = (fields: object) => held({ closedReason: null, ...fields })

describe('utils/prompts', () => {
  it('shows a save the game asks for, its DC and label only where it has them', () => {
    expect(toTablePrompt(held())).toEqual({
      id: 'msg1-thorin',
      type: 'save',
      abilities: ['dex', 'str'],
      dc: 15,
      label: 'Burning Hands',
      expiresAt: '2026-10-08T12:10:00.000Z',
    })
    expect(
      toTablePrompt(
        held({
          data: {
            type: 'concentration',
            abilities: ['con'],
            dc: null,
            label: null,
            messageId: 'msg2',
          },
        }),
      ),
    ).toEqual({
      id: 'msg1-thorin',
      type: 'concentration',
      abilities: ['con'],
      expiresAt: '2026-10-08T12:10:00.000Z',
    })
  })

  it('keeps those still waiting, until their time runs out', () => {
    const prompts = [
      toTablePrompt(held()),
      toTablePrompt(
        held({
          promptId: 'msg0-thorin',
          expiresAt: new Date('2026-10-08T12:04:00Z'),
        }),
      ),
    ]
    expect(waitingPrompts(prompts, NOW).map(({ id }) => id)).toEqual([
      'msg1-thorin',
    ])
    expect(waitingPrompts(prompts, Date.parse('2026-10-08T12:10:00Z'))).toEqual(
      [],
    )
    expect(waitingPrompts(undefined, NOW)).toEqual([])
  })

  it('takes an answer to an open prompt of its character, with an ability it offers', () => {
    expect(checkPrompt(answer, held(), 'actor-thorin', [], NOW)).toBeUndefined()
    expect(
      checkPrompt({ ...answer, key: 'str' }, held(), 'actor-thorin', [], NOW),
    ).toBeUndefined()
  })

  it.each([
    ['no such prompt', { prompt: undefined }],
    ['a closed prompt', { prompt: held({ closedAt: new Date(NOW - 1000) }) }],
    ['a prompt run out', { prompt: held({ expiresAt: new Date(NOW) }) }],
    ['another character’s', { actorId: 'actor-vex' }],
    ['another ability', { input: { ...answer, key: 'con' } }],
    ['no ability', { input: { ...answer, key: undefined } }],
    [
      'a prompt answered by a roll on its way',
      {
        answers: [
          {
            status: 'pending' as const,
            createdAt: new Date(NOW - 1000),
            claimedAt: null,
          },
        ],
      },
    ],
    [
      'a prompt answered already',
      {
        answers: [
          {
            status: 'done' as const,
            createdAt: new Date(NOW - 60_000),
            claimedAt: new Date(NOW - 59_000),
          },
        ],
      },
    ],
  ])('refuses an answer to %s', (_name, given) => {
    const { input, prompt, actorId, answers } = {
      input: answer,
      prompt: held() as ReturnType<typeof held> | undefined,
      actorId: 'actor-thorin',
      answers: [],
      ...given,
    }
    expect(checkPrompt(input, prompt, actorId, answers, NOW)).toBe('prompt')
  })

  it('takes another answer once an earlier one was lost or refused', () => {
    const answers = [
      {
        status: 'failed' as const,
        createdAt: new Date(NOW - 5000),
        claimedAt: new Date(NOW - 4000),
      },
      {
        status: 'claimed' as const,
        createdAt: new Date(NOW - 200_000),
        claimedAt: new Date(NOW - 199_000),
      },
    ]
    expect(
      checkPrompt(answer, held(), 'actor-thorin', answers, NOW),
    ).toBeUndefined()
  })

  describe('what Midi-QOL asks (module 0.27.0)', () => {
    const athletics: RollRequestInput = {
      kind: 'skill',
      key: 'ath',
      mode: 1,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [4, 17] }],
      prompt: 'k3y-thorin',
    }

    it('shows where it comes from, its skills, how Midi-QOL has each rolled and whether Foundry asks too', () => {
      expect(toTablePrompt(web())).toEqual({
        id: 'k3y-thorin',
        type: 'skill',
        abilities: [],
        skills: ['ath', 'acr'],
        dc: 12,
        label: 'Web',
        expiresAt: '2026-10-08T12:05:30.000Z',
        source: 'overtime',
        advantage: { ath: 'adv' },
        askedInFoundry: true,
      })
      // Normally, and not in Foundry, says nothing.
      const plain = web({
        data: { ...web().data, advantage: {}, askedInFoundry: false },
      })
      expect(toTablePrompt(plain)).not.toHaveProperty('advantage')
      expect(toTablePrompt(plain)).not.toHaveProperty('askedInFoundry')
    })

    it('shows it fifteen seconds after its time runs out, and how it closed for six, as a card’s is not', () => {
      const shown = toTablePrompts(
        [
          web({ promptId: 'k1-thorin', expiresAt: new Date(NOW - 14_000) }),
          web({ promptId: 'k2-thorin', expiresAt: new Date(NOW - 15_000) }),
          card({ promptId: 'msg3-thorin', expiresAt: new Date(NOW - 1) }),
          web({
            promptId: 'k4-thorin',
            closedAt: new Date(NOW - 5900),
            closedReason: 'rolled',
          }),
          web({
            promptId: 'k5-thorin',
            closedAt: new Date(NOW - 1000),
            closedReason: 'expired',
          }),
          web({
            promptId: 'k6-thorin',
            closedAt: new Date(NOW - 6000),
            closedReason: 'expired',
          }),
          // Answered here, or gone: the toast says the one, and the other goes quietly.
          web({
            promptId: 'k7-thorin',
            closedAt: new Date(NOW - 1000),
            closedReason: 'answered',
          }),
          web({
            promptId: 'k8-thorin',
            closedAt: new Date(NOW - 1000),
            closedReason: 'gone',
          }),
          card({
            promptId: 'msg9-thorin',
            closedAt: new Date(NOW - 1000),
            closedReason: 'rolled',
          }),
        ],
        NOW,
      )
      expect(shown.map(({ id, closed }) => [id, closed])).toEqual([
        ['k1-thorin', undefined],
        ['k4-thorin', 'rolled'],
        ['k5-thorin', 'expired'],
      ])
    })

    it('counts as waiting only while still open and its time is not up', () => {
      const prompts: TablePrompt[] = [
        toTablePrompt(web({ promptId: 'k1-thorin' })),
        toTablePrompt(
          web({ promptId: 'k2-thorin', expiresAt: new Date(NOW - 1000) }),
        ),
        toTablePrompt(
          web({
            promptId: 'k3-thorin',
            closedAt: new Date(NOW),
            closedReason: 'rolled',
          }),
        ),
      ]
      expect(waitingPrompts(prompts, NOW).map(({ id }) => id)).toEqual([
        'k1-thorin',
      ])
    })

    it('is shown by the page until fifteen seconds past its time, and its notice six seconds from when the page first saw it', () => {
      const open = toTablePrompt(web({ expiresAt: new Date(NOW) }))
      const notice: TablePrompt = {
        ...open,
        id: 'k9-thorin',
        closed: 'expired',
      }
      const card = toTablePrompt(held({ expiresAt: new Date(NOW) }))
      const prompts = [open, notice, card]
      const ids = (seen: Map<string, number>, now: number) =>
        shownPrompts(prompts, seen, now).map(({ id }) => id)

      // A notice not yet seen shows, whatever the clocks say.
      expect(ids(new Map(), NOW + 60_000)).toEqual(['k9-thorin'])
      const seen = new Map([['k9-thorin', NOW + 10_000]])
      expect(ids(seen, NOW - 1)).toEqual([
        'k3y-thorin',
        'k9-thorin',
        'msg1-thorin',
      ])
      expect(ids(seen, NOW)).toEqual(['k3y-thorin', 'k9-thorin'])
      expect(ids(seen, NOW + 14_999)).toEqual(['k3y-thorin', 'k9-thorin'])
      expect(ids(seen, NOW + 15_000)).toEqual(['k9-thorin'])
      expect(ids(seen, NOW + 15_999)).toEqual(['k9-thorin'])
      expect(ids(seen, NOW + 16_000)).toEqual([])
    })

    it('takes an answer of the kind it asks for, with a choice it offers', () => {
      expect(
        checkPrompt(athletics, web(), 'actor-thorin', [], NOW),
      ).toBeUndefined()
      expect(offers({ type: 'check', abilities: ['str'] }, athletics)).toBe(
        false,
      )
      expect(
        offers(
          { type: 'check', abilities: ['str'] },
          {
            kind: 'ability',
            key: 'str',
          },
        ),
      ).toBe(true)
      expect(
        offers(
          { type: 'concentration', abilities: ['con'] },
          {
            kind: 'save',
            key: 'con',
          },
        ),
      ).toBe(true)
      expect(
        offers(
          { type: 'save', abilities: ['con'] },
          {
            kind: 'ability',
            key: 'con',
          },
        ),
      ).toBe(false)
      expect(offers({ type: 'skill', abilities: [] }, athletics)).toBe(false)
      // Only the kind it asks for, though its key be one it offers.
      expect(
        offers(
          { type: 'check', abilities: ['str'] },
          { kind: 'save', key: 'str' },
        ),
      ).toBe(false)
      expect(
        offers(
          { type: 'skill', abilities: [], skills: ['ath'] },
          { kind: 'ability', key: 'ath' },
        ),
      ).toBe(false)
    })

    it.each<[string, Partial<RollRequestInput>]>([
      ['a skill it does not offer', { key: 'prc' }],
      ['a saving throw', { kind: 'save', key: 'str' }],
      ['an ability check', { kind: 'ability', key: 'str' }],
      ['one rolled as the player chose', { explicit: true }],
      ['one with something added', { extras: [{ sign: 1, flat: 2 }] }],
    ])('refuses %s, as Midi-QOL decides how it is rolled', (_, fields) => {
      expect(
        checkPrompt(
          { ...athletics, ...fields },
          web(),
          'actor-thorin',
          [],
          NOW,
        ),
      ).toBe('prompt')
    })

    it('takes a card’s save with what the player chose, as before', () => {
      expect(
        checkPrompt(
          { ...answer, explicit: true, extras: [{ sign: 1, flat: 2 }] },
          held(),
          'actor-thorin',
          [],
          NOW,
        ),
      ).toBeUndefined()
      // But only a saving throw.
      expect(
        checkPrompt(
          { ...answer, kind: 'ability' },
          held(),
          'actor-thorin',
          [],
          NOW,
        ),
      ).toBe('prompt')
    })
  })
})
