/* eslint-disable unicorn/no-null -- a note in no chapter, or written in Foundry, has null for it */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteRow } from './note-row'
import type { NoteEntryView, NoteState } from '@/types/notes'

const entry = (fields: Partial<NoteEntryView> = {}): NoteEntryView => ({
  id: 'goblinCaveNote01',
  chapterId: null,
  title: 'The goblin cave',
  html: '<h5>Loot</h5><ul><li>30 gp</li></ul>',
  body: '### Loot\n- 30 gp',
  createdAt: new Date().toISOString(),
  author: { name: 'Thorin' },
  modifiedAt: new Date().toISOString(),
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  state: 'synced',
  canEdit: true,
  canDelete: true,
  stamp: 'n:0000000000000c',
  ...fields,
})

type Props = Parameters<typeof NoteRow>[0]

const renderRow = (
  fields: Partial<NoteEntryView> = {},
  props: Partial<Props> = {},
) => {
  const handlers = {
    onToggle: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onResolve: jest.fn(),
  }
  render(
    <NoteRow
      entry={entry(fields)}
      role='player'
      writable
      tooLarge={false}
      open
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const summary = () => document.querySelector('summary') as HTMLElement

describe('components/notes/note-row', () => {
  it('heads the note with its title as an h4, inside its summary', () => {
    renderRow()
    const title = screen.getByRole('heading', {
      level: 4,
      name: 'The goblin cave',
    })
    expect(summary()).toContainElement(title)
    expect(summary()).toHaveAttribute('data-note-summary', 'goblinCaveNote01')
  })

  it.each([
    ['changed here by its author', {}, /^Changed by Thorin, just now$/],
    [
      'changed here by someone else',
      { modifiedBy: 'Gamemaster', author: { name: 'Vex' } },
      /^Changed by Gamemaster, just now · written by Vex$/,
    ],
    [
      'changed in Foundry, written in Foundry',
      { modifiedIn: 'foundry' as const, author: null },
      /^Changed in Foundry by Thorin, just now · written in Foundry$/,
    ],
    [
      'changed in Foundry, written here by someone else',
      {
        modifiedIn: 'foundry' as const,
        modifiedBy: 'Gamemaster',
        author: { name: 'Thorin' },
      },
      /^Changed in Foundry by Gamemaster, just now · written by Thorin$/,
    ],
  ])('says who changed it last and when, %s', (_, fields, line) => {
    renderRow(fields)
    const meta = within(summary()).getByText(/^Changed/)
    expect(meta.textContent).toMatch(line)
    const time = meta.querySelector('time')
    expect(Date.parse(time?.getAttribute('dateTime') ?? '')).not.toBeNaN()
    expect(time).toHaveAttribute('title')
  })

  it('opens to its text as the book draws it, its own headings two levels down', () => {
    renderRow()
    const body = document.querySelector('.note-text') as HTMLElement
    expect(body).toHaveClass('sheet-text')
    expect(body.parentElement).toHaveClass('overflow-x-auto')
    expect(
      within(body).getByRole('heading', { level: 5, name: 'Loot' }),
    ).toBeInTheDocument()
    expect(within(body).getByText('30 gp')).toBeInTheDocument()
  })

  it('offers Edit and Delete where the seat may change it', async () => {
    const user = userEvent.setup()
    const { onEdit, onDelete } = renderRow()
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit).toHaveAttribute('data-note-opener', 'edit')
    expect(edit).toHaveAttribute('data-note', 'goblinCaveNote01')
    await user.click(edit)
    expect(onEdit).toHaveBeenCalledWith('edit')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['may not change it', { canEdit: false, canDelete: false }, {}, []],
    ['may change, not delete', { canDelete: false }, {}, ['Edit']],
    ['may delete, not change', { canEdit: false }, {}, ['Delete']],
    ['in a book that takes no change', {}, { writable: false }, []],
    ['deleted here already', { state: 'deleting' as const }, {}, ['Edit']],
  ])('offers only what the seat may do: %s', (_, fields, props, offered) => {
    renderRow(fields, props)
    const names = ['Edit', 'Delete'].filter(name =>
      screen.queryByRole('button', { name }),
    )
    expect(names).toEqual(offered)
  })

  it.each([
    ['html' as const, 'Written in Foundry’s own editor: change it there.'],
    ['long' as const, 'Too long to change here: change it in Foundry.'],
    [
      'secret' as const,
      'It holds a Gamemaster’s secret: change it in Foundry.',
    ],
  ])(
    'says why a note is changed only in Foundry, %s, in place of Edit',
    (foundryOnly, words) => {
      renderRow({ foundryOnly, canEdit: true, canDelete: true })
      expect(screen.getByText(words)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    },
  )

  it('says why it’s changed only in Foundry to a seat that may not change it anyway', () => {
    renderRow({ foundryOnly: 'secret', canEdit: false, canDelete: false })
    expect(
      screen.getByText('It holds a Gamemaster’s secret: change it in Foundry.'),
    ).toBeInTheDocument()
  })

  it.each<[NoteState, string]>([
    ['waiting', 'Waiting for the game'],
    ['saving', 'Saving to the game…'],
    ['deleting', 'Deleted here, waiting for the game'],
    ['conflict', 'Changed in Foundry'],
    ['gone', 'Deleted in Foundry'],
    ['failed', 'Not saved to the game'],
  ])('shows where it stands, %s, in its summary', (state, words) => {
    renderRow({
      state,
      mine: { title: 'x', html: '', body: '', chapterId: null },
    })
    expect(summary()).toHaveTextContent(words)
  })

  it('shows no chip where it’s the same here and in Foundry', () => {
    renderRow()
    expect(summary().textContent).toBe(
      `The goblin cave${within(summary()).getByText(/^Changed/).textContent}`,
    )
  })

  it('shows its problem when opened, its Edit only where it may be changed', async () => {
    const user = userEvent.setup()
    const failed = {
      state: 'failed' as const,
      reason: 'full' as const,
      mine: { title: 'x', html: '', body: '', chapterId: null },
    }
    const { onEdit, onResolve } = renderRow(failed)
    const problem = screen.getByRole('group', { name: 'Not saved to the game' })
    await user.click(within(problem).getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith('problem-edit')
    await user.click(within(problem).getByRole('button', { name: 'Try again' }))
    expect(onResolve).toHaveBeenCalledWith('mine')
  })

  it('tells its owner as it’s opened or closed', async () => {
    const user = userEvent.setup()
    const { onToggle } = renderRow({}, { open: false })
    await user.click(summary())
    await waitFor(() => expect(onToggle).toHaveBeenLastCalledWith(true))
  })
})
