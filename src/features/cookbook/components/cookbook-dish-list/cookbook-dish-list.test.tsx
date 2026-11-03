/* eslint-disable unicorn/no-null -- the view uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { CookbookDishList } from './cookbook-dish-list'
import type { CookbookDishView } from '@/types/cookbook'

// The words of a dish failed after its hand-overs come from the constant (round 0.38.0, C-19):
// mocked to another number than the 5 it is, so words written out with a 5 fail.
jest.mock('@/constants/cookbook', () => ({
  ...jest.requireActual('@/constants/cookbook'),
  DISH_ATTEMPTS: 7,
}))

/** A dish as the player's card lists it: a boon, waiting for Foundry. */
const dish = (fields: Partial<CookbookDishView> = {}): CookbookDishView => ({
  id: 'cmh9q2x7k0003ssdish0001',
  recipe: 'Fireberry Glazed Skewers',
  outcome: 'boon',
  state: 'queued',
  reason: null,
  eatenBy: [],
  rolled: [],
  queuedAt: '2026-10-24T19:00:00.000Z',
  decidedAt: null,
  ...fields,
})

/** The list's dishes, each as a reader reads it: recipe, chip, state. */
const rows = () =>
  within(screen.getByRole('list', { name: 'Dishes sent' }))
    .getAllByRole('listitem')
    .map(item => {
      const [named, state] = item.children
      return [...named.children, state].map(part => part.textContent)
    })

/** The one dish's state, as its card says it. */
const stateOf = (shown: CookbookDishView, live = true) => {
  render(<CookbookDishList dishes={[shown]} live={live} />)
  return screen.getByRole('listitem').lastElementChild?.textContent ?? ''
}

describe('components/cookbook-card/cookbook-dish-list', () => {
  it('lists the dishes sent, in the order given, each by its recipe, its outcome’s chip and its state', () => {
    render(
      <CookbookDishList
        live
        dishes={[
          dish({ id: 'd3', state: 'delivered' }),
          dish({
            id: 'd2',
            recipe: 'Ashen Root Stew',
            outcome: 'bane',
            state: 'dismissed',
            reason: 'dismissed',
          }),
          dish({ id: 'd1', recipe: 'Ashen Root Stew', outcome: 'standard' }),
        ]}
      />,
    )
    expect(rows()).toEqual([
      ['Fireberry Glazed Skewers', 'Boon', 'With your Gamemaster'],
      ['Ashen Root Stew', 'Bane', 'Set aside by your Gamemaster'],
      ['Ashen Root Stew', 'Standard', 'Waiting for Foundry'],
    ])
    // Each its own entry, read in that order.
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(
      'Ashen Root StewBaneSet aside by your Gamemaster',
    )
  })

  it('wraps a long recipe name, never widening the card', () => {
    render(<CookbookDishList live dishes={[dish()]} />)
    expect(screen.getByText('Fireberry Glazed Skewers')).toHaveClass(
      'break-words',
    )
  })

  it.each([
    ['queued', true, 'Waiting for Foundry'],
    [
      'queued',
      false,
      'Waiting for Foundry · your Gamemaster’s game isn’t open',
    ],
    ['claimed', true, 'Waiting for Foundry'],
    [
      'claimed',
      false,
      'Waiting for Foundry · your Gamemaster’s game isn’t open',
    ],
    ['delivered', false, 'With your Gamemaster'],
  ] as const)('says a %s dish, the game live %s: %s', (state, live, words) => {
    expect(stateOf(dish({ state }), live)).toBe(words)
  })

  it.each([
    [['Thorin Oakenshield'], 'Eaten by Thorin Oakenshield'],
    [['Thorin Oakenshield', 'Vex'], 'Eaten by Thorin Oakenshield and Vex'],
    [
      ['Thorin Oakenshield', 'Vex', 'Rook'],
      'Eaten by Thorin Oakenshield, Vex and Rook',
    ],
    [
      ['Thorin Oakenshield', 'Vex', 'Rook', 'Bilbo'],
      'Eaten by Thorin Oakenshield, Vex, Rook and Bilbo',
    ],
  ])('names who ate it: %j', (eatenBy, words) => {
    expect(stateOf(dish({ state: 'applied', eatenBy }))).toBe(words)
  })

  it('says each value its dice rolled, signed, maximum HP by its name and another kind by its own', () => {
    expect(
      stateOf(
        dish({
          state: 'applied',
          eatenBy: ['Thorin Oakenshield', 'Vex'],
          rolled: [
            { type: 'maxHitPoints', value: 7, formula: '3+1d6' },
            { type: 'maxHitPoints', value: -9, formula: '3+1d6' },
            { type: 'tempHitPoints', value: 5 },
          ],
        }),
      ),
    ).toBe(
      'Eaten by Thorin Oakenshield and Vex · Max HP +7 (3+1d6) · Max HP −9 (3+1d6) · tempHitPoints +5',
    )
  })

  it('says a dish served before who ate it is heard of was served, never “Eaten by ” with no one', () => {
    const words = stateOf(dish({ state: 'applied', eatenBy: [] }))
    expect(words).toBe('Served in Foundry')
    expect(words).not.toMatch(/Eaten by/)
  })

  it.each([
    ['dismissed', 'Set aside by your Gamemaster'],
    ['deleted', 'Removed in Foundry'],
  ])('says a dish dismissed as %s: %s', (reason, words) => {
    expect(stateOf(dish({ state: 'dismissed', reason }))).toBe(words)
  })

  it('says a dish Foundry never answered failed after DISH_ATTEMPTS tries, with no way to send it again', () => {
    expect(stateOf(dish({ state: 'failed', reason: 'undeliverable' }))).toBe(
      'Couldn’t reach the game: Foundry didn’t answer after 7 tries.',
    )
    // As the user answered: the player cooks and sends another (round 0.38.0, Q3).
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/again/i)).toBeNull()
  })

  it('says a dish the Gamemaster’s Foundry couldn’t read', () => {
    expect(stateOf(dish({ state: 'failed', reason: 'invalid' }))).toBe(
      'Couldn’t reach the game: your Gamemaster’s Foundry couldn’t read this dish.',
    )
  })

  it.each(['error', 'tooOld'])(
    'says any other failure, %s, in the doc’s words, its reason in them',
    reason => {
      expect(stateOf(dish({ state: 'failed', reason }))).toBe(
        `Couldn’t reach the game: Foundry refused it (${reason}).`,
      )
    },
  )

  it.each([
    ['boon', 'Boon'],
    ['bane', 'Bane'],
    ['standard', 'Standard'],
  ] as const)('marks a %s with the word %s', (outcome, word) => {
    render(<CookbookDishList live dishes={[dish({ outcome })]} />)
    expect(within(screen.getByRole('listitem')).getByText(word)).toHaveClass(
      'rounded-full',
    )
  })
})
