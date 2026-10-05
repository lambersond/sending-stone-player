import { act, fireEvent, render, screen } from '@testing-library/react'
import { LONG_PRESS, RollButton } from './roll-button'

const target = { label: 'Perception check', modifier: 7, mode: 0 as const }

const renderButton = () => {
  const onRoll = jest.fn()
  const onMenu = jest.fn()
  render(
    <RollButton
      target={target}
      onRoll={onRoll}
      onMenu={onMenu}
      label='Perception check, +7'
      className=''
    >
      Perception
    </RollButton>,
  )
  return { button: screen.getByRole('button'), onRoll, onMenu }
}

const touch = { pointerType: 'touch', clientX: 10, clientY: 10 }

describe('components/character-sheet/roll-button', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('rolls when clicked, and says it has a menu', () => {
    const { button, onRoll, onMenu } = renderButton()

    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    fireEvent.click(button)

    expect(onRoll).toHaveBeenCalledWith(target)
    expect(onMenu).not.toHaveBeenCalled()
  })

  it('opens its menu on a right-click instead of the browser’s, without rolling', () => {
    const { button, onRoll, onMenu } = renderButton()

    const shown = fireEvent.contextMenu(button)

    expect(shown).toBe(false)
    expect(onMenu).toHaveBeenCalledWith(button, target)
    expect(onRoll).not.toHaveBeenCalled()

    // The next press is a plain click again.
    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    fireEvent.click(button)
    expect(onRoll).toHaveBeenCalledTimes(1)
  })

  it('opens its menu on a long-press, and the tap that ends it does not roll', () => {
    const { button, onRoll, onMenu } = renderButton()

    fireEvent.pointerDown(button, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS - 1))
    expect(onMenu).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(onMenu).toHaveBeenCalledWith(button, target)

    fireEvent.pointerUp(button, touch)
    fireEvent.click(button)
    expect(onRoll).not.toHaveBeenCalled()
  })

  it.each([
    ['lifted', (button: HTMLElement) => fireEvent.pointerUp(button, touch)],
    [
      'dragged away, as when scrolling',
      (button: HTMLElement) =>
        fireEvent.pointerMove(button, { ...touch, clientY: 40 }),
    ],
    ['cancelled', (button: HTMLElement) => fireEvent.pointerCancel(button)],
  ])('rolls rather than opening its menu on a tap %s early', (_, end) => {
    const { button, onRoll, onMenu } = renderButton()

    fireEvent.pointerDown(button, touch)
    fireEvent.pointerMove(button, { ...touch, clientX: 13 })
    end(button)
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    fireEvent.click(button)

    expect(onMenu).not.toHaveBeenCalled()
    expect(onRoll).toHaveBeenCalledTimes(1)
  })
})
