/* eslint-disable unicorn/no-null -- a note moved out of its chapter goes to none */
import {
  movedTo,
  movedWords,
  orderRefusalWords,
  orderSavedWords,
  orderStateWords,
  reorderLine,
} from './order-words'
import type { NoteOrderState, NoteRefusal } from '@/types/notes'

describe('utils/order-words', () => {
  it.each<[NoteOrderState, string | undefined]>([
    ['synced', undefined],
    ['waiting', 'Order waiting for the game'],
    ['saving', 'Order saving to the game…'],
    ['conflict', 'Order changed in Foundry'],
    ['failed', 'Order not saved to the game'],
  ])('names the state %s in words', (state, words) => {
    expect(orderStateWords(state)).toBe(words)
  })

  describe('orderSavedWords', () => {
    it.each([
      [
        'player',
        'Order saved. It goes to Foundry once your Gamemaster’s game has Sending Stone 0.35.0 or later.',
      ],
      [
        'gm',
        'Order saved. It goes to Foundry once your game has Sending Stone 0.35.0 or later.',
      ],
    ] as const)(
      'says a module before 0.35.0 never takes it, open or not, to the %s',
      (role, words) => {
        expect(orderSavedWords({ live: true, orders: false, role })).toBe(words)
        expect(orderSavedWords({ live: false, orders: false, role })).toBe(
          words,
        )
      },
    )

    it.each([
      [
        'player',
        'Order saved. It goes to Foundry when your Gamemaster’s game is next open.',
      ],
      ['gm', 'Order saved. It goes to Foundry when your game is next open.'],
    ] as const)(
      'says when it goes, with the game closed, to the %s',
      (role, words) => {
        expect(orderSavedWords({ live: false, orders: true, role })).toBe(words)
      },
    )

    it('says only that it is saved, with the game open', () => {
      expect(
        orderSavedWords({ live: true, orders: true, role: 'player' }),
      ).toBe('Order saved.')
    })
  })

  describe('orderRefusalWords', () => {
    it.each<[NoteRefusal | 'network', string]>([
      [
        'changed',
        'The order changed while you were arranging it. Cancel to see the latest, then try again.',
      ],
      [
        'saving',
        'The last order is still on its way to the game. Try again in a moment.',
      ],
      ['gone', 'That chapter isn’t there any more.'],
      // Where a note's words speak of its text, or of adding notes, an order's speak of the order.
      [
        'network',
        'Sending Stone couldn’t be reached. Your order is still here: try again.',
      ],
      [
        'private',
        'No player can see this party in Foundry, so its notes can’t be reordered.',
      ],
      [
        'invalid',
        'Sending Stone couldn’t read that order. Cancel to see the latest, then try again.',
      ],
      [
        'chapter',
        'Sending Stone couldn’t read that order. Cancel to see the latest, then try again.',
      ],
      // Any other, as a note's.
      ['busy', 'Too many changes at once. Wait a moment.'],
      ['unknown', 'Thorin is no longer one of the campaign’s characters.'],
    ])('says why %s', (refusal, words) => {
      expect(orderRefusalWords(refusal, 'Thorin')).toBe(words)
    })
  })

  it('says where a note was moved', () => {
    expect(movedWords('Session 2')).toBe('Moved to Session 2.')
    expect(movedWords(null)).toBe('Moved out of its chapter.')
  })

  it('says who sees the order, by the book’s kind', () => {
    expect(reorderLine('party', 'The Iron Company')).toBe(
      'Everyone in The Iron Company sees the notes in this order, here and in Foundry.',
    )
    expect(reorderLine('personal', 'Thorin')).toBe(
      'Your notes keep this order here and in Foundry.',
    )
  })

  it('says where a note is now, from 1', () => {
    expect(movedTo('Wolves', 3, 7)).toBe('Wolves, now 3 of 7.')
  })
})
