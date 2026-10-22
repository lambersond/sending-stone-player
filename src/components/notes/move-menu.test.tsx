/* eslint-disable unicorn/no-null -- a note in no chapter has null for it */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveMenu } from './move-menu'
import { Modal } from '@/components/modal'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'

const chapter = (id: string, title: string): NoteChapterView => ({
  id,
  title,
  html: '',
  createdAt: '2026-10-20T10:00:00.000Z',
  modifiedAt: '2026-10-20T10:00:00.000Z',
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  state: 'synced',
  canRename: true,
  stamp: 'n:1',
})

/** Oldest first, as the view lists them. */
const CHAPTERS = [
  chapter('chapterSession01', 'Session 1'),
  chapter('chapterSession02', 'Session 2'),
  chapter('chapterSession03', 'Session 3'),
]

const entry = (chapterId: string | null): NoteEntryView => ({
  id: 'wolvesEntryThor1',
  chapterId,
  title: 'Wolves',
  html: '<p>Four of them.</p>',
  body: 'Four of them.',
  createdAt: '2026-10-20T10:00:00.000Z',
  author: { name: 'Thorin' },
  modifiedAt: '2026-10-20T10:00:00.000Z',
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  state: 'synced',
  canEdit: true,
  canDelete: true,
  stamp: 'n:1',
})

type Props = Parameters<typeof MoveMenu>[0]

const renderMenu = (fields: Partial<Props> = {}) => {
  const onMove = jest.fn()
  const props: Props = {
    entry: entry('chapterSession02'),
    chapters: CHAPTERS,
    busy: false,
    onMove,
    ...fields,
  }
  const view = render(
    <>
      <MoveMenu {...props} />
      <button type='button'>Elsewhere</button>
    </>,
  )
  return { onMove, ...view }
}

const iconButton = () =>
  screen.getByRole('button', { name: 'Move Wolves to a chapter' })
const items = () => screen.getAllByRole('menuitemradio')
const item = (name: string) => screen.getByRole('menuitemradio', { name })

/** Opens the menu from its button, and waits for the first choice to take focus. */
const openMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  button = iconButton(),
) => {
  await user.click(button)
  await waitFor(() =>
    expect(
      screen
        .getByRole('menu', { name: 'Move to' })
        .contains(document.activeElement),
    ).toBe(true),
  )
}

describe('components/notes/move-menu', () => {
  it('shows nothing in a book with no chapter', () => {
    const { container } = render(
      <MoveMenu
        entry={entry(null)}
        chapters={[]}
        busy={false}
        onMove={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('is an icon button in the note’s bar, named for the note, that opens a menu', async () => {
    const user = userEvent.setup()
    renderMenu()
    const button = iconButton()
    expect(button).toHaveAttribute('title', 'Move to a chapter')
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveClass('size-11')

    await openMenu(user)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Move to' })
    expect(button).toHaveAttribute('aria-controls', menu.id)
  })

  it('is a labelled button on a card', async () => {
    const user = userEvent.setup()
    renderMenu({ entry: entry(null), labelled: true })
    const button = screen.getByRole('button', { name: 'Move to chapter' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveClass('min-h-11', 'rounded-xl', 'border', 'px-3')
    expect(screen.queryByRole('button', { name: /to a chapter/ })).toBeNull()

    await openMenu(user, button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('lists every chapter oldest first, then No chapter after a rule, its own place checked and off', async () => {
    const user = userEvent.setup()
    renderMenu()
    await openMenu(user)

    const menu = screen.getByRole('menu', { name: 'Move to' })
    expect(
      within(menu).getByText('Move to', { selector: 'p' }),
    ).toHaveAttribute('aria-hidden')
    expect(items().map(choice => choice.textContent)).toEqual([
      'Session 1',
      'Session 2',
      'Session 3',
      'No chapter',
    ])
    expect(item('Session 2')).toHaveAttribute('aria-checked', 'true')
    expect(item('Session 2')).toBeDisabled()
    expect(item('Session 2').querySelector('svg')).not.toBeNull()
    for (const name of ['Session 1', 'Session 3', 'No chapter']) {
      expect(item(name)).toHaveAttribute('aria-checked', 'false')
      expect(item(name)).toBeEnabled()
      expect(item(name).querySelector('svg')).toBeNull()
    }
    // The rule comes just before No chapter.
    const rule = within(menu).getByRole('separator')
    expect(rule.nextElementSibling).toBe(item('No chapter'))
  })

  it('lists no No chapter, and nothing checked, for a note in no chapter', async () => {
    const user = userEvent.setup()
    renderMenu({ entry: entry(null) })
    await openMenu(user)

    expect(items().map(choice => choice.textContent)).toEqual([
      'Session 1',
      'Session 2',
      'Session 3',
    ])
    for (const choice of items()) {
      expect(choice).toHaveAttribute('aria-checked', 'false')
      expect(choice).toBeEnabled()
    }
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('focuses the first choice that can be made as it opens', async () => {
    const user = userEvent.setup()
    renderMenu({ entry: entry('chapterSession01') })
    await openMenu(user)
    expect(item('Session 2')).toHaveFocus()
  })

  it('moves round the choices that can be made by Down and Up, and to the ends by Home and End', async () => {
    const user = userEvent.setup()
    renderMenu()
    await openMenu(user)
    expect(item('Session 1')).toHaveFocus()

    // Its own place, Session 2, is passed over.
    await user.keyboard('{ArrowDown}')
    expect(item('Session 3')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(item('No chapter')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(item('Session 1')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(item('No chapter')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(item('Session 3')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(item('Session 1')).toHaveFocus()
    await user.keyboard('{End}')
    expect(item('No chapter')).toHaveFocus()
  })

  it('focuses the first choice again each time it opens', async () => {
    const user = userEvent.setup()
    renderMenu()
    await openMenu(user)
    await user.keyboard('{End}')
    expect(item('No chapter')).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(iconButton()).toHaveFocus())

    await openMenu(user)

    expect(item('Session 1')).toHaveFocus()
  })

  it('moves the note to the chapter chosen, closing', async () => {
    const user = userEvent.setup()
    const { onMove } = renderMenu()
    await openMenu(user)

    await user.click(item('Session 3'))

    expect(onMove).toHaveBeenCalledWith('chapterSession03')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('moves the note out of its chapter by No chapter, from a key', async () => {
    const user = userEvent.setup()
    const { onMove } = renderMenu()
    await openMenu(user)

    await user.keyboard('{End}{Enter}')

    expect(onMove).toHaveBeenCalledWith(null)
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape inside a dialog, giving focus back to its button, the dialog staying open', async () => {
    const user = userEvent.setup()
    const pressed: KeyboardEvent[] = []
    const keep = (event: KeyboardEvent) => {
      if (event.key === 'Escape') pressed.push(event)
    }
    globalThis.addEventListener('keydown', keep, true)
    const onClose = jest.fn()
    const onMove = jest.fn()
    render(
      <Modal open onClose={onClose} title='My Journal'>
        <MoveMenu
          entry={entry('chapterSession02')}
          chapters={CHAPTERS}
          busy={false}
          onMove={onMove}
        />
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'My Journal' })
    await openMenu(user)
    // It opens inside the dialog, as the page behind it is inert.
    expect(dialog).toContainElement(screen.getByRole('menu'))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(iconButton()).toHaveFocus())
    // The key cancelled, which the browser would otherwise take to close the dialog too.
    expect(pressed.at(-1)?.defaultPrevented).toBe(true)
    expect(dialog).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
    // Closed, Escape is the dialog's again.
    await user.keyboard('{Escape}')
    expect(pressed.at(-1)?.defaultPrevented).toBe(false)
    globalThis.removeEventListener('keydown', keep, true)
  })

  it('closes on a pointer down outside it', async () => {
    const user = userEvent.setup()
    const { onMove } = renderMenu()
    await openMenu(user)

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(screen.queryByRole('menu')).toBeNull()
    expect(onMove).not.toHaveBeenCalled()
  })

  it('closes as Tab leaves it', async () => {
    const user = userEvent.setup()
    const { onMove } = renderMenu()
    await openMenu(user)

    await user.tab()

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(onMove).not.toHaveBeenCalled()
  })

  it('is off with a spinner while the move is on its way', async () => {
    const user = userEvent.setup()
    const { rerender, onMove } = renderMenu({ busy: true })
    const button = iconButton()
    expect(button).toBeDisabled()
    expect(button.querySelector('svg')).toHaveClass('motion-safe:animate-spin')

    await user.click(button)
    expect(screen.queryByRole('menu')).toBeNull()

    rerender(
      <MoveMenu
        entry={entry('chapterSession02')}
        chapters={CHAPTERS}
        busy={false}
        onMove={onMove}
      />,
    )
    expect(iconButton()).toBeEnabled()
    expect(iconButton().querySelector('svg')).not.toHaveClass(
      'motion-safe:animate-spin',
    )
  })

  it('is off with a spinner as a labelled button too', () => {
    renderMenu({ entry: entry(null), labelled: true, busy: true })
    const button = screen.getByRole('button', { name: 'Move to chapter' })
    expect(button).toBeDisabled()
    expect(button.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
  })
})
