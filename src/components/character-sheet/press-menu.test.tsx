import { act, fireEvent, render, screen } from '@testing-library/react'
import { usePressMenu } from './press-menu'
import { LONG_PRESS } from './roll-button'
import { SheetEntry } from './sheet-entry'
import { Charging, UsesButton } from './uses-button'
import { counted } from '@/mocks/sending-stone'
import type { MenuPoint } from './roll-menu'

type OnMenu = (anchor: HTMLElement, point?: MenuPoint) => void

/** An item's row that opens when clicked, with a Take of its own inside it, as a party's has. */
function Row({
  onMenu,
  onTake,
}: Readonly<{ onMenu?: OnMenu; onTake: () => void }>) {
  const press = usePressMenu(onMenu)
  return (
    <details>
      <summary className={press.className} {...press.props}>
        Rope
        <button
          type='button'
          onClick={event => {
            event.preventDefault()
            onTake()
          }}
        >
          Take
        </button>
      </summary>
      <p>Fifty feet of hempen rope.</p>
    </details>
  )
}

const renderRow = (menu = true) => {
  const onMenu = jest.fn<void, Parameters<OnMenu>>()
  const onTake = jest.fn()
  const { container } = render(
    <Row onMenu={menu ? onMenu : undefined} onTake={onTake} />,
  )
  const row = container.querySelector('summary') as HTMLElement
  // A row 300 by 40 pixels, 100 from the left of the window and 50 from its top.
  jest
    .spyOn(row, 'getBoundingClientRect')
    .mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 50, width: 300, height: 40 }),
    )
  const details = container.querySelector('details') as HTMLDetailsElement
  return { row, details, onMenu, onTake }
}

const touch = { pointerType: 'touch', clientX: 110, clientY: 60 }

describe('components/character-sheet/press-menu', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('opens the menu on a right-click, at the pointer, instead of the browser’s', () => {
    const { row, details, onMenu } = renderRow()

    expect(
      fireEvent.contextMenu(row, { button: 2, clientX: 390, clientY: 70 }),
    ).toBe(false)
    expect(onMenu).toHaveBeenCalledWith(row, { x: 290, y: 20, touch: false })
    // No click follows a right-click, so the next opens the row.
    fireEvent.pointerDown(row, { pointerType: 'mouse' })
    fireEvent.click(row)
    expect(details.open).toBe(true)
  })

  it('opens it on a long-press of 500 ms, and the click that ends it doesn’t open the row', () => {
    const { row, details, onMenu } = renderRow()

    fireEvent.pointerDown(row, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS - 1))
    expect(onMenu).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(onMenu).toHaveBeenCalledWith(row, { x: 10, y: 10, touch: true })

    fireEvent.pointerUp(row, touch)
    fireEvent.click(row)
    expect(details.open).toBe(false)
    // Only that click: the next tap opens the row.
    fireEvent.pointerDown(row, touch)
    fireEvent.pointerUp(row, touch)
    fireEvent.click(row)
    expect(details.open).toBe(true)
  })

  it('opens nothing on a press of 499 ms, nor on one that drifts 11 px, nor on a mouse held down', () => {
    const { row, details, onMenu } = renderRow()

    fireEvent.pointerDown(row, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS - 1))
    fireEvent.pointerUp(row, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS))

    fireEvent.pointerDown(row, touch)
    fireEvent.pointerMove(row, { ...touch, clientX: 121 })
    act(() => jest.advanceTimersByTime(LONG_PRESS))

    fireEvent.pointerDown(row, { pointerType: 'mouse' })
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    expect(onMenu).not.toHaveBeenCalled()
    fireEvent.click(row)
    expect(details.open).toBe(true)
  })

  it('keeps to a press that drifts 10 px', () => {
    const { row, onMenu } = renderRow()

    fireEvent.pointerDown(row, touch)
    fireEvent.pointerMove(row, { ...touch, clientX: 120 })
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    expect(onMenu).toHaveBeenCalledTimes(1)
  })

  it('opens it below the row for the context menu key, and then lets Enter open the row', () => {
    const { row, details, onMenu } = renderRow()

    row.focus()
    fireEvent(
      row,
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: -1,
      }),
    )
    expect(onMenu).toHaveBeenCalledWith(row, undefined)
    fireEvent(
      row,
      new PointerEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        pointerType: '',
      }),
    )
    expect(onMenu).toHaveBeenLastCalledWith(row, undefined)

    // After Escape, Enter on the row clicks it, as a key sends no pointer down: nothing is
    // swallowed.
    fireEvent.click(row)
    expect(details.open).toBe(true)
  })

  it('swallows the click after a touch screen’s own long-press menu', () => {
    const { row, details, onMenu } = renderRow()

    fireEvent(
      row,
      new PointerEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        clientX: 200,
        clientY: 80,
      }),
    )
    expect(onMenu).toHaveBeenCalledWith(row, { x: 100, y: 30, touch: true })
    fireEvent.click(row)
    expect(details.open).toBe(false)
  })

  it('leaves a press on a control inside the row to it: no menu, and the browser’s own', () => {
    const { row, onMenu, onTake } = renderRow()
    const take = screen.getByRole('button', { name: 'Take' })

    expect(fireEvent.contextMenu(take, { button: 2 })).toBe(true)
    expect(fireEvent.contextMenu(take, { button: -1 })).toBe(true)
    // A slow tap, of 600 ms, on Take: Take, never the row's menu.
    fireEvent.pointerDown(take, touch)
    act(() => jest.advanceTimersByTime(600))
    fireEvent.pointerUp(take, touch)
    fireEvent.click(take)
    expect(onMenu).not.toHaveBeenCalled()
    expect(onTake).toHaveBeenCalledTimes(1)
    expect(row).toBeInTheDocument()
  })

  it('does nothing without a menu, leaving the browser’s own', () => {
    const { row, details, onMenu } = renderRow(false)

    expect(row).not.toHaveClass('select-none')
    expect(fireEvent.contextMenu(row, { button: 2 })).toBe(true)
    fireEvent.pointerDown(row, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    fireEvent.click(row)
    expect(onMenu).not.toHaveBeenCalled()
    expect(details.open).toBe(true)
  })

  it('keeps a held touch from selecting text or calling out, with a menu', () => {
    const { row } = renderRow()

    expect(row).toHaveClass(
      'touch-manipulation',
      'select-none',
      '[-webkit-touch-callout:none]',
    )
  })

  it('leaves a press on a row’s uses button to it, on a sheet’s own row', () => {
    const onMenu = jest.fn()
    render(
      <Charging actions={{ spend: jest.fn() }}>
        <ul>
          <SheetEntry
            characterId='char-1'
            name='Cloak of Protection'
            fallback={() => null}
            aside={
              <UsesButton
                uses={counted(2, 3, { item: 'cloak' })}
                name='Cloak of Protection'
              />
            }
            meta='Uncommon'
            onMenu={onMenu}
          />
        </ul>
      </Charging>,
    )
    const uses = screen.getByRole('button', {
      name: 'Spend Cloak of Protection: 2 of 3 left',
    })

    expect(fireEvent.contextMenu(uses, { button: 2 })).toBe(true)
    fireEvent.pointerDown(uses, touch)
    act(() => jest.advanceTimersByTime(600))
    expect(onMenu).not.toHaveBeenCalled()
    // The row itself still opens it.
    fireEvent.contextMenu(uses.closest('summary') as HTMLElement, { button: 2 })
    expect(onMenu).toHaveBeenCalledTimes(1)
  })
})
