/* eslint-disable unicorn/no-null -- a note written in Foundry has no author */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReorderPane } from './reorder-pane'
import type { NoteEntryView, NoteWriteAnswer } from '@/types/notes'

const entry = (
  id: string,
  title: string,
  author: string | null,
): NoteEntryView => ({
  id,
  chapterId: 'chapterSession01',
  title,
  html: `<p>${title}</p>`,
  createdAt: '2026-10-20T10:00:00.000Z',
  author: author === null ? null : { name: author },
  modifiedAt: '2026-10-20T10:00:00.000Z',
  modifiedBy: author ?? 'Gamemaster',
  modifiedIn: author === null ? 'foundry' : 'app',
  state: 'synced',
  canEdit: false,
  canDelete: false,
  stamp: 'n:1',
})

/** A chapter of Vex's, the Gamemaster's and a Foundry-written note, as Thorin reorders it. */
const WOLVES = entry('wolvesEntryVex01', 'Wolves', 'Vex')
const TROLLS = entry('trollsEntryGm001', 'Trolls', 'Gamemaster')
const MAP = entry('mapEntryFoundry1', 'The map', null)
const ENTRIES = [WOLVES, TROLLS, MAP]

type Props = Parameters<typeof ReorderPane>[0]

const renderPane = (fields: Partial<Props> = {}) => {
  const onSave = jest.fn<Promise<NoteWriteAnswer>, [string[]]>(() =>
    Promise.resolve({ ok: true }),
  )
  const onCancel = jest.fn()
  const props: Props = {
    title: 'Session 1',
    entries: ENTRIES,
    kind: 'party',
    name: 'The Iron Company',
    onSave,
    onCancel,
    ...fields,
  }
  const view = render(<ReorderPane {...props} />)
  return { onSave, onCancel, props, ...view }
}

const save = () => screen.getByRole('button', { name: 'Save order' })
const titles = () =>
  screen
    .getAllByRole('listitem')
    .map(item => within(item).getAllByText(/./)[1].textContent)

describe('components/notes/reorder-pane', () => {
  it('is headed by the group’s title, the heading taking focus as it opens', () => {
    renderPane()
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Reorder Session 1',
    })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('title', 'Reorder Session 1')
    expect(heading).toHaveClass('truncate')
  })

  it('says who sees the order, by the book’s kind', () => {
    const { unmount } = renderPane()
    expect(
      screen.getByText(
        'Everyone in The Iron Company sees the notes in this order, here and in Foundry.',
      ),
    ).toBeInTheDocument()
    unmount()
    renderPane({ kind: 'personal', name: 'Thorin' })
    expect(
      screen.getByText('Your notes keep this order here and in Foundry.'),
    ).toBeInTheDocument()
  })

  it('lists each note with its grip, its place, its title and who wrote it, and arrows off at the ends', () => {
    renderPane()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    const grip = within(rows[0]).getByRole('button', {
      name: 'Reorder Wolves: drag it, or press the up and down arrows',
    })
    expect(grip).toHaveAttribute('title', 'Drag to reorder')
    expect(grip).toHaveClass('touch-none', 'cursor-grab', 'size-11')
    expect(rows[0]).toHaveTextContent('1WolvesWritten by Vex')
    expect(rows[1]).toHaveTextContent('2TrollsWritten by Gamemaster')
    expect(rows[2]).toHaveTextContent('3The mapWritten in Foundry')
    expect(
      screen.getByRole('button', { name: 'Move Wolves up' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Wolves down' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Move The map down' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move The map up' }),
    ).toBeEnabled()
  })

  it('keeps only its grips from a finger, so a finger anywhere else on the list scrolls it', () => {
    const { container } = renderPane()
    const grips = screen.getAllByRole('button', {
      name: /^Reorder .*: drag it/,
    })
    // No touch-action on the pane, the list, a row or anything in it but the grips.
    const kept = [...container.querySelectorAll('*')].filter(
      element =>
        [...element.classList].some(name => /(^|:)touch-/.test(name)) ||
        element.getAttribute('style')?.includes('touch-action'),
    )
    expect(kept).toEqual(grips)
    for (const grip of grips) expect(grip).toHaveClass('touch-none')
  })

  it('offers Save order only once the order differs from the one it opened with', async () => {
    const user = userEvent.setup()
    renderPane()
    expect(save()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Move The map up' }))
    expect(titles()).toEqual(['Wolves', 'The map', 'Trolls'])
    expect(save()).toBeEnabled()

    // Put back as it was, there's nothing to save again.
    await user.click(screen.getByRole('button', { name: 'Move The map down' }))
    expect(save()).toBeDisabled()
  })

  it('saves the new order, off with a spinner while it’s on its way', async () => {
    const user = userEvent.setup()
    let answer: ((value: NoteWriteAnswer) => void) | undefined
    const { onSave, onCancel } = renderPane()
    onSave.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = resolve
        }),
    )
    screen
      .getByRole('button', {
        name: 'Reorder The map: drag it, or press the up and down arrows',
      })
      .focus()
    await user.keyboard('{Home}')

    await user.click(save())

    expect(onSave).toHaveBeenCalledWith([
      'mapEntryFoundry1',
      'wolvesEntryVex01',
      'trollsEntryGm001',
    ])
    expect(save()).toBeDisabled()
    expect(save().querySelector('svg')).toHaveClass('motion-safe:animate-spin')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => answer?.({ ok: true }))
    expect(save().querySelector('svg')).toBeNull()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('moves nothing while the order is on its way, so the order saved is the one shown', async () => {
    const user = userEvent.setup()
    let answer: ((value: NoteWriteAnswer) => void) | undefined
    const { onSave } = renderPane()
    onSave.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = resolve
        }),
    )
    const grip = (title: string) =>
      screen.getByRole('button', {
        name: `Reorder ${title}: drag it, or press the up and down arrows`,
      })
    const arrow = (name: string) => screen.getByRole('button', { name })
    await user.click(arrow('Move The map up'))
    await user.click(save())
    const sent = ['wolvesEntryVex01', 'mapEntryFoundry1', 'trollsEntryGm001']
    expect(onSave).toHaveBeenCalledWith(sent)

    // Its grips and arrows off, and a key, an arrow and a drag tried anyway before it answers.
    for (const button of [
      grip('Trolls'),
      arrow('Move Wolves down'),
      arrow('Move The map up'),
      arrow('Move Trolls up'),
    ])
      expect(button).toBeDisabled()
    expect(fireEvent.keyDown(grip('Trolls'), { key: 'Home' })).toBe(true)
    fireEvent.keyDown(grip('Wolves'), { key: 'ArrowDown' })
    fireEvent.click(arrow('Move Wolves down'))
    fireEvent.pointerDown(grip('Trolls'), {
      clientY: 0,
      pointerType: 'touch',
      button: 0,
    })
    expect(grip('Trolls').parentElement).toHaveClass('border-border')
    expect(screen.getByRole('list')).not.toHaveClass('select-none')
    fireEvent.pointerUp(grip('Trolls'), { clientY: 0, pointerType: 'touch' })
    expect(titles()).toEqual(['Wolves', 'The map', 'Trolls'])

    await act(async () => answer?.({ ok: true }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(titles()).toEqual(['Wolves', 'The map', 'Trolls'])
  })

  it('takes moves again once the order is refused, to try again', async () => {
    const user = userEvent.setup()
    const { onSave } = renderPane()
    onSave.mockResolvedValue({ ok: false, reason: 'changed' })
    await user.click(screen.getByRole('button', { name: 'Move The map up' }))
    await user.click(save())
    expect(screen.getByRole('alert')).toBeInTheDocument()

    const grip = screen.getByRole('button', {
      name: 'Reorder Trolls: drag it, or press the up and down arrows',
    })
    expect(grip).toBeEnabled()
    grip.focus()
    await user.keyboard('{Home}')
    expect(titles()).toEqual(['Trolls', 'Wolves', 'The map'])
  })

  it.each([
    [
      'changed',
      'The order changed while you were arranging it. Cancel to see the latest, then try again.',
    ],
    [
      'saving',
      'The last order is still on its way to the game. Try again in a moment.',
    ],
    ['gone', 'That chapter isn’t there any more.'],
    [
      'network',
      'Sending Stone couldn’t be reached. Your order is still here: try again.',
    ],
  ] as const)(
    'says why the order was refused, %s, keeping the pane and the order made',
    async (reason, words) => {
      const user = userEvent.setup()
      const { onSave } = renderPane()
      onSave.mockResolvedValue({ ok: false, reason })
      await user.click(screen.getByRole('button', { name: 'Move Trolls up' }))

      await user.click(save())

      expect(screen.getByRole('alert')).toHaveTextContent(words)
      expect(titles()).toEqual(['Trolls', 'Wolves', 'The map'])
      expect(save()).toBeEnabled()
      // Tried again, the words go until it answers.
      onSave.mockResolvedValue({ ok: true })
      await user.click(save())
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('cancels, saving nothing', async () => {
    const user = userEvent.setup()
    const { onSave, onCancel } = renderPane()
    await user.click(screen.getByRole('button', { name: 'Move Trolls up' }))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows its hint from 640 pixels of the modal, beside Cancel and Save order in the footer', () => {
    renderPane()
    const hint = screen.getByText(
      'Drag a note by its handle, or use the arrows.',
    )
    expect(hint).toHaveClass('hidden', '@min-[640px]:block', 'text-xs')
    const footer = hint.closest('.border-t')!
    expect(
      within(footer as HTMLElement)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Cancel', 'Save order'])
  })

  it('drops a note gone from the view meanwhile, and leaves out one added', async () => {
    const user = userEvent.setup()
    const { onSave, props, rerender } = renderPane()
    await user.click(screen.getByRole('button', { name: 'Move The map up' }))
    const added = entry('caveEntryThorin1', 'The cave', 'Thorin')

    // Trolls deleted in Foundry, and The cave added, as a poll shows.
    expect(() =>
      rerender(<ReorderPane {...props} entries={[WOLVES, MAP, added]} />),
    ).not.toThrow()

    expect(titles()).toEqual(['Wolves', 'The map'])
    expect(screen.queryByText('Trolls')).toBeNull()
    expect(screen.queryByText('The cave')).toBeNull()
    // Still the order it opened with, of the notes left.
    expect(save()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move The map up' }))
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith([
      'mapEntryFoundry1',
      'wolvesEntryVex01',
    ])
  })

  it('marks the row being dragged', () => {
    renderPane()
    const grip = screen.getByRole('button', {
      name: 'Reorder Wolves: drag it, or press the up and down arrows',
    })
    const card = grip.parentElement!
    expect(card).toHaveClass('border-border')
    fireEvent.pointerDown(grip, { clientY: 0, pointerType: 'touch', button: 0 })
    expect(card).toHaveClass('border-primary', 'shadow-lg')
    fireEvent.pointerUp(grip, { clientY: 0, pointerType: 'touch' })
    expect(card).toHaveClass('border-border')
  })
})
