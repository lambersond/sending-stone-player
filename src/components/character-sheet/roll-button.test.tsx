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
  const button = screen.getByRole('button')
  // A row 300 by 40 pixels, 100 from the left of the window and 50 from its top.
  jest
    .spyOn(button, 'getBoundingClientRect')
    .mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 50, width: 300, height: 40 }),
    )
  return { button, onRoll, onMenu }
}

const touch = { pointerType: 'touch', clientX: 110, clientY: 60 }

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

    const shown = fireEvent.contextMenu(button, {
      button: 2,
      clientX: 390,
      clientY: 70,
    })

    expect(shown).toBe(false)
    // Where on the row the click was, for the menu to open there.
    expect(onMenu).toHaveBeenCalledWith(button, target, {
      x: 290,
      y: 20,
      touch: false,
    })
    expect(onRoll).not.toHaveBeenCalled()

    // The next press is a plain click again.
    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    fireEvent.click(button)
    expect(onRoll).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'Chrome',
      () => new MouseEvent('contextmenu', { bubbles: true, button: -1 }),
    ],
    [
      'the Pointer Events spec',
      () =>
        new PointerEvent('contextmenu', {
          bubbles: true,
          pointerType: '',
          clientX: 250,
          clientY: 70,
        }),
    ],
    [
      'a browser that puts it at the corner of the page',
      () => new MouseEvent('contextmenu', { bubbles: true, clientX: 0 }),
    ],
  ])(
    'opens its menu below itself for the context menu key, as %s sends it',
    (_, key) => {
      const { button, onMenu } = renderButton()

      fireEvent(button, key())

      expect(onMenu).toHaveBeenCalledWith(button, target, undefined)
    },
  )

  it('opens its menu above the finger for a touch screen’s own long-press', () => {
    const { button, onMenu } = renderButton()

    fireEvent(
      button,
      new PointerEvent('contextmenu', {
        bubbles: true,
        pointerType: 'touch',
        clientX: 200,
        clientY: 80,
      }),
    )

    expect(onMenu).toHaveBeenCalledWith(button, target, {
      x: 100,
      y: 30,
      touch: true,
    })
  })

  it('opens its menu on a long-press, and the tap that ends it does not roll', () => {
    const { button, onRoll, onMenu } = renderButton()

    fireEvent.pointerDown(button, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS - 1))
    expect(onMenu).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    // Where the finger went down, for the menu to open above it.
    expect(onMenu).toHaveBeenCalledWith(button, target, {
      x: 10,
      y: 10,
      touch: true,
    })

    fireEvent.pointerUp(button, touch)
    fireEvent.click(button)
    expect(onRoll).not.toHaveBeenCalled()
  })

  it.each([
    ['lifted', (button: HTMLElement) => fireEvent.pointerUp(button, touch)],
    [
      'dragged away, as when scrolling',
      (button: HTMLElement) =>
        fireEvent.pointerMove(button, { ...touch, clientY: 90 }),
    ],
    ['cancelled', (button: HTMLElement) => fireEvent.pointerCancel(button)],
  ])('rolls rather than opening its menu on a tap %s early', (_, end) => {
    const { button, onRoll, onMenu } = renderButton()

    fireEvent.pointerDown(button, touch)
    fireEvent.pointerMove(button, { ...touch, clientX: 113 })
    end(button)
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    fireEvent.click(button)

    expect(onMenu).not.toHaveBeenCalled()
    expect(onRoll).toHaveBeenCalledTimes(1)
  })
})
