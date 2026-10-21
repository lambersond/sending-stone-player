/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteList } from './note-list'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'

const now = Date.now()
const minutes = (n: number) => new Date(now - n * 60_000).toISOString()

const chapter = (fields: Partial<NoteChapterView> = {}): NoteChapterView => ({
  id: 'sessionChapter01',
  title: 'Session 1',
  html: '',
  createdAt: minutes(50),
  modifiedAt: minutes(50),
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  state: 'synced',
  canRename: true,
  stamp: 'n:0000000000000b',
  ...fields,
})

const entry = (fields: Partial<NoteEntryView> = {}): NoteEntryView => ({
  id: 'goblinCaveNote01',
  chapterId: 'sessionChapter01',
  title: 'The goblin cave',
  html: '<p>30 gp</p>',
  body: '30 gp',
  createdAt: minutes(40),
  author: { name: 'Thorin' },
  modifiedAt: minutes(40),
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  state: 'synced',
  canEdit: true,
  canDelete: true,
  stamp: 'n:0000000000000c',
  ...fields,
})

type Props = Parameters<typeof NoteList>[0]

const renderList = (props: Partial<Props> = {}) => {
  const handlers = {
    onToggle: jest.fn(),
    onNewIn: jest.fn(),
    onRename: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onResolve: jest.fn(),
  }
  render(
    <NoteList
      chapters={[chapter()]}
      entries={[entry()]}
      chaptered
      role='player'
      writable
      tooLarge={false}
      isOpen={() => true}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

/** Every heading, in the order a screen reader lists them, with its level. */
const outline = () =>
  screen
    .getAllByRole('heading')
    .map(heading => `${heading.tagName} ${heading.textContent}`)

describe('components/notes/note-list', () => {
  it('lists the notes in no chapter first, then each chapter and its notes, oldest first', () => {
    renderList({
      // Given out of order: the list orders them itself.
      chapters: [
        chapter({
          id: 'secondChapter001',
          title: 'Session 2',
          createdAt: minutes(10),
        }),
        chapter(),
      ],
      entries: [
        entry({
          id: 'trollsEntry00001',
          title: 'Trolls',
          chapterId: 'secondChapter001',
          createdAt: minutes(5),
        }),
        entry({
          id: 'wolvesEntry00001',
          title: 'Wolves',
          createdAt: minutes(30),
        }),
        entry(),
        entry({
          id: 'looseEntry000001',
          title: 'A rumour',
          chapterId: null,
          createdAt: minutes(1),
        }),
        entry({
          id: 'looseEntry000000',
          title: 'The map',
          chapterId: null,
          createdAt: minutes(60),
        }),
      ],
    })

    expect(outline()).toEqual([
      'H3 Not in a chapter',
      'H4 The map',
      'H4 A rumour',
      'H3 Session 1 · 2 notes',
      'H4 The goblin cave',
      'H4 Wolves',
      'H3 Session 2 · 1 note',
      'H4 Trolls',
    ])
    expect(
      screen.getByRole('heading', { name: 'Not in a chapter' }),
    ).toHaveClass('sr-only')
  })

  it('names each chapter’s region by its title alone, its count read as notes', () => {
    renderList()
    const region = screen.getByRole('region', { name: 'Session 1' })
    expect(
      within(region).getByRole('heading', {
        level: 3,
        name: 'Session 1 · 1 note',
      }),
    ).toHaveAttribute('tabindex', '-1')
    expect(within(region).getByText('The goblin cave')).toBeInTheDocument()
  })

  it('heads the notes in no chapter only where the book has chapters', () => {
    renderList({
      chapters: [],
      chaptered: false,
      entries: [entry({ chapterId: null })],
    })
    expect(
      screen.queryByRole('heading', { name: 'Not in a chapter' }),
    ).toBeNull()
  })

  it.each([
    ['as it was added', {}, /^Added by Thorin, 50 minutes ago$/],
    [
      'once it was renamed',
      { modifiedAt: minutes(5), modifiedBy: 'Vex' },
      /^Renamed by Vex, 5 minutes ago$/,
    ],
    [
      'once it was changed in Foundry',
      {
        modifiedAt: minutes(5),
        modifiedBy: 'Gamemaster',
        modifiedIn: 'foundry' as const,
      },
      /^Changed in Foundry by Gamemaster, 5 minutes ago$/,
    ],
  ])('says under a chapter who added or renamed it, %s', (_, fields, line) => {
    renderList({ chapters: [chapter(fields)] })
    const region = screen.getByRole('region', { name: 'Session 1' })
    expect(
      within(region).getByText(/^(Added|Renamed|Changed in Foundry) by/)
        .textContent,
    ).toMatch(line)
  })

  it('offers a new note in each chapter, and its rename, where the seat may', async () => {
    const user = userEvent.setup()
    const { onNewIn, onRename } = renderList()
    const region = screen.getByRole('region', { name: 'Session 1' })

    const add = within(region).getByRole('button', {
      name: 'New note in Session 1',
    })
    expect(add).toHaveAttribute('data-note-opener', 'new-in')
    expect(add).toHaveAttribute('data-chapter', 'sessionChapter01')
    await user.click(add)
    expect(onNewIn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sessionChapter01' }),
    )

    const rename = within(region).getByRole('button', {
      name: 'Rename Session 1',
    })
    expect(rename).toHaveAttribute('data-note-opener', 'rename')
    await user.click(rename)
    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sessionChapter01' }),
      'rename',
    )
  })

  it('offers no rename where the seat may not, nor anything where the book takes no change', () => {
    renderList({ chapters: [chapter({ canRename: false })] })
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'New note in Session 1' }),
    ).toBeInTheDocument()
  })

  it('offers no rename nor new note in a book that takes no change', () => {
    renderList({ writable: false })
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^New note/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('never offers to delete a chapter', () => {
    renderList({
      chapters: [
        chapter(),
        chapter({
          id: 'emptyChapter0001',
          title: 'Empty',
          createdAt: minutes(45),
        }),
      ],
    })
    for (const name of ['Session 1', 'Empty']) {
      const region = screen.getByRole('region', { name })
      const own = within(region)
        .queryAllByRole('button', { name: /Delete/ })
        .filter(button => !button.closest('details'))
      expect(own).toEqual([])
    }
    // Only the chapter's note has one.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
  })

  it('shows where a chapter stands, and what became of a rename the game didn’t take', async () => {
    const user = userEvent.setup()
    const { onResolve, onRename } = renderList({
      chapters: [
        chapter({
          state: 'failed',
          reason: 'not-member',
          mine: { title: 'Session One' },
        }),
      ],
    })
    const region = screen.getByRole('region', { name: 'Session 1' })
    expect(region).toHaveTextContent('Not saved to the game')
    const problem = within(region).getByRole('group', {
      name: 'Not saved to the game',
    })
    await user.click(within(problem).getByRole('button', { name: 'Edit' }))
    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sessionChapter01' }),
      'problem-edit',
    )
    await user.click(
      within(problem).getByRole('button', { name: 'Discard yours' }),
    )
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sessionChapter01' }),
      'theirs',
    )
  })

  it('shows a chapter’s own text from Foundry', () => {
    renderList({
      chapters: [chapter({ html: '<p>Written under it in Foundry.</p>' })],
    })
    const text = screen
      .getByText('Written under it in Foundry.')
      .closest('.note-text')
    expect(text).toHaveClass('sheet-text')
  })
})
