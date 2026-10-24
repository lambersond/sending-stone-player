import { createElement } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useHold } from './use-hold'
import { END_TURN_HOLD } from '@/utils/end-turn'

/*
 * The Combat tab held to end the turn (module 0.36.0), on a tab of its own: its fill, its toast,
 * its end with a buzz, and the click the browser sends after a press. Time is faked, the frames
 * with it, every 16 milliseconds.
 */

type Props = {
  turn?: string
  onToast?: () => void
  onEnd?: () => void
  onCancel?: () => void
  onClick?: () => void
}

function Tab({
  turn,
  onToast = () => {},
  onEnd = () => {},
  onCancel = () => {},
  onClick,
}: Readonly<Props>) {
  const { handlers, holding, pressed, fill } = useHold({
    key: turn,
    onToast,
    onEnd,
    onCancel,
  })
  return createElement(
    'button',
    {
      type: 'button',
      ...handlers,
      onClick,
      'data-holding': holding,
      'data-pressed': pressed,
    },
    turn !== undefined &&
      createElement('span', {
        ref: fill,
        'data-testid': 'fill',
        style: { transform: 'scaleX(0)' },
      }),
    'Combat',
  )
}

const TURN = 'cmbt1:1:c-thorin'

const setup = (props: Props = {}) => {
  const calls = {
    onToast: jest.fn(),
    onEnd: jest.fn(),
    onCancel: jest.fn(),
    onClick: jest.fn(),
  }
  const all = { turn: TURN, ...calls, ...props }
  const view = render(createElement(Tab, all))
  return {
    ...calls,
    ...view,
    tab: screen.getByRole('button'),
    again: (more: Props) =>
      view.rerender(createElement(Tab, { ...all, ...more })),
  }
}

type PointerInit = {
  pointerId?: number
  isPrimary?: boolean
  button?: number
  clientX?: number
  clientY?: number
  pointerType?: string
}

/** A pointer's event, with its pointer's id and whether that's the primary: jsdom has neither. */
const pointer = (target: Element, type: string, init: PointerInit = {}) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.clientX ?? 20,
    clientY: init.clientY ?? 20,
    pointerType: init.pointerType ?? 'touch',
  })
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 })
  Object.defineProperty(event, 'isPrimary', {
    value: init.isPrimary ?? true,
  })
  return fireEvent(target, event)
}

const down = (target: Element, init?: PointerInit) =>
  pointer(target, 'pointerdown', init)
const up = (target: Element, init?: PointerInit) =>
  pointer(target, 'pointerup', init)

/** The browser's click after a press: one with a click count, unlike the keyboard's. */
const click = (target: Element) => fireEvent.click(target, { detail: 1 })

const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms))

/** How far the fill is drawn, from its transform. */
const scale = () => {
  const transform = screen.getByTestId('fill').style.transform
  const match = /^scaleX\((.+)\)$/.exec(transform)
  if (!match) throw new Error(`No scale in ${transform}`)
  return Number(match[1])
}

describe('hooks/use-hold', () => {
  let vibrate: jest.Mock
  beforeEach(() => {
    jest.useFakeTimers()
    vibrate = jest.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
  })
  afterEach(() => {
    jest.useRealTimers()
    Reflect.deleteProperty(navigator, 'vibrate')
  })

  it('fills from nothing as a touch is held, says so at half a second, and ends the turn at a second with a buzz', () => {
    const { tab, onToast, onEnd, onCancel } = setup()

    down(tab)
    expect(tab).toHaveAttribute('data-holding', 'true')
    // Nothing for the first sixth, so that a tap never flickers.
    wait(160)
    expect(screen.getByTestId('fill').style.transform).toBe('scaleX(0)')
    wait(40)
    expect(scale()).toBeGreaterThan(0)
    wait(383)
    expect(scale()).toBeCloseTo(0.5, 1)
    expect(onToast).toHaveBeenCalledTimes(1)
    wait(999 - 583)
    expect(scale()).toBeCloseTo(1, 1)
    expect(onEnd).not.toHaveBeenCalled()
    expect(tab).toHaveAttribute('data-holding', 'true')

    wait(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(12)
    expect(onToast).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    // Emptied, and held no more.
    expect(scale()).toBe(0)
    expect(tab).toHaveAttribute('data-holding', 'false')
    wait(2000)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('says it at half a second, not before', () => {
    const { tab, onToast } = setup()
    down(tab)
    wait(499)
    expect(onToast).not.toHaveBeenCalled()
    wait(1)
    expect(onToast).toHaveBeenCalledTimes(1)
  })

  it('takes a let-go within 300 ms for a tap: nothing stops, and its click is the tab’s', () => {
    const { tab, onCancel, onEnd, onClick, onToast } = setup()

    down(tab)
    wait(250)
    up(tab)
    expect(click(tab)).toBe(true)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
    expect(onToast).not.toHaveBeenCalled()
    expect(scale()).toBe(0)
  })

  it('cancels a let-go after 300 ms, and swallows its click', () => {
    const { tab, onCancel, onEnd, onClick } = setup()

    down(tab)
    wait(400)
    up(tab)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(click(tab)).toBe(false)
    expect(onClick).not.toHaveBeenCalled()
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
    expect(scale()).toBe(0)
    // Only that once: the next click is the tab's.
    click(tab)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('cancels a press that drifts more than 10 px, and swallows its click', () => {
    const { tab, onCancel, onEnd, onClick } = setup()

    down(tab, { clientX: 20, clientY: 20 })
    pointer(tab, 'pointermove', { clientX: 26, clientY: 28 })
    expect(onCancel).not.toHaveBeenCalled()
    pointer(tab, 'pointermove', { clientX: 20, clientY: 9 })
    expect(onCancel).toHaveBeenCalledTimes(1)
    up(tab)
    click(tab)
    expect(onClick).not.toHaveBeenCalled()
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the browser takes the pointer',
      (tab: Element) => pointer(tab, 'pointercancel'),
    ],
    [
      'the page is hidden',
      () => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          configurable: true,
        })
        fireEvent(document, new Event('visibilitychange'))
      },
    ],
  ])('cancels the hold where %s', (_, stop) => {
    const { tab, onCancel, onEnd } = setup()

    down(tab)
    wait(300)
    stop(tab)
    expect(onCancel).toHaveBeenCalledTimes(1)
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('cancels where the turn changes under the press, ending none', () => {
    const { tab, onCancel, onEnd, again } = setup()

    down(tab)
    wait(600)
    again({ turn: 'cmbt1:1:c-brakka' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it.each([
    ["a mouse's right button", { pointerType: 'mouse', button: 2 }],
    ['a pointer that isn’t the primary', { isPrimary: false }],
  ])('does nothing for %s', (_, init) => {
    const { tab, onToast, onEnd } = setup()

    down(tab, init)
    expect(tab).toHaveAttribute('data-holding', 'false')
    wait(END_TURN_HOLD)
    expect(onToast).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it("holds for a mouse's main button", () => {
    const { tab, onEnd } = setup()
    down(tab, { pointerType: 'mouse' })
    wait(END_TURN_HOLD)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('ignores a second pointer while one holds', () => {
    const { tab, onEnd, onCancel } = setup()

    down(tab, { pointerId: 1 })
    wait(200)
    down(tab, { pointerId: 2, clientX: 200 })
    up(tab, { pointerId: 2 })
    wait(END_TURN_HOLD - 200)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('holds nothing with no turn to end, and leaves the click alone', () => {
    const { tab, onToast, onEnd, onClick } = setup({ turn: undefined })

    down(tab)
    expect(tab).toHaveAttribute('data-holding', 'false')
    expect(tab).toHaveAttribute('data-pressed', 'false')
    wait(2000)
    up(tab)
    click(tab)
    expect(onToast).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps the browser’s menu away while there’s a turn to end, not otherwise', () => {
    const { tab, again, onEnd } = setup()

    expect(fireEvent.contextMenu(tab)).toBe(false)
    // Android's long press: the hold goes on.
    down(tab)
    wait(600)
    expect(fireEvent.contextMenu(tab)).toBe(false)
    wait(400)
    expect(onEnd).toHaveBeenCalledTimes(1)
    up(tab)

    again({ turn: undefined })
    expect(fireEvent.contextMenu(tab)).toBe(true)
  })

  it('ends nothing once unmounted mid-hold', () => {
    const { tab, onEnd, onToast, unmount } = setup()
    down(tab)
    wait(200)
    unmount()
    wait(2000)
    expect(onToast).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('leaves the keyboard’s click to the tab, whatever came before it', () => {
    const { tab, onClick } = setup()

    fireEvent.click(tab, { detail: 0 })
    expect(onClick).toHaveBeenCalledTimes(1)
    down(tab)
    wait(400)
    up(tab)
    fireEvent.click(tab, { detail: 0 })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('swallows the click after a hold that ended the turn', () => {
    const { tab, onEnd, onClick } = setup()

    down(tab)
    wait(END_TURN_HOLD + 300)
    up(tab)
    expect(click(tab)).toBe(false)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('still swallows it where the turn to end has gone by the time the finger lifts', () => {
    const { tab, onEnd, onCancel, onClick, again } = setup()

    down(tab)
    wait(END_TURN_HOLD)
    expect(onEnd).toHaveBeenCalledTimes(1)
    // The End Turn on its way: nothing is offered now, and that stops nothing.
    again({ turn: undefined })
    expect(onCancel).not.toHaveBeenCalled()
    wait(1000)
    up(tab)
    expect(click(tab)).toBe(false)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forgets a swallowed click that never came at the next press', () => {
    const { tab, onCancel, onClick } = setup()

    down(tab)
    wait(400)
    up(tab)
    expect(onCancel).toHaveBeenCalledTimes(1)
    // No click came, as Android may send none after a long touch. Then a tap.
    down(tab)
    wait(150)
    up(tab)
    click(tab)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is held from the press to its end, and pressed from the press to the let-go', () => {
    const { tab, again } = setup()

    expect(tab).toHaveAttribute('data-pressed', 'false')
    down(tab)
    expect(tab).toHaveAttribute('data-pressed', 'true')
    expect(tab).toHaveAttribute('data-holding', 'true')
    wait(END_TURN_HOLD)
    expect(tab).toHaveAttribute('data-holding', 'false')
    expect(tab).toHaveAttribute('data-pressed', 'true')
    again({ turn: undefined })
    expect(tab).toHaveAttribute('data-pressed', 'true')
    wait(500)
    up(tab)
    expect(tab).toHaveAttribute('data-pressed', 'false')
  })

  it('takes a let-go off the tab, where the browser didn’t capture the pointer', () => {
    const { tab, onCancel, onEnd } = setup()

    down(tab)
    wait(400)
    up(document.body)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(tab).toHaveAttribute('data-pressed', 'false')
    wait(END_TURN_HOLD)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('calls the latest render’s callbacks, not those of the render the press began in', () => {
    const { tab, onEnd, again } = setup()
    const later = jest.fn()

    down(tab)
    wait(300)
    again({ onEnd: later })
    wait(END_TURN_HOLD - 300)
    expect(later).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })
})
