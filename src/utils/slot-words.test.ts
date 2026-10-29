/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { createElement } from 'react'
import { render, screen, within } from '@testing-library/react'
import { slotName, slotWords, type SpellSlotPool } from './slot-words'
import { UsePicker } from '@/components/character-sheet/use-picker'
import {
  aloneSpells,
  burningHandsAction,
  hellishRebukeAction,
  pactSpells,
} from '@/mocks/sending-stone'
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'

/*
 * How a pool of spell slots is named, from module 0.42.1 (round 0.42.1 §U.1.2): its own copy of the
 * use picker's words, which stay the picker's, held to them by one fixture.
 */

/**
 * The pools both copies name, each with its words, and a spell damage on its own spends one of, in
 * a spellbook whose slot the picker picks first.
 */
const POOLS: {
  pool: SpellSlotPool
  words: string
  action: SheetAction
  spellbook: SheetSpellSection[]
}[] = [
  {
    pool: { id: 'spell1', level: 1 },
    words: 'a 1st-level spell slot',
    action: burningHandsAction(),
    spellbook: aloneSpells(),
  },
  {
    pool: { id: 'spell2', level: 2 },
    words: 'a 2nd-level spell slot',
    action: burningHandsAction(),
    // None left at 1st level, so the picker picks the 2nd.
    spellbook: aloneSpells(0, 1),
  },
  {
    pool: { id: 'pact', level: 3 },
    words: 'a pact slot (3rd level)',
    action: hellishRebukeAction(),
    spellbook: pactSpells(),
  },
  {
    // Pact magic from an older module, which didn't say its level.
    pool: { id: 'pact', level: null },
    words: 'a spell slot',
    action: hellishRebukeAction(),
    spellbook: pactSpells().map(section => ({
      ...section,
      slots: { value: 1, max: 1, level: null },
    })),
  },
]

describe('utils/slot-words', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  it.each([
    [{ id: 'spell1', level: 1 }, '1st-level spell slot'],
    [{ id: 'spell2', level: 2 }, '2nd-level spell slot'],
    [{ id: 'spell3', level: 3 }, '3rd-level spell slot'],
    [{ id: 'spell9', level: 9 }, '9th-level spell slot'],
    [{ id: 'pact', level: 3 }, 'pact slot (3rd level)'],
    [{ id: 'pact', level: 1 }, 'pact slot (1st level)'],
    [{ id: 'spell4', level: null }, 'spell slot'],
    [{ id: 'pact', level: null }, 'spell slot'],
  ] as const)('names %p’s slot %p', (pool, name) => {
    expect(slotName(pool)).toBe(name)
    expect(slotWords(pool)).toBe(`a ${name}`)
  })

  it.each(POOLS)('says $words as the use picker does', ({ pool, words }) => {
    expect(slotWords(pool)).toBe(words)
  })

  it.each(POOLS)(
    "has the use picker's Spend switch say $words of the same pool",
    ({ words, action, spellbook }) => {
      render(
        createElement(UsePicker, {
          picking: { kind: 'alone', action, healing: false, choice: {} },
          spellbook,
          spendKey: 'sending-stone:alone-spend:player:char-1',
          onPick: jest.fn(),
          onClose: jest.fn(),
        }),
      )
      expect(
        within(screen.getByRole('dialog')).getByRole('switch'),
      ).toHaveAccessibleName(`Spend ${words}`)
    },
  )
})
