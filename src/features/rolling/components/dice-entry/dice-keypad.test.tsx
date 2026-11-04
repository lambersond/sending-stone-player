import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiceKeypad } from './dice-keypad'

const names = () =>
  within(screen.getByRole('group', { name: 'Keypad' }))
    .getAllByRole('button')
    .map(key => key.getAttribute('aria-label') ?? key.textContent)

describe('components/dice-entry/dice-keypad', () => {
  it('lays its keys out in three columns, as a phone’s number pad, Next die across the foot', () => {
    render(<DiceKeypad onKey={jest.fn()} d100={false} />)

    const pad = screen.getByRole('group', { name: 'Keypad' })
    expect(pad).toHaveClass('grid-cols-3')
    expect(names()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'Delete',
      '0',
      '00',
      'Next die',
    ])
    expect(screen.getByRole('button', { name: 'Next die' })).toHaveClass(
      'col-span-3',
    )
    // 44px keys, 40px on a short screen.
    expect(screen.getByRole('button', { name: '5' })).toHaveClass(
      'h-11',
      '[@media(max-height:40rem)]:h-10',
    )
    for (const key of within(pad).getAllByRole('button')) {
      expect(key).toHaveAttribute('type', 'button')
    }
  })

  it('compact, lays the same keys out in five columns, for a short screen', () => {
    render(<DiceKeypad onKey={jest.fn()} d100={false} compact />)

    expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
      'grid-cols-5',
    )
    expect(names()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      '00',
      'Delete',
      'Next die',
    ])
    expect(screen.getByRole('button', { name: 'Next die' })).toHaveClass(
      'col-span-3',
    )
    expect(screen.getByRole('button', { name: '5' })).toHaveClass('h-9')
    expect(screen.getByRole('button', { name: '5' })).not.toHaveClass('h-11')
  })

  it('without Next die, on the last box, lays its other twelve keys out in four full rows of three', () => {
    render(<DiceKeypad onKey={jest.fn()} d100={false} next={false} />)

    const pad = screen.getByRole('group', { name: 'Keypad' })
    expect(pad).toHaveClass('grid-cols-3')
    expect(names()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'Delete',
      '0',
      '00',
    ])
    expect(screen.queryByRole('button', { name: 'Next die' })).toBeNull()
    // Every key one column wide: nothing spans into where Next die was.
    for (const key of within(pad).getAllByRole('button')) {
      expect(key.className).not.toMatch(/col-span-/)
    }
  })

  it('compact, without Next die, widens Delete into its place, its three rows kept', () => {
    render(<DiceKeypad onKey={jest.fn()} d100={false} compact next={false} />)

    expect(screen.getByRole('group', { name: 'Keypad' })).toHaveClass(
      'grid-cols-5',
    )
    expect(names()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      '00',
      'Delete',
    ])
    expect(screen.queryByRole('button', { name: 'Next die' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'col-span-4',
    )
    expect(screen.getByRole('button', { name: '00' }).className).not.toMatch(
      /col-span-/,
    )
  })

  it('widens Delete only in place of Next die, in five columns', () => {
    const { rerender } = render(
      <DiceKeypad onKey={jest.fn()} d100={false} compact />,
    )
    expect(
      screen.getByRole('button', { name: 'Delete' }).className,
    ).not.toMatch(/col-span-/)

    rerender(<DiceKeypad onKey={jest.fn()} d100={false} next={false} />)
    expect(
      screen.getByRole('button', { name: 'Delete' }).className,
    ).not.toMatch(/col-span-/)
  })

  it('marks each key by what it is, as the dialog reads it', () => {
    render(<DiceKeypad onKey={jest.fn()} d100={false} />)

    expect(
      within(screen.getByRole('group', { name: 'Keypad' }))
        .getAllByRole('button')
        .map(key => key.dataset.key),
    ).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'delete',
      '0',
      '00',
      'next',
    ])
  })

  it('says which key was pressed: each digit, Delete and Next die', async () => {
    const user = userEvent.setup()
    const onKey = jest.fn()
    render(<DiceKeypad onKey={onKey} d100={false} />)

    for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Next die' }))

    expect(onKey.mock.calls.map(([key]) => key)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'delete',
      'next',
    ])
  })

  it('takes 00 only for a percentile die', async () => {
    const user = userEvent.setup()
    const onKey = jest.fn()
    const { rerender } = render(<DiceKeypad onKey={onKey} d100={false} />)

    const doubleZero = screen.getByRole('button', { name: '00' })
    expect(doubleZero).toHaveAttribute('aria-disabled', 'true')
    await user.click(doubleZero)
    expect(onKey).not.toHaveBeenCalled()

    rerender(<DiceKeypad onKey={onKey} d100 />)
    expect(doubleZero).not.toHaveAttribute('aria-disabled')
    await user.click(doubleZero)
    expect(onKey).toHaveBeenCalledWith('00')
  })

  it('leaves focus where it was on a tap or a click, cancelling both the pointer and the mouse going down', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label='Box' />
        <DiceKeypad onKey={jest.fn()} d100={false} />
      </>,
    )
    const box = screen.getByRole('textbox', { name: 'Box' })
    box.focus()

    await user.click(screen.getByRole('button', { name: '7' }))
    expect(box).toHaveFocus()

    for (const key of ['7', 'Delete', 'Next die', '00']) {
      const button = screen.getByRole('button', { name: key })
      expect(fireEvent.mouseDown(button)).toBe(false)
      expect(fireEvent.pointerDown(button)).toBe(false)
    }
  })
})
