import { useState, type ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sortable, type SortableHandles } from './sortable'

/** Twenty notes, A to T. */
const TITLES = Object.fromEntries(
  Array.from({ length: 20 }, (_, index) => {
    const letter = String.fromCodePoint(65 + index)
    return [`note${letter}`, `Note ${letter}`]
  }),
)
const ids = (count: number) => Object.keys(TITLES).slice(0, count)

/** A list kept in order by its owner, as Reorder keeps it, with a row like Reorder's. */
function Harness({
  initial,
  onChange,
}: Readonly<{ initial: string[]; onChange: (ids: string[]) => void }>) {
  const [order, setOrder] = useState(initial)
  return (
    <Sortable
      ids={order}
      onChange={next => {
        onChange(next)
        setOrder(next)
      }}
      titleOf={id => TITLES[id]}
      row={(id, index, handles) => (
        <div data-dragging={handles.dragging}>
          <button
            type='button'
            aria-label={`Reorder ${TITLES[id]}`}
            {...handles.grip}
          >
            Grip
          </button>
          <span>{index + 1}</span>
          <button
            type='button'
            aria-label={`Move ${TITLES[id]} up`}
            disabled={handles.first}
            onClick={handles.up}
          >
            Up
          </button>
          <button
            type='button'
            aria-label={`Move ${TITLES[id]} down`}
            disabled={handles.last}
            onClick={handles.down}
          >
            Down
          </button>
        </div>
      )}
    />
  )
}

const renderList = (count = 4, wrap?: (list: ReactNode) => ReactNode) => {
  const onChange = jest.fn()
  const list = <Harness initial={ids(count)} onChange={onChange} />
  render(wrap ? wrap(list) : list)
  return { onChange }
}

const grip = (letter: string) =>
  screen.getByRole('button', { name: `Reorder Note ${letter}` })
const rows = () => screen.getAllByRole('listitem')
const order = () =>
  rows().map(item =>
    within(item).getAllByRole('button')[0].ariaLabel!.slice(-1),
  )
/** What the live region last said. */
const said = () => document.querySelector('[aria-live="polite"]')!.textContent
/** How far a row is drawn from its place, by its style. */
const drawn = (item: HTMLElement) =>
  Number(/translateY\((-?[\d.]+)px\)/.exec(item.style.transform)?.[1] ?? 0)

/**
 * Lays the list out as a browser would: each row 40 pixels tall and 8 apart, from the top of the
 * list, which starts at the top of a pane 300 pixels tall that scrolls it, `scrolled` down.
 */
const layOut = (scrolled: () => number = () => 0) => {
  const rectOf = (element: Element) => {
    if (element.tagName === 'LI') {
      const index = [...element.parentElement!.children].indexOf(element)
      return DOMRect.fromRect({
        y: index * 48 - scrolled(),
        width: 300,
        height: 40,
      })
    }
    if (element.tagName === 'UL') {
      return DOMRect.fromRect({ y: -scrolled(), width: 300, height: 952 })
    }
    return DOMRect.fromRect({ y: 0, width: 300, height: 300 })
  }
  return jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      // eslint-disable-next-line unicorn/no-this-outside-of-class -- the element it's called on
      return rectOf(this)
    })
}

const press = (letter: string, clientY: number, init: PointerEventInit = {}) =>
  fireEvent.pointerDown(grip(letter), {
    clientY,
    pointerType: 'mouse',
    button: 0,
    ...init,
  })
const moveTo = (letter: string, clientY: number) =>
  fireEvent.pointerMove(grip(letter), { clientY, pointerType: 'mouse' })

describe('components/notes/sortable', () => {
  afterEach(() => jest.restoreAllMocks())

  it('is one list, each row an item of it', () => {
    renderList(3)
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(list.tagName).toBe('UL')
  })

  it('moves a row a place by Up and Down on its grip, keeping focus on that grip, and says where it is', async () => {
    const user = userEvent.setup()
    const { onChange } = renderList()
    grip('A').focus()

    await user.keyboard('{ArrowDown}')
    expect(order()).toEqual(['B', 'A', 'C', 'D'])
    expect(onChange).toHaveBeenLastCalledWith([
      'noteB',
      'noteA',
      'noteC',
      'noteD',
    ])
    expect(grip('A')).toHaveFocus()
    expect(said()).toBe('Note A, now 2 of 4.')

    await user.keyboard('{ArrowDown}')
    expect(order()).toEqual(['B', 'C', 'A', 'D'])
    expect(grip('A')).toHaveFocus()
    expect(said()).toBe('Note A, now 3 of 4.')

    await user.keyboard('{ArrowUp}')
    expect(order()).toEqual(['B', 'A', 'C', 'D'])
    expect(grip('A')).toHaveFocus()
    expect(said()).toBe('Note A, now 2 of 4.')
  })

  it('keeps the keys from scrolling the pane, and leaves others alone', () => {
    renderList()
    expect(fireEvent.keyDown(grip('B'), { key: 'ArrowDown' })).toBe(false)
    expect(fireEvent.keyDown(grip('B'), { key: 'Tab' })).toBe(true)
    // With a modifier, it's the browser's or a screen reader's.
    expect(
      fireEvent.keyDown(grip('B'), { key: 'ArrowDown', altKey: true }),
    ).toBe(true)
  })

  it('moves a row first by Home and last by End, and says where it is', async () => {
    const user = userEvent.setup()
    renderList(5)
    grip('C').focus()

    await user.keyboard('{End}')
    expect(order()).toEqual(['A', 'B', 'D', 'E', 'C'])
    expect(grip('C')).toHaveFocus()
    expect(said()).toBe('Note C, now 5 of 5.')

    await user.keyboard('{Home}')
    expect(order()).toEqual(['C', 'A', 'B', 'D', 'E'])
    expect(grip('C')).toHaveFocus()
    expect(said()).toBe('Note C, now 1 of 5.')
  })

  it('moves nothing past either end', async () => {
    const user = userEvent.setup()
    const { onChange } = renderList(3)
    grip('A').focus()
    await user.keyboard('{ArrowUp}{Home}')
    grip('C').focus()
    await user.keyboard('{ArrowDown}{End}')

    expect(onChange).not.toHaveBeenCalled()
    expect(said()).toBe('')
    expect(
      screen.getByRole('button', { name: 'Move Note A up' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Note C down' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Note A down' }),
    ).toBeEnabled()
  })

  it('moves a row a place by its arrows, focusing its grip, and says where it is', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getByRole('button', { name: 'Move Note C up' }))
    expect(order()).toEqual(['A', 'C', 'B', 'D'])
    expect(grip('C')).toHaveFocus()
    expect(said()).toBe('Note C, now 2 of 4.')

    await user.click(screen.getByRole('button', { name: 'Move Note A down' }))
    expect(order()).toEqual(['C', 'A', 'B', 'D'])
    expect(grip('A')).toHaveFocus()
    expect(said()).toBe('Note A, now 2 of 4.')
  })

  it('drags a row by its grip, the others easing aside, and drops it where it’s let go', () => {
    layOut()
    const { onChange } = renderList()

    press('A', 20)
    expect(rows()[0].firstElementChild).toHaveAttribute('data-dragging', 'true')
    expect(rows()[1].firstElementChild).toHaveAttribute(
      'data-dragging',
      'false',
    )
    // Past B's middle (68) and C's (116), not D's (164).
    moveTo('A', 130)

    expect(rows()[0]).toHaveStyle({
      transform: 'translateY(110px)',
      zIndex: '10',
    })
    expect(rows()[1]).toHaveStyle({ transform: 'translateY(-48px)' })
    expect(rows()[2]).toHaveStyle({ transform: 'translateY(-48px)' })
    expect(rows()[3].style.transform).toBe('')
    expect(rows()[1].style.transition).toBe('transform 160ms ease')
    // The dragged one keeps to the pointer.
    expect(rows()[0].style.transition).toBe('')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })

    expect(onChange).toHaveBeenCalledWith(['noteB', 'noteC', 'noteA', 'noteD'])
    expect(order()).toEqual(['B', 'C', 'A', 'D'])
    for (const item of rows()) expect(item.style.transform).toBe('')
    expect(grip('A')).toHaveFocus()
    expect(said()).toBe('Note A, now 3 of 4.')
  })

  it('drags a row up, the rows it passes moving down', () => {
    layOut()
    const { onChange } = renderList()

    press('D', 164)
    // Above C's middle (116) and B's (68), not A's (20).
    moveTo('D', 60)
    expect(rows()[1]).toHaveStyle({ transform: 'translateY(48px)' })
    expect(rows()[2]).toHaveStyle({ transform: 'translateY(48px)' })
    expect(rows()[0].style.transform).toBe('')
    fireEvent.pointerUp(grip('D'), { clientY: 60, pointerType: 'mouse' })

    expect(onChange).toHaveBeenCalledWith(['noteA', 'noteD', 'noteB', 'noteC'])
  })

  it('drops nothing where a row is let go where it was', () => {
    layOut()
    const { onChange } = renderList()
    press('B', 68)
    moveTo('B', 80)
    fireEvent.pointerUp(grip('B'), { clientY: 80, pointerType: 'mouse' })
    expect(onChange).not.toHaveBeenCalled()
    expect(said()).toBe('')
  })

  it('takes no text selection while dragging', () => {
    layOut()
    renderList()
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    press('A', 20)
    expect(screen.getByRole('list')).toHaveClass('select-none')
    fireEvent.pointerUp(grip('A'), { clientY: 20, pointerType: 'mouse' })
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
  })

  it('leaves a mouse’s other buttons alone', () => {
    layOut()
    const { onChange } = renderList()
    press('A', 20, { button: 2 })
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    moveTo('A', 130)
    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('drags by a finger too', () => {
    layOut()
    const { onChange } = renderList()
    fireEvent.pointerDown(grip('A'), {
      clientY: 20,
      pointerType: 'touch',
      button: 0,
    })
    fireEvent.pointerMove(grip('A'), { clientY: 80, pointerType: 'touch' })
    fireEvent.pointerUp(grip('A'), { clientY: 80, pointerType: 'touch' })
    expect(onChange).toHaveBeenCalledWith(['noteB', 'noteA', 'noteC', 'noteD'])
  })

  it('drops it where it is when the browser cancels the drag', () => {
    layOut()
    const { onChange } = renderList()
    press('A', 20)
    moveTo('A', 80)

    fireEvent.pointerCancel(grip('A'), { pointerType: 'mouse' })

    expect(onChange).toHaveBeenCalledWith(['noteB', 'noteA', 'noteC', 'noteD'])
    expect(said()).toBe('Note A, now 2 of 4.')
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
  })

  it('puts the row back on Escape mid-drag, keeping the key from the dialog it’s in', () => {
    layOut()
    const { onChange } = renderList()
    press('A', 20)
    moveTo('A', 130)

    // Cancelled: the browser takes no request to close the dialog from it.
    expect(fireEvent.keyDown(grip('A'), { key: 'Escape' })).toBe(false)

    for (const item of rows()) expect(item.style.transform).toBe('')
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })
    expect(onChange).not.toHaveBeenCalled()
    expect(order()).toEqual(['A', 'B', 'C', 'D'])
    // Not dragging, Escape is the dialog's again.
    expect(fireEvent.keyDown(grip('A'), { key: 'Escape' })).toBe(true)
  })

  it('eases nothing aside where the reader asks for less motion', () => {
    jest.spyOn(globalThis, 'matchMedia').mockImplementation(
      query =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    layOut()
    renderList()
    press('A', 20)
    moveTo('A', 130)

    // Still moved aside, at once.
    expect(rows()[1]).toHaveStyle({ transform: 'translateY(-48px)' })
    for (const item of rows()) expect(item.style.transition).toBe('')
  })

  it('stops dragging a row whose list changed under it, putting it back', () => {
    layOut()
    const onChange = jest.fn()
    const row = (id: string, _index: number, handles: SortableHandles) => (
      <button
        type='button'
        aria-label={`Reorder ${TITLES[id]}`}
        {...handles.grip}
      />
    )
    const { rerender } = render(
      <Sortable
        ids={ids(4)}
        onChange={onChange}
        titleOf={id => TITLES[id]}
        row={row}
      />,
    )
    press('A', 20)
    moveTo('A', 130)
    expect(screen.getByRole('list')).toHaveClass('select-none')

    // Note D deleted meanwhile, as a poll shows.
    rerender(
      <Sortable
        ids={ids(3)}
        onChange={onChange}
        titleOf={id => TITLES[id]}
        row={row}
      />,
    )

    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    for (const item of rows()) expect(item.style.transform).toBe('')
    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves nothing while it’s off, putting back a drag in progress as it goes off', () => {
    layOut()
    const onChange = jest.fn()
    const row = (id: string, _index: number, handles: SortableHandles) => (
      <>
        <button
          type='button'
          aria-label={`Reorder ${TITLES[id]}`}
          {...handles.grip}
        />
        <button
          type='button'
          aria-label={`Move ${TITLES[id]} down`}
          onClick={handles.down}
        />
      </>
    )
    const list = (disabled: boolean) => (
      <Sortable
        ids={ids(4)}
        onChange={onChange}
        titleOf={id => TITLES[id]}
        row={row}
        disabled={disabled}
      />
    )
    const { rerender } = render(list(false))
    press('A', 20)
    moveTo('A', 130)
    expect(screen.getByRole('list')).toHaveClass('select-none')

    // Turned off mid-drag, as when a second finger presses Save order.
    rerender(list(true))
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    for (const item of rows()) expect(item.style.transform).toBe('')
    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })

    // Its keys left to the browser; a row's button and a drag do nothing.
    expect(fireEvent.keyDown(grip('B'), { key: 'ArrowDown' })).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Move Note C down' }))
    press('A', 20)
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    moveTo('A', 130)
    fireEvent.pointerUp(grip('A'), { clientY: 130, pointerType: 'mouse' })
    expect(onChange).not.toHaveBeenCalled()
    expect(said()).toBe('')
  })

  describe('a long list', () => {
    /** Frames asked for, run one at a time, the list drawn after each as a browser draws it. */
    let frames: FrameRequestCallback[]
    let scrolled: number
    const runFrames = (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        act(() => {
          const due = frames.splice(0)
          for (const callback of due) callback(0)
        })
      }
    }

    beforeEach(() => {
      frames = []
      scrolled = 0
      jest
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation(callback => frames.push(callback))
      jest
        .spyOn(globalThis, 'cancelAnimationFrame')
        .mockImplementation(() => {})
    })

    /**
     * Notes in a pane 300 pixels tall that scrolls them: twenty scroll 652 pixels, three none. As
     * a browser counts it, what the pane scrolls reaches the list's end, or as far as a row is
     * drawn past it.
     */
    const renderLong = (count = 20) => {
      layOut(() => scrolled)
      const view = renderList(count, list => (
        <div data-testid='pane' style={{ overflowY: 'auto' }}>
          {list}
        </div>
      ))
      const pane = screen.getByTestId('pane')
      Object.defineProperties(pane, {
        scrollTop: {
          configurable: true,
          get: () => scrolled,
          set: (value: number) => {
            scrolled = value
          },
        },
        scrollHeight: {
          configurable: true,
          get: () =>
            Math.max(
              300,
              ...rows().map((item, index) => index * 48 + 40 + drawn(item)),
            ),
        },
        clientHeight: { configurable: true, value: 300 },
      })
      return view
    }

    it('scrolls the pane while a row is held near its bottom, and drops it at the place under the pointer after the scroll', () => {
      const { onChange } = renderLong()
      press('B', 68)
      // 20 pixels from the pane's bottom: past F's middle (260), not G's (308).
      moveTo('B', 280)
      expect(rows()[1]).toHaveStyle({ transform: 'translateY(212px)' })

      runFrames(10)

      // Faster nearer the edge: 7 pixels a frame, 20 pixels from it.
      expect(scrolled).toBe(70)
      // The row went down with the list as it scrolled under the pointer: past G's middle now.
      expect(rows()[1]).toHaveStyle({ transform: 'translateY(282px)' })
      fireEvent.pointerUp(grip('B'), { clientY: 280, pointerType: 'mouse' })

      expect(onChange).toHaveBeenCalledWith(moveIn(ids(20), 1, 6))
      expect(said()).toBe('Note B, now 7 of 20.')
    })

    it('scrolls faster at the very edge, and stops at the pane’s end, the row drawn no further than the list’s', () => {
      renderLong()
      press('B', 68)
      moveTo('B', 299)
      runFrames(1)
      expect(scrolled).toBe(12)

      runFrames(100)
      // The end the pane had as the drag began: the row held there doesn't make it any taller.
      expect(scrolled).toBe(652)
      expect(frames).toHaveLength(0)
      // Drawn down to where the last row ends (88 + 864 = 952), not to the pointer (88 + 883).
      expect(rows()[1]).toHaveStyle({ transform: 'translateY(864px)' })
      // Past the last row's middle, the row would drop last.
      fireEvent.pointerUp(grip('B'), { clientY: 299, pointerType: 'mouse' })
      expect(order().at(-1)).toBe('B')
    })

    it('scrolls a list that fits not at all, a row held past either end drawn at that end and dropped there', () => {
      const { onChange } = renderLong(3)
      press('A', 20)
      // 10 pixels from the pane's bottom, far below the list's end (136).
      moveTo('A', 290)
      runFrames(20)
      expect(scrolled).toBe(0)
      expect(frames).toHaveLength(0)
      expect(rows()[0]).toHaveStyle({ transform: 'translateY(96px)' })
      // A pixel's move, as a hand held still makes: still nothing.
      moveTo('A', 291)
      runFrames(20)
      expect(scrolled).toBe(0)
      fireEvent.pointerUp(grip('A'), { clientY: 291, pointerType: 'mouse' })
      expect(onChange).toHaveBeenLastCalledWith(['noteB', 'noteC', 'noteA'])

      // And above the list's top: drawn at its top, and dropped first.
      press('A', 2 * 48 + 20)
      moveTo('A', 5)
      runFrames(20)
      expect(scrolled).toBe(0)
      expect(rows()[2]).toHaveStyle({ transform: 'translateY(-96px)' })
      fireEvent.pointerUp(grip('A'), { clientY: 5, pointerType: 'mouse' })
      expect(order()).toEqual(['A', 'B', 'C'])
    })

    it('scrolls up while a row is held near the pane’s top', () => {
      renderLong()
      scrolled = 200
      press('H', 7 * 48 + 20 - 200)
      moveTo('H', 10)
      runFrames(3)
      // 10 pixels from the top: 10 pixels a frame.
      expect(scrolled).toBe(170)
    })

    it('follows a scroll of the pane made otherwise, as by a wheel', () => {
      renderLong()
      press('B', 68)
      moveTo('B', 150)
      expect(rows()[1]).toHaveStyle({ transform: 'translateY(82px)' })
      scrolled = 100
      fireEvent.scroll(screen.getByTestId('pane'))
      expect(rows()[1]).toHaveStyle({ transform: 'translateY(182px)' })
      expect(frames).toHaveLength(0)
    })
  })
})

/** The list with one of its items moved. */
function moveIn(list: string[], from: number, to: number) {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}
