/* eslint-disable unicorn/no-null -- the sheet uses null for a count it doesn't know */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hitDieSpending, HitDieUse } from './hit-dice'
import { LONG_PRESS } from './roll-button'
import { Modal } from '@/components/modal'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'
import type { HitDicePool } from '@/utils/formulas'

/** Thorin's sheet, with this Constitution modifier, and these hit points. */
const sheetWith = (con: number, fields: Partial<CharacterSheet> = {}) => {
  const sheet = characterSheet(fields)
  return toTableSheet(
    {
      ...sheet,
      abilities: sheet.abilities.map(ability =>
        ability.id === 'con' ? { ...ability, mod: con } : ability,
      ),
    },
    'https://my-game.forge-vtt.com',
  )
}

/** A Use button for d8 hit dice, this many left of how many, on a sheet with this Constitution. */
const renderUse = (
  pool: Partial<HitDicePool> = {},
  con = 3,
  fields: Partial<CharacterSheet> = {},
) => {
  const onRollFormula = jest.fn()
  const spending = hitDieSpending(sheetWith(con, fields), onRollFormula)
  if (!spending) throw new Error('Nothing spends them')
  render(
    <>
      <HitDieUse
        pool={{ die: 'd8', value: 4, max: 6, ...pool }}
        spending={spending}
      />
      <button type='button'>Elsewhere</button>
    </>,
  )
  const use = screen.getByRole('button', { name: /^Use a d8 hit die/ })
  // A button 60 by 32 pixels, 100 from the left of the window and 50 from its top.
  jest
    .spyOn(use, 'getBoundingClientRect')
    .mockReturnValue(DOMRect.fromRect({ x: 100, y: 50, width: 60, height: 32 }))
  return { use, onRollFormula }
}

/** What an element shows, leaving out what only a screen reader has. */
const seen = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement
  for (const hidden of copy.querySelectorAll('.sr-only')) hidden.remove()
  return copy.textContent
}

const popover = () => screen.getByRole('dialog', { name: 'Use d8 hit dice' })
const more = () =>
  within(popover()).getByRole('button', { name: 'One die more' })
const fewer = () =>
  within(popover()).getByRole('button', { name: 'One die fewer' })

describe('components/character-sheet/hit-dice', () => {
  it('uses one die a tap, named for what it says, then how many are left, and says it opens a dialog', async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse()

    expect(use).toHaveTextContent(/^Use$/)
    expect(use).toHaveAccessibleName('Use a d8 hit die, 4 of 6 left')
    expect(use).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(use)

    expect(onRollFormula).toHaveBeenCalledTimes(1)
    expect(onRollFormula).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Hit die (d8)', minimum: 1 }),
    )
    expect(onRollFormula.mock.lastCall?.[0]).not.toHaveProperty('times')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a popover on a right-click, where the pointer is, to use from 1 to as many as are left', async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse()

    await user.pointer({ keys: '[MouseRight]', target: use })
    expect(onRollFormula).not.toHaveBeenCalled()
    // Thorin's Constitution, +3, for each die; one to start with.
    expect(popover()).toHaveTextContent('Use d8 hit dice')
    expect(popover()).toHaveTextContent('1 of 4')
    expect(popover()).toHaveTextContent('Heals 1d8 + 3')
    // One more is what it's opened for.
    await waitFor(() => expect(more()).toHaveFocus())
    expect(fewer()).toHaveAttribute('aria-disabled', 'true')

    await user.click(fewer())
    expect(popover()).toHaveTextContent('1 of 4')
    for (let press = 0; press < 5; press++) await user.click(more())
    // No more than are left, the button staying where focus is.
    expect(popover()).toHaveTextContent('4 of 4')
    expect(popover()).toHaveTextContent('Heals 4d8 + 12')
    expect(more()).toHaveAttribute('aria-disabled', 'true')
    expect(more()).toHaveFocus()
    await user.click(fewer())
    expect(popover()).toHaveTextContent('Heals 3d8 + 9')

    const spend = within(popover()).getByRole('button', { name: /^Use 3/ })
    expect(seen(spend)).toBe('Use 3')
    expect(spend).toHaveAccessibleName('Use 3 d8 hit dice')
    await user.click(spend)

    expect(onRollFormula).toHaveBeenCalledTimes(1)
    expect(onRollFormula).toHaveBeenCalledWith({
      label: 'Hit dice (3d8)',
      terms: [
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, flat: 3 },
      ],
      healing: true,
      minimum: 1,
      times: 3,
      source: { kind: 'hitDie', denomination: 'd8' },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    [-1, 'Heals 2d8 − 2'],
    [0, 'Heals 2d8'],
  ])(
    'says what they give back with a Constitution modifier of %d for each',
    async (con, heals) => {
      const user = userEvent.setup()
      const { use } = renderUse({}, con)

      fireEvent.contextMenu(use, { button: 2, clientX: 130, clientY: 60 })
      await user.click(more())

      expect(popover()).toHaveTextContent(heals)
    },
  )

  it('uses each die at least none under the 2014 rules', async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse({}, -1, { rules: 'legacy' })

    fireEvent.contextMenu(use, { button: 2, clientX: 130, clientY: 60 })
    await user.click(more())
    await user.click(within(popover()).getByRole('button', { name: /^Use 2/ }))

    expect(onRollFormula).toHaveBeenCalledWith(
      expect.objectContaining({ minimum: 0, times: 2 }),
    )
  })

  it("opens from the keyboard's context menu key, or Shift+F10, below the button, without using one", async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse()

    use.focus()
    // Chrome gives the menu a context menu key opens no button.
    fireEvent.contextMenu(use, { button: -1 })

    expect(popover()).toBeInTheDocument()
    await waitFor(() => expect(more()).toHaveFocus())
    // Enter on its buttons changes how many, rather than using them.
    await user.keyboard('{Enter}{Enter}')
    expect(popover()).toHaveTextContent('3 of 4')
    expect(onRollFormula).not.toHaveBeenCalled()
    await user.tab()
    expect(
      within(popover()).getByRole('button', { name: /^Use 3/ }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onRollFormula).toHaveBeenCalledWith(
      expect.objectContaining({ times: 3 }),
    )
  })

  it('opens on a long-press on a touch screen, the tap that ends it using none', () => {
    jest.useFakeTimers()
    try {
      const { use, onRollFormula } = renderUse()

      fireEvent.pointerDown(use, {
        pointerType: 'touch',
        clientX: 120,
        clientY: 60,
      })
      act(() => jest.advanceTimersByTime(LONG_PRESS))
      expect(popover()).toBeInTheDocument()
      fireEvent.pointerUp(use, { pointerType: 'touch' })
      fireEvent.click(use)

      expect(onRollFormula).not.toHaveBeenCalled()
      expect(popover()).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('closes on Escape, or a click elsewhere, using none', async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse()

    await user.pointer({ keys: '[MouseRight]', target: use })
    await waitFor(() => expect(more()).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.pointer({ keys: '[MouseRight]', target: use })
    expect(popover()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRollFormula).not.toHaveBeenCalled()
  })

  it('offers one, starting on its Use button, with only one left', async () => {
    const user = userEvent.setup()
    const { use } = renderUse({ value: 1 })

    await user.pointer({ keys: '[MouseRight]', target: use })

    expect(popover()).toHaveTextContent('1 of 1')
    expect(more()).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() =>
      expect(
        within(popover()).getByRole('button', { name: 'Use 1 d8 hit die' }),
      ).toHaveFocus(),
    )
  })

  it.each([
    [
      'as many as there are, where the sheet does not say how many are left',
      { value: null },
      '1 of 6',
    ],
    ['one, where it says neither', { value: null, max: null }, '1 of 1'],
  ])('offers %s', async (_, pool, offered) => {
    const user = userEvent.setup()
    const { use } = renderUse(pool)

    await user.pointer({ keys: '[MouseRight]', target: use })

    expect(popover()).toHaveTextContent(offered)
  })

  it('keeps to how many are left as the sheet changes while it is open, and closes once none can be spent', async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    const use = (left: number, fields: Partial<CharacterSheet> = {}) => (
      <>
        <HitDieUse
          pool={{ die: 'd8', value: left, max: 6 }}
          spending={hitDieSpending(sheetWith(3, fields), onRollFormula)!}
        />
        <button type='button'>Elsewhere</button>
      </>
    )
    const { rerender } = render(use(4))

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: /^Use a d8/ }),
    })
    for (let press = 0; press < 3; press++) await user.click(more())
    expect(popover()).toHaveTextContent('4 of 4')
    // Two spent elsewhere.
    rerender(use(2))
    expect(popover()).toHaveTextContent('2 of 2')
    expect(popover()).toHaveTextContent('Heals 2d8 + 6')
    // Two more given back elsewhere: as many as were chosen still, not as many as before.
    rerender(use(4))
    expect(popover()).toHaveTextContent('2 of 4')
    expect(popover()).toHaveTextContent('Heals 2d8 + 6')
    // Healed to full elsewhere.
    rerender(use(4, { hp: { value: 44, max: 44, temp: 0 } }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRollFormula).not.toHaveBeenCalled()

    // Hurt again, with the player elsewhere: closed for good, it doesn't open by itself.
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    rerender(use(4))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(elsewhere).toHaveFocus()
  })

  it('stays closed once the last die is spent, when a long rest gives them back', async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    const use = (left: number) => (
      <HitDieUse
        pool={{ die: 'd8', value: left, max: 6 }}
        spending={hitDieSpending(sheetWith(3), onRollFormula)!}
      />
    )
    const { rerender } = render(use(1))

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: /^Use a d8/ }),
    })
    expect(popover()).toHaveTextContent('1 of 1')
    // The last one spent, as the sheet says.
    rerender(use(0))
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(use(6))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRollFormula).not.toHaveBeenCalled()
  })

  it('closes on a click on its Use button, using none, rather than using one with it still open', async () => {
    const user = userEvent.setup()
    const { use, onRollFormula } = renderUse()

    await user.pointer({ keys: '[MouseRight]', target: use })
    await user.click(more())
    expect(popover()).toHaveTextContent('2 of 4')
    await user.click(use)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRollFormula).not.toHaveBeenCalled()
    // Closed, a click uses one again.
    await user.click(use)
    expect(onRollFormula).toHaveBeenCalledTimes(1)
    expect(onRollFormula.mock.lastCall?.[0]).not.toHaveProperty('times')
  })

  it('closes on a tap on its Use button after a long-press opened it, using none', () => {
    jest.useFakeTimers()
    try {
      const { use, onRollFormula } = renderUse()
      const tap = () => {
        fireEvent.pointerDown(use, { pointerType: 'touch' })
        fireEvent.pointerUp(use, { pointerType: 'touch' })
        fireEvent.click(use)
      }

      fireEvent.pointerDown(use, {
        pointerType: 'touch',
        clientX: 120,
        clientY: 60,
      })
      act(() => jest.advanceTimersByTime(LONG_PRESS))
      fireEvent.pointerUp(use, { pointerType: 'touch' })
      fireEvent.click(use)
      expect(popover()).toBeInTheDocument()
      tap()

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onRollFormula).not.toHaveBeenCalled()
      tap()
      expect(onRollFormula).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('opens inside a dialog it is in, as the page behind it can’t be used, where Escape closes only it', async () => {
    const user = userEvent.setup()
    const pressed: KeyboardEvent[] = []
    const keep = (event: KeyboardEvent) => {
      if (event.key === 'Escape') pressed.push(event)
    }
    globalThis.addEventListener('keydown', keep, true)
    const spending = hitDieSpending(sheetWith(3), jest.fn())!
    render(
      <Modal open onClose={jest.fn()} title='Thorin'>
        <HitDieUse pool={{ die: 'd8', value: 4, max: 6 }} spending={spending} />
      </Modal>,
    )

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: /^Use a d8/ }),
    })
    expect(screen.getByRole('dialog', { name: 'Thorin' })).toContainElement(
      popover(),
    )
    await waitFor(() => expect(more()).toHaveFocus())
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Use d8 hit dice' })).toBeNull()
    // The key cancelled, which the browser would otherwise take to close the dialog too.
    expect(pressed.at(-1)?.defaultPrevented).toBe(true)
    await user.keyboard('{Escape}')
    expect(pressed.at(-1)?.defaultPrevented).toBe(false)
    globalThis.removeEventListener('keydown', keep, true)
  })

  it.each([
    ['with none left', { value: 0 }, {}, 'None left'],
    [
      'at full hit points',
      {},
      { hp: { value: 44, max: 44, temp: 0 } },
      'At full hit points',
    ],
  ])(
    'uses none, nor opens its popover, %s, saying why in its title',
    async (_, pool, fields, why) => {
      const user = userEvent.setup()
      const { use, onRollFormula } = renderUse(pool, 3, fields)

      expect(use).toBeDisabled()
      expect(use).toHaveAttribute('title', why)
      expect(use).toHaveAccessibleDescription(why)
      await user.click(use)
      fireEvent.contextMenu(use, { button: 2, clientX: 130, clientY: 60 })
      fireEvent.contextMenu(use, { button: -1 })

      expect(onRollFormula).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )
})
