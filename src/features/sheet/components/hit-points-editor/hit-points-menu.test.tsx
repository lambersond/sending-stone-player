import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HitPointsMenu } from './hit-points-menu'
import type { HitPointsInput } from '@/types/roll'
import type { HitPointsNow } from '@/types/sending-stone'

/** Thorin before the GM's fall: 22 of 30, 3 temporary. */
const THORIN: HitPointsNow = { value: 22, max: 30, temp: 3 }

/** The editor, opened from a tile beside it. */
function Opened({
  hp,
  onSave,
  onClose,
}: Readonly<{
  hp: HitPointsNow
  onSave: (change: HitPointsInput) => void
  onClose: () => void
}>) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  return (
    <>
      <button ref={setAnchor} type='button'>
        Tile
      </button>
      {anchor && (
        <HitPointsMenu
          anchor={anchor}
          hp={hp}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </>
  )
}

/**
 * The editor, opened at these hit points, once its focus is on one hit point fewer, where it
 * starts; and at others, as the sheet changes.
 */
const renderMenu = async (hp: HitPointsNow = THORIN) => {
  const onSave = jest.fn()
  const onClose = jest.fn()
  const view = render(<Opened hp={hp} onSave={onSave} onClose={onClose} />)
  await waitFor(() => expect(button('One hit point fewer')).toHaveFocus())
  const rerender = (next: HitPointsNow) =>
    view.rerender(<Opened hp={next} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose, rerender }
}

const field = (name: string) => screen.getByRole('textbox', { name })
const button = (name: string) => screen.getByRole('button', { name })
const line = () => screen.getByRole('status')
/** What a control is described by, as a screen reader reads it after its name. */
const described = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map(id => document.querySelector(`#${CSS.escape(id)}`)?.textContent)
    .join(' ')

describe('features/sheet/components/hit-points-editor/hit-points-menu', () => {
  it('opens as a dialog at the numbers, its focus on one hit point fewer, Save waiting for a change', async () => {
    await renderMenu()

    expect(screen.getByRole('dialog', { name: 'Hit points' })).toBeVisible()
    expect(field('Hit points')).toHaveValue('22')
    expect(described(field('Hit points'))).toBe('of 30')
    expect(field('Temporary hit points')).toHaveValue('3')
    expect(line()).toHaveTextContent('Now 22 / 30 · 3 temporary')
    expect(button('Save')).toHaveAttribute('aria-disabled', 'true')
    expect(described(button('Save'))).toBe('Change a number to save')
  })

  it('takes the GM’s fall of 4, temporary ones first, and saves both from what it showed', async () => {
    const user = userEvent.setup()
    const { onSave } = await renderMenu()

    for (let tap = 0; tap < 3; tap += 1) {
      await user.click(button('One temporary hit point fewer'))
    }
    await user.click(button('One hit point fewer'))

    expect(line()).toHaveTextContent('22 → 21 · temporary 3 → 0')
    expect(button('One temporary hit point fewer')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(button('Save')).not.toHaveAttribute('aria-disabled', 'true')
    expect(button('Save')).not.toHaveAttribute('aria-describedby')
    await user.click(button('Save'))
    expect(onSave).toHaveBeenCalledWith({
      op: 'set',
      value: 21,
      temp: 0,
      from: { value: 22, temp: 3 },
    })
  })

  it('steps by the arrow keys, stops at the maximum with its hint, and clamps what’s typed as the field is left', async () => {
    const user = userEvent.setup()
    await renderMenu({ value: 29, max: 30, temp: 0 })

    await user.click(field('Hit points'))
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(field('Hit points')).toHaveValue('30')
    expect(button('One hit point more')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(described(button('One hit point more'))).toBe('30 is the maximum')
    expect(screen.getByText('30 is the maximum')).toBeVisible()

    await user.clear(field('Hit points'))
    await user.type(field('Hit points'), '4x5')
    expect(field('Hit points')).toHaveValue('45')
    expect(line()).toHaveTextContent('29 → 30')
    await user.tab()
    expect(field('Hit points')).toHaveValue('30')
  })

  it('saves on Enter what’s typed, as the number it comes to', async () => {
    const user = userEvent.setup()
    const { onSave } = await renderMenu()

    await user.click(field('Temporary hit points'))
    await user.keyboard('8{Enter}')

    expect(onSave).toHaveBeenCalledWith({
      op: 'set',
      temp: 8,
      from: { temp: 3 },
    })
  })

  it('resets to the game’s numbers, saying so, should they change while it’s open', async () => {
    const user = userEvent.setup()
    const { onSave, rerender } = await renderMenu()
    await user.click(button('One hit point fewer'))

    rerender({ value: 15, max: 30, temp: 0 })

    expect(field('Hit points')).toHaveValue('15')
    expect(field('Temporary hit points')).toHaveValue('0')
    expect(line()).toHaveTextContent(
      'Changed in the game: now 15 / 30 · 0 temporary',
    )
    expect(button('Save')).toHaveAttribute('aria-disabled', 'true')
    await user.click(button('One hit point fewer'))
    await user.click(button('Save'))
    expect(onSave).toHaveBeenCalledWith({
      op: 'set',
      value: 14,
      from: { value: 15 },
    })
  })

  it('closes on Cancel and on Escape, saving nothing', async () => {
    const user = userEvent.setup()
    const { onSave, onClose } = await renderMenu()

    await user.click(button('Cancel'))
    fireEvent.keyDown(field('Hit points'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSave).not.toHaveBeenCalled()
  })
})
