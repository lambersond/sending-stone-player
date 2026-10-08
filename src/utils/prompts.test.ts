/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { checkPrompt, toTablePrompt, waitingPrompts } from './prompts'
import type { RollRequestInput } from '@/types/roll'

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
})
