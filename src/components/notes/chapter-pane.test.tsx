/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChapterPane } from './chapter-pane'
import { groupsOf } from './contents'
import { emptyBook, noteChapter, noteEntry } from '@/mocks/notes-server'
import type { NoteEntryView, NotesView } from '@/types/notes'

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/** Two chapters, the first with two notes; two notes in none. */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    chapters: [
      noteChapter(),
      noteChapter({ id: 'secondChapter001', title: 'Session 2' }),
    ],
    entries: [
      noteEntry({ id: 'rumourNote000001', title: 'A rumour' }),
      noteEntry({ id: 'trollsNote000001', title: 'Trolls' }),
      noteEntry({
        id: 'wolvesNote000001',
        title: 'Wolves',
        chapterId: 'sessionChapter01',
      }),
      noteEntry({ chapterId: 'sessionChapter01' }),
    ],
    ...fields,
  })

type Props = Parameters<typeof ChapterPane>[0]

/** The page of a group, by its chapter, null for the notes in none. */
const renderPage = (
  chapterId: string | null,
  view: NotesView = book(),
  props: Partial<Props> = {},
) => {
  const group = groupsOf(view).find(found => found.chapterId === chapterId)!
  const handlers = {
    onPick: jest.fn(),
    onRename: jest.fn(),
    onNewIn: jest.fn(),
    onReorder: jest.fn(),
    onResolve: jest.fn(),
    onResolveOrder: jest.fn(),
    onMove: jest.fn(),
  }
  render(
    <ChapterPane
      group={group}
      query=''
      shown={group.entries}
      chapters={view.chapters}
      role='player'
      canAdd={view.canAdd}
      canReorder={view.canReorder}
      drafting={false}
      tooLarge={false}
      contents={<button type='button'>Contents</button>}
      busy={false}
      orderBusy={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

/** The page's own article, not a card's. */
const article = () =>
  document.querySelector('article[aria-labelledby]') as HTMLElement
const cards = () =>
  within(article())
    .queryAllByRole('heading', { level: 4 })
    .map(heading => heading.textContent)

describe('components/notes/chapter-pane', () => {
  it('heads a chapter’s page with its place among the chapters and its title, an h3 that takes focus', () => {
    renderPage('secondChapter001')
    expect(within(article()).getByText('Chapter 2 of 2')).toHaveClass(
      'uppercase',
    )
    const title = screen.getByRole('heading', { level: 3, name: 'Session 2' })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('article', { name: 'Session 2' })).toBe(article())
  })

  it('heads the notes in no chapter so', () => {
    renderPage(null)
    expect(within(article()).getByText('Notes')).toHaveClass('uppercase')
    expect(
      screen.getByRole('heading', { level: 3, name: 'Not in a chapter' }),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'added',
      { createdAt: ago(0), modifiedAt: ago(0) },
      'Added by Thorin, just now',
    ],
    [
      'renamed',
      { createdAt: ago(60), modifiedAt: ago(0) },
      'Renamed by Thorin, just now',
    ],
    [
      'changed in Foundry',
      {
        modifiedAt: ago(0),
        modifiedBy: 'Gamemaster',
        modifiedIn: 'foundry' as const,
      },
      'Changed in Foundry by Gamemaster, just now',
    ],
  ])('says who %s a chapter, and when', (_, fields, words) => {
    renderPage('sessionChapter01', book({ chapters: [noteChapter(fields)] }))
    const line = screen.getByRole('heading', { level: 3 }).nextElementSibling
    expect(line).toHaveTextContent(`${words}2 notes`)
  })

  it('counts its notes, all of them while searching too', () => {
    renderPage('sessionChapter01', book(), {
      query: 'wolves',
      shown: groupsOf(book())[1].entries.slice(0, 1),
    })
    expect(within(article()).getByText('2 notes')).toBeInTheDocument()
    expect(cards()).toEqual(['Wolves'])
  })

  it('counts one note as one', () => {
    renderPage(
      'sessionChapter01',
      book({ entries: [noteEntry({ chapterId: 'sessionChapter01' })] }),
    )
    expect(within(article()).getByText('1 note')).toBeInTheDocument()
  })

  it('lists its notes as cards, in its order', () => {
    renderPage('sessionChapter01')
    expect(cards()).toEqual(['Wolves', 'The goblin cave'])
  })

  it('opens a note from its card', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPage('sessionChapter01')
    await user.click(screen.getByRole('button', { name: 'Wolves' }))
    expect(onPick).toHaveBeenCalledWith({ note: 'wolvesNote000001' })
  })

  it('says a chapter with no notes has none yet', () => {
    renderPage('secondChapter001')
    expect(
      screen.getByText('No notes in this chapter yet.'),
    ).toBeInTheDocument()
  })

  it('says none of its notes match a search, rather than that it has none', () => {
    renderPage('sessionChapter01', book(), { query: ' dragon ', shown: [] })
    expect(screen.getByText('No notes match “dragon”.')).toBeInTheDocument()
    expect(screen.queryByText('No notes in this chapter yet.')).toBeNull()
  })

  describe('Reorder', () => {
    it('offers it for a group of more than one note, and opens it', async () => {
      const user = userEvent.setup()
      const { onReorder } = renderPage('sessionChapter01')
      await user.click(screen.getByRole('button', { name: 'Reorder' }))
      expect(onReorder).toHaveBeenCalledTimes(1)
    })

    it('offers it for the notes in no chapter too', () => {
      renderPage(null)
      expect(
        screen.getByRole('button', { name: 'Reorder' }),
      ).toBeInTheDocument()
    })

    it.each([
      ['while searching', book(), { query: 'w' }],
      ['while a draft is open', book(), { drafting: true }],
      [
        'for a group of one note',
        book({ entries: [noteEntry({ chapterId: 'sessionChapter01' })] }),
        {},
      ],
      ['to a seat that may not', book({ canReorder: false }), {}],
    ])('offers none %s', (_, view, props) => {
      renderPage('sessionChapter01', view, props)
      expect(screen.queryByRole('button', { name: 'Reorder' })).toBeNull()
    })
  })

  describe('Rename', () => {
    it('offers it where the seat may, from the chapter’s own button', async () => {
      const user = userEvent.setup()
      const { onRename } = renderPage('sessionChapter01')
      const rename = screen.getByRole('button', { name: 'Rename Session 1' })
      expect(rename).toHaveAttribute('title', 'Rename')
      await user.click(rename)
      expect(onRename).toHaveBeenCalledWith('rename')
    })

    it.each([
      ['a book that takes no change', book({ canAdd: false })],
      [
        'a chapter the seat may not rename',
        book({ chapters: [noteChapter({ canRename: false })] }),
      ],
      [
        'a chapter in conflict',
        book({ chapters: [noteChapter({ state: 'conflict' })] }),
      ],
      [
        'a chapter deleted in Foundry',
        book({ chapters: [noteChapter({ state: 'gone' })] }),
      ],
    ])('offers none for %s', (_, view) => {
      renderPage('sessionChapter01', view)
      expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull()
    })

    it('offers none for the notes in no chapter', () => {
      renderPage(null)
      expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull()
    })
  })

  it('shows what Foundry has written under a chapter, headed so, lifted under its h3', () => {
    renderPage(
      'sessionChapter01',
      book({ chapters: [noteChapter({ html: '<h5>Map</h5><p>North.</p>' })] }),
    )
    const box = screen.getByText('Written in Foundry, under the chapter')
      .parentElement as HTMLElement
    expect(box).toHaveClass('bg-page', 'rounded-xl')
    expect(within(box).getByRole('heading', { name: 'Map' }).localName).toBe(
      'h4',
    )
  })

  it('shows no such box for a chapter with nothing written under it', () => {
    renderPage('sessionChapter01')
    expect(
      screen.queryByText('Written in Foundry, under the chapter'),
    ).toBeNull()
  })

  describe('Move to chapter, on the cards of the notes in no chapter', () => {
    it('offers it on each card that may move, and says how to file one', async () => {
      const user = userEvent.setup()
      const { onMove } = renderPage(null)
      expect(
        screen.getByText(
          'These notes aren’t in any chapter yet. Use Move to chapter to file one.',
        ),
      ).toBeInTheDocument()
      const [first] = screen.getAllByRole('button', { name: 'Move to chapter' })
      await user.click(first)
      await user.click(screen.getByRole('menuitemradio', { name: 'Session 2' }))
      expect(onMove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rumourNote000001' }),
        'secondChapter001',
      )
    })

    it('shows its button busy while that note’s move is on its way', () => {
      renderPage(null, book(), { moving: 'rumourNote000001' })
      const [first, second] = screen.getAllByRole('button', {
        name: 'Move to chapter',
      })
      expect(first).toBeDisabled()
      expect(second).toBeEnabled()
    })

    it.each([
      ['no note may move', book({ entries: [noteEntry({ canEdit: false })] })],
      ['the book has no chapter', book({ chapters: [] })],
    ])('offers none, nor the hint, where %s', (_, view) => {
      renderPage(null, view)
      expect(
        screen.queryByRole('button', { name: 'Move to chapter' }),
      ).toBeNull()
      expect(
        screen.queryByText(/^These notes aren’t in any chapter yet/),
      ).toBeNull()
    })

    it('offers none on a chapter’s cards', () => {
      renderPage('sessionChapter01')
      expect(
        screen.queryByRole('button', { name: 'Move to chapter' }),
      ).toBeNull()
      expect(
        screen.queryByText(/^These notes aren’t in any chapter yet/),
      ).toBeNull()
    })
  })

  describe('New note', () => {
    it.each([
      ['sessionChapter01', 'New note in Session 1'],
      [null, 'New note'],
    ])('names its dashed button for its group: %s', async (chapterId, name) => {
      const user = userEvent.setup()
      const { onNewIn } = renderPage(chapterId)
      const button = within(article()).getByRole('button', { name })
      expect(button).toHaveClass('border-dashed')
      expect(button).toHaveAttribute('data-note-opener', 'new-in')
      await user.click(button)
      expect(onNewIn).toHaveBeenCalledTimes(1)
    })

    it('offers none where the book takes no change', () => {
      renderPage('sessionChapter01', book({ canAdd: false }))
      expect(screen.queryByRole('button', { name: /^New note/ })).toBeNull()
    })
  })

  it('shows a chapter’s chip and problem panel, and sends its choice', async () => {
    const user = userEvent.setup()
    const { onResolve, onRename } = renderPage(
      'sessionChapter01',
      book({
        chapters: [
          noteChapter({
            state: 'failed',
            reason: 'full',
            mine: { title: 'Session one' },
          }),
        ],
      }),
    )
    const panel = screen.getByRole('group', { name: 'Not saved to the game' })
    expect(panel.previousElementSibling).toHaveTextContent(
      'Not saved to the game',
    )
    await user.click(within(panel).getByRole('button', { name: 'Try again' }))
    expect(onResolve).toHaveBeenCalledWith('mine')
    await user.click(within(panel).getByRole('button', { name: 'Edit' }))
    expect(onRename).toHaveBeenCalledWith('problem-edit')
  })

  it('shows its order’s chip where it isn’t in step, and its panel where it was refused', async () => {
    const user = userEvent.setup()
    const { onResolveOrder } = renderPage(
      'sessionChapter01',
      book({
        groups: [
          {
            chapterId: 'sessionChapter01',
            state: 'conflict',
            reason: 'changed',
            stamp: 'g:1',
            mine: { ids: ['goblinCaveNote01', 'wolvesNote000001'] },
          },
        ],
      }),
    )
    expect(
      screen.getByText('Order changed in Foundry', { selector: 'span' }),
    ).toBeInTheDocument()
    const panel = screen.getByRole('group', {
      name: 'Order changed in Foundry',
    })
    await user.click(within(panel).getByRole('button', { name: 'Show yours' }))
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['The goblin cave', 'Wolves'])
    await user.click(within(panel).getByRole('button', { name: 'Use yours' }))
    expect(onResolveOrder).toHaveBeenCalledWith('mine')
  })

  it('shows an order waiting as a chip, with no panel', () => {
    renderPage(
      null,
      book({ groups: [{ chapterId: null, state: 'waiting', stamp: 'g:1' }] }),
    )
    expect(screen.getByText('Order waiting for the game')).toBeInTheDocument()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('shows neither for an order in step', () => {
    renderPage('sessionChapter01')
    expect(screen.queryByText(/^Order /)).toBeNull()
  })

  it('takes notes to show from its caller, as a search finds them', () => {
    const entries: NoteEntryView[] = [
      noteEntry({ chapterId: 'sessionChapter01' }),
    ]
    renderPage('sessionChapter01', book(), { query: 'gob', shown: entries })
    expect(cards()).toEqual(['The goblin cave'])
  })
})
