import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollMenu, type MenuPoint } from './roll-menu'
import { Modal } from '@/components/modal'

const renderMenu = (point?: MenuPoint) => {
  const onChoose = jest.fn()
  const onClose = jest.fn()
  render(
    <>
      <button type='button'>Perception</button>
      <button type='button'>Elsewhere</button>
    </>,
  )
  const anchor = screen.getByRole('button', { name: 'Perception' })
  // A row 400 by 40 pixels, 100 from the left of a 1024 by 768 window and 200 from its top.
  const rect = jest
    .spyOn(anchor, 'getBoundingClientRect')
    .mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 200, width: 400, height: 40 }),
    )
  render(
    <RollMenu
      anchor={anchor}
      point={point}
      title='Perception check +7'
      onChoose={onChoose}
      onClose={onClose}
    />,
  )
  return { onChoose, onClose, rect }
}

/** Where the menu's top-left corner is, as floating-ui moves it there. */
const menuAt = () => screen.getByRole('menu').style.transform

describe('components/character-sheet/roll-menu', () => {
  beforeAll(() => {
    for (const [side, size] of [
      ['clientWidth', 1024],
      ['clientHeight', 768],
    ] as const)
      Object.defineProperty(document.documentElement, side, {
        configurable: true,
        value: size,
      })
  })
  afterAll(() => {
    for (const side of ['clientWidth', 'clientHeight'])
      Reflect.deleteProperty(document.documentElement, side)
  })

  it('hangs from the pointer, like the browser’s own menu, and stays with it as the sheet scrolls', async () => {
    const { rect } = renderMenu({ x: 380, y: 20, touch: false })

    await waitFor(() => expect(menuAt()).toBe('translate(484px, 224px)'))

    rect.mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 150, width: 400, height: 40 }),
    )
    fireEvent.scroll(globalThis.window)
    await waitFor(() => expect(menuAt()).toBe('translate(484px, 174px)'))
  })

  it('sits above a finger, so the hand doesn’t hide it', async () => {
    renderMenu({ x: 200, y: 20, touch: true })

    await waitFor(() => expect(menuAt()).toBe('translate(300px, 204px)'))
  })

  it('sits below the part of the sheet when opened from a key', async () => {
    renderMenu()

    await waitFor(() => expect(menuAt()).toBe('translate(300px, 246px)'))
  })

  it('offers advantage, disadvantage and modifying the roll', async () => {
    const user = userEvent.setup()
    const { onChoose } = renderMenu()

    const menu = screen.getByRole('menu', { name: 'Perception check +7' })
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['Roll with advantage', 'Roll with disadvantage', 'Modify roll…'])
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      ).toHaveFocus(),
    )
    expect(menu).toBeInTheDocument()

    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
    )
    expect(onChoose).toHaveBeenCalledWith('dis')
  })

  it('moves between its items with the arrow keys', async () => {
    const user = userEvent.setup()
    const { onChoose } = renderMenu()
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      ).toHaveFocus(),
    )

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Modify roll…' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onChoose).toHaveBeenCalledWith('adv')
  })

  it.each([
    [
      'Escape',
      (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    ],
    [
      'a click elsewhere',
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Elsewhere' })),
    ],
  ])('closes on %s', async (_, close) => {
    const user = userEvent.setup()
    const { onChoose, onClose } = renderMenu()

    await close(user)

    expect(onClose).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('closes on Escape inside a modal dialog, cancelling the key, which the browser would otherwise take as a request to close the dialog too', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const pressed: KeyboardEvent[] = []
    const keep = (event: KeyboardEvent) => pressed.push(event)
    globalThis.addEventListener('keydown', keep, true)
    render(<button type='button'>Perception</button>)
    render(
      <Modal open onClose={jest.fn()} title='Bardic Flame'>
        <RollMenu
          anchor={screen.getByRole('button', { name: 'Perception' })}
          title='Perception check +7'
          onChoose={jest.fn()}
          onClose={onClose}
        />
      </Modal>,
    )
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      ).toHaveFocus(),
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
    expect(pressed.at(-1)).toMatchObject({
      key: 'Escape',
      defaultPrevented: true,
    })
    globalThis.removeEventListener('keydown', keep, true)
  })
})
