/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { useCallback, useReducer, useRef } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalCard } from './journal-card'
import { headingHint, NoteEditor } from './note-editor'
import {
  forgetNotes,
  hasDraft,
  type DraftChange,
  type NoteDraft,
} from '@/hooks/use-notes'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import { bigHeadings } from '@/utils/note-headings'
import type { NoteChapterView, NoteWriteAnswer } from '@/types/notes'

const API = '/api/characters/char-1'

const draftOf = (fields: Partial<NoteDraft> = {}): NoteDraft => ({
  key: 'new',
  role: 'entry',
  title: '',
  body: '',
  chapterId: null,
  started: { title: '', body: '', chapterId: null },
  opener: 'new',
  ...fields,
})

/** The draft as its owner holds it now. */
let held: NoteDraft | undefined

type EditorProps = Parameters<typeof NoteEditor>[0]

/** No preview, as a server that can't be reached gives none. */
const noPreview: EditorProps['preview'] = async () =>
  // eslint-disable-next-line unicorn/no-useless-undefined -- the preview's none
  undefined

/**
 * An editor whose draft is held by its owner, shown or not, as the page's store holds it: a
 * change to it runs at once on the draft held then, as the store's does.
 */
function Harness({
  initial,
  shown = true,
  ...props
}: Readonly<Partial<EditorProps> & { initial: NoteDraft; shown?: boolean }>) {
  const store = useRef<NoteDraft | undefined>(initial)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const setDraft = useCallback((change: DraftChange) => {
    store.current =
      typeof change === 'function' ? change(store.current) : change
    held = store.current
    redraw()
  }, [])
  const draft = store.current
  held = draft
  if (!draft || !shown) return
  return (
    <NoteEditor
      draft={draft}
      setDraft={setDraft}
      chapters={[]}
      name='Thorin'
      preview={noPreview}
      onSave={async () => ({ ok: true })}
      onCancel={() => {}}
      {...props}
    />
  )
}

const title = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement
const body = () =>
  screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement
const save = () => screen.getByRole('button', { name: 'Save' })
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' })
const chapterField = () => screen.getByRole('combobox', { name: 'Chapter' })

describe('components/notes/note-editor', () => {
  beforeEach(() => {
    held = undefined
  })

  it('heads a new note, and a change by the note’s title, cut to one line', () => {
    const { unmount } = render(<Harness initial={draftOf()} />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'New note' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'New note' })).toBeInTheDocument()
    unmount()

    render(
      <Harness
        initial={draftOf({
          key: 'goblinCaveNote01',
          title: 'Goblin cave, renamed',
          started: { title: 'The goblin cave', body: '', chapterId: null },
          opener: 'edit',
        })}
      />,
    )
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Edit The goblin cave',
    })
    expect(heading).toHaveClass('truncate')
    expect(heading).toHaveAttribute('title', 'Edit The goblin cave')
  })

  it('keeps Cancel and Save in a footer below the fields, after them in Tab order, its heading in the bar', () => {
    render(<Harness initial={draftOf()} />)
    const form = screen.getByRole('form')
    const [bar, fields, footer] = form.children
    expect(bar).toContainElement(screen.getByRole('heading', { level: 3 }))
    expect(fields).toContainElement(body())
    expect(footer).toHaveClass('border-t', 'bg-card', 'shrink-0')
    expect(within(footer as HTMLElement).getAllByRole('button')).toEqual([
      cancelButton(),
      save(),
    ])
    expect(save()).toHaveAttribute('type', 'submit')
    // In the order Tab reaches them: the fields first, then Cancel and Save.
    const order = [...form.querySelectorAll('input, select, textarea, button')]
    expect(order.indexOf(save())).toBe(order.length - 1)
    expect(order.indexOf(cancelButton())).toBeGreaterThan(order.indexOf(body()))
  })

  it('says which keys save, from 640 px of the modal', () => {
    render(<Harness initial={draftOf()} />)
    const hint = screen.getByText('Ctrl+Enter or ⌘+Enter saves.')
    expect(hint).toHaveClass('hidden', '@min-[640px]:block')
  })

  it('lets the note fill the pane, never resized by hand', () => {
    render(<Harness initial={draftOf()} />)
    expect(body()).toHaveClass('min-h-56', 'flex-1', 'resize-none')
    expect(body()).not.toHaveClass('resize-y')
  })

  it('offers the book’s chapters, and no chapter, where it has any', async () => {
    const user = userEvent.setup()
    const chapters: NoteChapterView[] = [
      noteChapter(),
      noteChapter({ id: 'secondChapter001', title: 'Session 2' }),
    ]
    render(
      <Harness
        initial={draftOf({ chapterId: 'secondChapter001' })}
        chapters={chapters}
      />,
    )
    const chapter = screen.getByRole('combobox', { name: 'Chapter' })
    expect(chapter).toHaveValue('secondChapter001')
    expect(
      within(chapter)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['No chapter', 'Session 1', 'Session 2'])
    await user.selectOptions(chapter, 'No chapter')
    expect(held?.chapterId).toBeNull()
  })

  it('has no chapter to choose in a book with none, nor for a chapter', () => {
    render(<Harness initial={draftOf()} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('labels its fields, with 16px text, the note described by its help and its hint', () => {
    render(<Harness initial={draftOf()} />)
    expect(title()).toHaveClass('text-base')
    expect(title()).toHaveAttribute('maxLength', '200')
    expect(title()).toHaveAttribute('enterKeyHint', 'next')
    expect(body()).toHaveClass('text-base', 'resize-none')
    expect(body()).toHaveAccessibleDescription(
      expect.stringContaining(
        'Foundry’s Markdown: **bold**, *italic*, ### Heading, - list, > quote, | table |, ~~strike~~. # and ## are the journal’s chapters and notes, so headings start at ###.',
      ),
    )
  })

  describe('the heading hint', () => {
    it('points at # and ## headings, and at under-ruled lines, by line', async () => {
      const user = userEvent.setup()
      render(<Harness initial={draftOf()} />)
      await user.type(body(), 'Loot{Enter}#loot')

      const hint = screen.getByText(/^Line 2 is a # or ## heading/)
      expect(hint).toHaveAttribute('aria-live', 'polite')
      expect(hint).toHaveTextContent(
        String.raw`Line 2 is a # or ## heading. Use ### or more, or put a \ before the #.`,
      )
      expect(body()).toHaveAccessibleDescription(
        expect.stringContaining('Line 2 is a # or ## heading.'),
      )
    })

    it('names an under-ruled heading by its own line, as the scanner and a refusal number it', () => {
      for (const [text, line] of [
        ['Title\n-', 1],
        ['one\ntwo\n=', 2],
      ] as const) {
        expect(bigHeadings(text)).toEqual([line])
        expect(headingHint(text, bigHeadings(text))).toBe(
          `Line ${line} has = or - on the line below it, which makes it a heading. Leave a blank line between them.`,
        )
      }
      expect(headingHint('> ## quoted', [1])).toMatch(/^Line 1 is a # or ##/)
      expect(headingHint('- # in a list', [1])).toMatch(/^Line 1 is a # or ##/)
      expect(headingHint('', [])).toBe('')
    })

    it('names three lines at most, then how many more', () => {
      const hint = headingHint('#a\n#b\n#c\n#d\n#e', [1, 2, 3, 4, 5])
      expect(hint.match(/Line \d/g)).toEqual(['Line 1', 'Line 2', 'Line 3'])
      expect(hint).toMatch(/…and 2 more$/)
    })

    it('leaves Save enabled while it shows: the server’s render decides', async () => {
      const user = userEvent.setup()
      const onSave = jest.fn(async (): Promise<NoteWriteAnswer> => ({
        ok: true,
      }))
      render(<Harness initial={draftOf()} onSave={onSave} />)
      await user.type(title(), 'Loot')
      await user.type(body(), '#loot')
      expect(screen.getByText(/^Line 1 is a # or ## heading/)).toBeVisible()
      expect(save()).toBeEnabled()
      await user.click(save())
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Loot', body: '#loot' }),
      )
    })
  })

  describe('Save', () => {
    it('is disabled while the title is empty', async () => {
      const user = userEvent.setup()
      render(<Harness initial={draftOf()} />)
      expect(save()).toBeDisabled()
      await user.type(title(), ' '.repeat(3))
      expect(save()).toBeDisabled()
      await user.type(title(), 'Wolves')
      expect(save()).toBeEnabled()
    })

    it('is disabled past 20,000 characters, which the count shows from 18,000', () => {
      const { rerender } = render(
        <Harness
          initial={draftOf({ title: 'Long', body: 'a'.repeat(18_000) })}
        />,
      )
      expect(screen.queryByText(/\/ 20,000$/)).toBeNull()
      expect(save()).toBeEnabled()
      rerender(
        <Harness
          key='longer'
          initial={draftOf({ title: 'Long', body: 'a'.repeat(18_001) })}
        />,
      )
      expect(screen.getByText('18,001 / 20,000')).toBeInTheDocument()
      expect(save()).toBeEnabled()
      rerender(
        <Harness
          key='longest'
          initial={draftOf({ title: 'Long', body: 'a'.repeat(20_001) })}
        />,
      )
      expect(screen.getByText('20,001 / 20,000')).toHaveClass('text-danger')
      expect(save()).toBeDisabled()
    })

    it('is disabled, with a spinner, while it’s saving', async () => {
      const user = userEvent.setup()
      let answer: ((answered: NoteWriteAnswer) => void) | undefined
      const onSave = jest.fn(
        () =>
          new Promise<NoteWriteAnswer>(resolve => {
            answer = resolve
          }),
      )
      render(<Harness initial={draftOf({ title: 'Wolves' })} onSave={onSave} />)
      await user.click(save())
      expect(save()).toBeDisabled()
      expect(save().querySelector('svg')).toHaveClass(
        'motion-safe:animate-spin',
      )
      await act(async () => answer?.({ ok: true }))
      expect(save()).toBeEnabled()
    })

    it('holds its fields still, with Cancel off, till what was sent is answered, the mark in the draft', async () => {
      const user = userEvent.setup()
      let answer: ((answered: NoteWriteAnswer) => void) | undefined
      const onSave = jest.fn(
        () =>
          new Promise<NoteWriteAnswer>(resolve => {
            answer = resolve
          }),
      )
      render(
        <Harness
          initial={draftOf({ title: 'Wolves', body: 'Three.' })}
          chapters={[noteChapter()]}
          onSave={onSave}
        />,
      )
      await user.click(save())
      expect(held?.saving).toBe(true)
      expect(title()).toHaveAttribute('readonly')
      expect(body()).toHaveAttribute('readonly')
      expect(chapterField()).toBeDisabled()
      expect(cancelButton()).toBeDisabled()
      await user.type(body(), ' And a fourth.')
      expect(body()).toHaveValue('Three.')
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Three.' }),
      )

      // Refused, it's open again with the text as it was sent.
      await act(async () => answer?.({ ok: false, reason: 'busy' }))
      expect(held?.saving).toBeUndefined()
      expect(title()).not.toHaveAttribute('readonly')
      expect(body()).not.toHaveAttribute('readonly')
      expect(chapterField()).toBeEnabled()
      expect(cancelButton()).toBeEnabled()
      await user.type(body(), ' And a fourth.')
      expect(body()).toHaveValue('Three. And a fourth.')
    })

    it('keeps the editor open with the text as typed where it’s refused, saying why', async () => {
      const user = userEvent.setup()
      render(
        <Harness
          initial={draftOf()}
          onSave={async () => ({ ok: false, reason: 'headings', lines: [1] })}
        />,
      )
      await user.type(title(), 'Loot')
      await user.type(body(), '#loot')
      await user.click(save())

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Use ### or more for headings: # and ## are the journal’s chapters and notes.',
      )
      expect(title()).toHaveValue('Loot')
      expect(body()).toHaveValue('#loot')
    })

    it('says so where Sending Stone couldn’t be reached', async () => {
      const user = userEvent.setup()
      render(
        <Harness
          initial={draftOf({ title: 'Wolves' })}
          onSave={async () => ({ ok: false, reason: 'network' })}
        />,
      )
      await user.click(save())
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Sending Stone couldn’t be reached. Your text is still here.',
      )
    })
  })

  describe('the keys', () => {
    it('moves on to the note on Enter in the title, saving nothing', async () => {
      const user = userEvent.setup()
      const onSave = jest.fn(async (): Promise<NoteWriteAnswer> => ({
        ok: true,
      }))
      render(<Harness initial={draftOf()} onSave={onSave} />)
      await user.click(title())
      await user.keyboard('Wolves{Enter}')
      expect(body()).toHaveFocus()
      expect(onSave).not.toHaveBeenCalled()
    })

    it('goes back to Write on Enter in the title, from Preview', async () => {
      const user = userEvent.setup()
      render(<Harness initial={draftOf({ title: 'Wolves' })} />)
      await user.click(screen.getByRole('tab', { name: 'Preview' }))
      await user.click(title())
      await user.keyboard('{Enter}')
      expect(screen.getByRole('tab', { name: 'Write' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(body()).toHaveFocus()
    })

    it.each([
      ['Ctrl+Enter', 'title', { ctrlKey: true }],
      ['Ctrl+Enter', 'note', { ctrlKey: true }],
      ['⌘+Enter', 'title', { metaKey: true }],
      ['⌘+Enter', 'note', { metaKey: true }],
    ])('saves on %s in the %s', async (_, field, keys) => {
      const onSave = jest.fn(async (): Promise<NoteWriteAnswer> => ({
        ok: true,
      }))
      render(<Harness initial={draftOf({ title: 'Wolves' })} onSave={onSave} />)
      await act(async () => {
        fireEvent.keyDown(field === 'title' ? title() : body(), {
          key: 'Enter',
          ...keys,
        })
      })
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('doesn’t save on Ctrl+Enter while composing, nor while Save is disabled', () => {
      const onSave = jest.fn(async (): Promise<NoteWriteAnswer> => ({
        ok: true,
      }))
      const { rerender } = render(
        <Harness initial={draftOf({ title: 'Wolves' })} onSave={onSave} />,
      )
      fireEvent.keyDown(body(), {
        key: 'Enter',
        ctrlKey: true,
        isComposing: true,
      })
      fireEvent.keyDown(title(), { key: 'Enter', ctrlKey: true, keyCode: 229 })
      expect(onSave).not.toHaveBeenCalled()

      rerender(<Harness key='empty' initial={draftOf()} onSave={onSave} />)
      fireEvent.keyDown(body(), { key: 'Enter', ctrlKey: true })
      expect(onSave).not.toHaveBeenCalled()
    })

    it('leaves Write chosen as Left and Right move the caret in the note', async () => {
      const user = userEvent.setup()
      render(<Harness initial={draftOf({ body: 'abc' })} />)
      await user.click(body())
      await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowLeft}')
      expect(screen.getByRole('tab', { name: 'Write' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(body()).toHaveFocus()
    })
  })

  describe('Write and Preview', () => {
    it('are tabs of a list named Write or preview, Left and Right moving between them', async () => {
      const user = userEvent.setup()
      render(<Harness initial={draftOf({ body: '### Loot' })} />)
      const tabs = screen.getByRole('tablist', { name: 'Write or preview' })
      const [write, preview] = within(tabs).getAllByRole('tab')
      expect(write).toHaveTextContent('Write')
      expect(write).toHaveAttribute('tabindex', '0')
      expect(preview).toHaveAttribute('tabindex', '-1')
      expect(screen.getByRole('tabpanel', { name: 'Write' })).toContainElement(
        body(),
      )

      act(() => write.focus())
      await user.keyboard('{ArrowRight}')
      expect(preview).toHaveFocus()
      expect(preview).toHaveAttribute('aria-selected', 'true')
      expect(preview).toHaveAttribute('tabindex', '0')
      await user.keyboard('{ArrowLeft}')
      expect(write).toHaveFocus()
      expect(write).toHaveAttribute('aria-selected', 'true')
    })

    it('previews the note as the server renders it, saying it’s loading meanwhile', async () => {
      const user = userEvent.setup()
      let rendered:
        ((html: { html: string; headings: number[] }) => void) | undefined
      const preview = jest.fn(
        () =>
          new Promise<{ html: string; headings: number[] }>(resolve => {
            rendered = resolve
          }),
      )
      render(
        <Harness
          initial={draftOf({ body: '| a |\n|---|\n| b |' })}
          preview={preview}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Preview' }))
      expect(preview).toHaveBeenCalledWith('| a |\n|---|\n| b |')
      const panel = screen.getByRole('tabpanel', { name: 'Preview' })
      expect(panel).toHaveTextContent('Loading…')
      await act(async () =>
        rendered?.({
          html: '<table><tbody><tr><td>b</td></tr></tbody></table><p><s>strike</s> <strong>Vex</strong></p>',
          headings: [],
        }),
      )
      expect(within(panel).getByRole('table')).toBeInTheDocument()
      expect(panel.querySelector('s')).toHaveTextContent('strike')
      expect(panel.querySelector('a')).toBeNull()
      expect(panel.querySelector('.sheet-text.note-text')).not.toBeNull()

      // The same text again isn't asked for again.
      await user.click(screen.getByRole('tab', { name: 'Write' }))
      await user.click(screen.getByRole('tab', { name: 'Preview' }))
      expect(preview).toHaveBeenCalledTimes(1)
    })
  })

  it('says so where the preview can’t be loaded, and that the text is kept', async () => {
    const user = userEvent.setup()
    render(<Harness initial={draftOf({ body: '### Loot' })} />)
    await user.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(
      await screen.findByText(
        'The preview couldn’t be loaded. Your text is still here.',
      ),
    ).toBeInTheDocument()
  })

  it('says there’s nothing to preview with no text', async () => {
    const user = userEvent.setup()
    render(<Harness initial={draftOf()} />)
    await user.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(screen.getByText('Nothing to preview.')).toBeInTheDocument()
  })

  describe('Cancel', () => {
    it('closes at once with nothing changed', async () => {
      const user = userEvent.setup()
      const onCancel = jest.fn()
      render(<Harness initial={draftOf()} onCancel={onCancel} />)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('asks first where something was written, and keeps editing on Keep editing', async () => {
      const user = userEvent.setup()
      const onCancel = jest.fn()
      render(<Harness initial={draftOf()} onCancel={onCancel} />)
      await user.type(title(), 'Wolves')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      const dialog = screen.getByRole('dialog', {
        name: 'Discard your changes?',
      })
      expect(dialog).toHaveTextContent('What you wrote here isn’t saved.')
      await user.click(
        within(dialog).getByRole('button', { name: 'Keep editing' }),
      )
      expect(onCancel).not.toHaveBeenCalled()
      expect(title()).toHaveValue('Wolves')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      const discard = within(
        screen.getByRole('dialog', { name: 'Discard your changes?' }),
      ).getByRole('button', { name: 'Discard' })
      expect(discard).toHaveClass('bg-danger')
      await user.click(discard)
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('focus', () => {
    it('opened by a button, its title takes focus', () => {
      render(<Harness initial={draftOf({ focus: { field: 'title' } })} />)
      expect(title()).toHaveFocus()
      // What it noted is spent.
      expect(held?.focus).toBeUndefined()
    })

    it('mounted again from the store with no focus noted, it holds the draft and takes none', () => {
      render(
        <Harness
          initial={draftOf({ title: 'Wolves', body: 'Three of them.' })}
        />,
      )
      expect(title()).toHaveValue('Wolves')
      expect(body()).toHaveValue('Three of them.')
      expect(document.body).toHaveFocus()
    })

    it('puts focus and the caret back in the note where it unmounted with them there', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness initial={draftOf()} />)
      await user.click(body())
      await user.keyboard('Three of them.')
      act(() => body().setSelectionRange(2, 5))

      rerender(<Harness initial={draftOf()} shown={false} />)
      expect(held?.focus).toEqual({ field: 'body', start: 2, end: 5 })

      rerender(<Harness initial={draftOf()} />)
      expect(body()).toHaveFocus()
      expect(body().selectionStart).toBe(2)
      expect(body().selectionEnd).toBe(5)
      expect(held?.focus).toBeUndefined()
    })

    it('puts focus back in the title, at its caret', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness initial={draftOf()} />)
      await user.click(title())
      await user.keyboard('Wolves')
      rerender(<Harness initial={draftOf()} shown={false} />)
      expect(held?.focus).toEqual({ field: 'title', start: 6, end: 6 })
      rerender(<Harness initial={draftOf()} />)
      expect(title()).toHaveFocus()
      expect(title().selectionStart).toBe(6)
    })

    it('puts focus on the title where it unmounted with focus on one of its buttons', async () => {
      const { rerender } = render(
        <Harness initial={draftOf({ title: 'Wolves' })} />,
      )
      act(() => save().focus())
      rerender(<Harness initial={draftOf()} shown={false} />)
      expect(held?.focus).toEqual({ field: 'title' })
      rerender(<Harness initial={draftOf()} />)
      expect(title()).toHaveFocus()
    })

    it('notes nothing where focus was elsewhere as it unmounted', async () => {
      const { rerender } = render(<Harness initial={draftOf()} />)
      rerender(<Harness initial={draftOf()} shown={false} />)
      expect(held?.focus).toBeUndefined()
    })
  })
})

/** Thorin's book: a chapter with a note, and a note the game refused. */
const book = () =>
  emptyBook({
    chapters: [noteChapter()],
    entries: [
      noteEntry({
        chapterId: 'sessionChapter01',
        modifiedAt: new Date(Date.now() + 1000).toISOString(),
      }),
      noteEntry({
        id: 'refusedEntry0001',
        title: 'Refused',
        state: 'failed',
        reason: 'full',
        stamp: 'w:abc.1',
        mine: {
          title: 'Refused, again',
          html: '<p>again</p>',
          body: 'again',
          chapterId: null,
        },
      }),
    ],
  })

const renderCard = () =>
  render(
    <JournalCard
      api={API}
      role='player'
      kind='personal'
      name='Thorin'
      active
      look='sheet'
    />,
  )
/** The card, and its journal opened, its contents listed. */
const renderJournal = async (user: ReturnType<typeof userEvent.setup>) => {
  const rendered = renderCard()
  await user.click(
    await screen.findByRole('button', { name: 'Open My Journal' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'My Journal' })
  await within(dialog).findByRole('navigation', { name: 'Contents' })
  return { dialog, ...rendered }
}
const contents = () => screen.getByRole('navigation', { name: 'Contents' })
const readerHeading = () => screen.getAllByRole('heading', { level: 3 })[0]
/** The creates the server was sent. */
const posts = (server: ReturnType<typeof serveNotes>) =>
  server.sent.filter(({ method }) => method === 'POST')

/** Holds the book's writes till they're let go, as a slow phone's are; reads pass. */
const holdWrites = () => {
  const served = globalThis.fetch
  const waiting: (() => void)[] = []
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') !== 'GET') {
      await new Promise<void>(resolve => waiting.push(resolve))
    }
    return served(url, init)
  }) as typeof fetch
  return {
    waiting,
    letGo: () =>
      act(async () => {
        for (const go of waiting.splice(0)) go()
      }),
  }
}

/** A chapter deleted in Foundry, then the book read again, as a poll reads it. */
const deleteChapter = async (server: ReturnType<typeof serveNotes>) => {
  const stored = server.books[API]
  stored.chapters = stored.chapters.filter(
    ({ id }) => id !== 'sessionChapter01',
  )
  stored.version += 1
  await act(async () => {
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL)
  })
}

/** Sends each create on, then loses its answer, or loses it before it's kept. */
const loseCreates = (kept: boolean) => {
  const served = globalThis.fetch
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    if (init.method !== 'POST') return served(url, init)
    if (kept) await served(url, init)
    throw new TypeError('Failed to fetch')
  }) as typeof fetch
}

describe('components/notes/note-editor, in the journal', () => {
  beforeEach(() => {
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it('fills the reader while it’s open, the contents locked', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    const { dialog } = await renderJournal(user)
    await user.click(within(dialog).getByRole('button', { name: 'New note' }))
    expect(title()).toHaveFocus()
    expect(
      within(dialog).getByText('Save or cancel to read another note.'),
    ).toBeInTheDocument()
    expect(contents().closest('[inert]')).not.toBeNull()
    expect(screen.getByRole('form', { name: 'New note' })).toHaveClass('flex-1')
  })

  it('starts a note from the contents’ New note in the open note’s chapter, and from a chapter’s page in that one', async () => {
    const user = userEvent.setup()
    serveNotes({
      [API]: emptyBook({
        chapters: [
          noteChapter({ createdAt: '2026-10-21T10:00:00.000Z' }),
          noteChapter({
            id: 'secondChapter001',
            title: 'Session 2',
            createdAt: '2026-10-21T11:00:00.000Z',
          }),
        ],
        entries: [noteEntry({ chapterId: 'sessionChapter01' })],
      }),
    })
    const { dialog } = await renderJournal(user)
    await user.click(within(dialog).getByRole('button', { name: 'New note' }))
    expect(chapterField()).toHaveValue('sessionChapter01')
    await user.click(cancelButton())
    await user.click(
      within(contents()).getByRole('button', { name: 'Session 2' }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'New note in Session 2' }),
    )
    expect(chapterField()).toHaveValue('secondChapter001')
  })

  it('saves a new note, then the reader shows it, with focus on its title, and says so', async () => {
    const user = userEvent.setup()
    const server = serveNotes({ [API]: book() })
    const { dialog } = await renderJournal(user)
    await user.click(within(dialog).getByRole('button', { name: 'New note' }))
    await user.selectOptions(chapterField(), 'No chapter')
    await user.type(title(), '  Wolves  ')
    await user.type(body(), 'Three of them.')
    await user.click(save())

    expect(server.sent.at(-1)).toEqual({
      url: `${API}/notes`,
      method: 'POST',
      body: {
        role: 'entry',
        title: 'Wolves',
        body: 'Three of them.',
        chapterId: null,
      },
    })
    await waitFor(() => expect(readerHeading()).toHaveTextContent('Wolves'))
    await waitFor(() => expect(readerHeading()).toHaveFocus())
    expect(screen.queryByRole('form')).toBeNull()
    expect(within(dialog).getByText('Saved.')).toBeInTheDocument()
    expect(hasDraft(API)).toBe(false)
  })

  it('saves a change from the stamp it started at', async () => {
    const user = userEvent.setup()
    const server = serveNotes({ [API]: book() })
    const { dialog } = await renderJournal(user)
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit The goblin cave' }),
    )
    expect(title()).toHaveValue('The goblin cave')
    expect(body()).toHaveValue('30 gp')
    await user.clear(title())
    await user.type(title(), 'Goblin cave')
    await user.click(save())
    expect(server.sent.at(-1)).toEqual({
      url: `${API}/notes/goblinCaveNote01`,
      method: 'PATCH',
      body: {
        title: 'Goblin cave',
        body: '30 gp',
        chapterId: 'sessionChapter01',
        stamp: 'n:0000000000000c',
      },
    })
    await waitFor(() =>
      expect(readerHeading()).toHaveTextContent('Goblin cave'),
    )
    await waitFor(() => expect(readerHeading()).toHaveFocus())
  })

  it('changes a refused change from what it was', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    await renderJournal(user)
    await user.click(
      within(contents()).getByRole('button', { name: 'Refused' }),
    )
    const problem = screen.getByRole('group', {
      name: 'Not saved to the game',
    })
    await user.click(within(problem).getByRole('button', { name: 'Edit' }))
    expect(title()).toHaveValue('Refused, again')
    expect(body()).toHaveValue('again')
  })

  it.each([
    [
      'the contents’ New note',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'New note' })),
      () => screen.getByRole('button', { name: 'New note' }),
    ],
    [
      'a chapter page’s New note in',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          within(contents()).getByRole('button', { name: 'Session 1' }),
        )
        await user.click(
          screen.getByRole('button', { name: 'New note in Session 1' }),
        )
      },
      () => screen.getByRole('button', { name: 'New note in Session 1' }),
    ],
    [
      'the contents’ New chapter',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'New chapter' })),
      () => screen.getByRole('button', { name: 'New chapter' }),
    ],
    [
      'a note’s Edit',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(
          screen.getByRole('button', { name: 'Edit The goblin cave' }),
        ),
      () => screen.getByRole('button', { name: 'Edit The goblin cave' }),
    ],
    [
      'the problem panel’s Edit',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          within(contents()).getByRole('button', { name: 'Refused' }),
        )
        await user.click(
          within(
            screen.getByRole('group', { name: 'Not saved to the game' }),
          ).getByRole('button', { name: 'Edit' }),
        )
      },
      () =>
        within(
          screen.getByRole('group', { name: 'Not saved to the game' }),
        ).getByRole('button', { name: 'Edit' }),
    ],
    [
      'a chapter’s Rename',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          within(contents()).getByRole('button', { name: 'Session 1' }),
        )
        await user.click(
          screen.getByRole('button', { name: 'Rename Session 1' }),
        )
      },
      () => screen.getByRole('button', { name: 'Rename Session 1' }),
    ],
  ])(
    'gives focus back to %s after Cancel, the reader as it was',
    async (_, opening, opener) => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      await renderJournal(user)
      await opening(user)
      const shown = screen.getByRole('form')
      expect(shown).toBeInTheDocument()
      await user.click(cancelButton())
      expect(screen.queryByRole('form')).toBeNull()
      await waitFor(() => expect(opener()).toHaveFocus())
    },
  )

  it('gives focus back after Discard, before any dialog could take it', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    await renderJournal(user)
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(title(), 'Wolves')
    await user.click(cancelButton())
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Discard your changes?' }),
      ).getByRole('button', { name: 'Discard' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New note' })).toHaveFocus(),
    )
  })

  it('gives focus to the reader’s title where what opened it is gone', async () => {
    jest.useFakeTimers()
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const server = serveNotes({ [API]: book() })
      await renderJournal(user)
      await user.click(
        screen.getByRole('button', { name: 'Edit The goblin cave' }),
      )
      // Deleted meanwhile, as in Foundry.
      const stored = server.books[API]
      stored.entries = stored.entries.filter(
        ({ id }) => id !== 'goblinCaveNote01',
      )
      stored.version += 1
      await act(async () => {
        await jest.advanceTimersByTimeAsync(POLL_INTERVAL)
      })
      await user.click(cancelButton())
      await act(async () => {})
      expect(readerHeading()).toHaveTextContent('Refused')
      expect(readerHeading()).toHaveFocus()
    } finally {
      jest.useRealTimers()
    }
  })

  it('gives focus back to the editor and its caret where the card is mounted again meanwhile', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    const { unmount } = await renderJournal(user)
    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(title(), 'Wolves')
    await user.click(body())
    await user.keyboard('Three of them.')
    act(() => body().setSelectionRange(3, 3))
    unmount()

    renderCard()
    await screen.findByRole('dialog', { name: 'My Journal' })
    await waitFor(() => expect(body()).toHaveFocus())
    expect(body()).toHaveValue('Three of them.')
    expect(body().selectionStart).toBe(3)
  })

  describe('while it saves', () => {
    it('holds what was sent still, so nothing typed meanwhile is lost, and offers no Discard till it’s answered', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: emptyBook() })
      const writes = holdWrites()
      renderCard()
      await user.click(
        await screen.findByRole('button', { name: 'Open My Journal' }),
      )
      await user.click(await screen.findByRole('button', { name: 'New note' }))
      await user.type(title(), 'Wolves')
      await user.type(body(), 'Three.')
      await user.click(save())
      await waitFor(() => expect(writes.waiting).toHaveLength(1))

      await user.type(body(), ' And a fourth, typed while it saved.')
      expect(body()).toHaveValue('Three.')
      expect(cancelButton()).toBeDisabled()

      await writes.letGo()
      await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
      expect(posts(server).map(({ body: sent }) => sent)).toEqual([
        { role: 'entry', title: 'Wolves', body: 'Three.', chapterId: null },
      ])
      expect(hasDraft(API)).toBe(false)
    })

    it('sends it once, though the journal is mounted again meanwhile, as when the sheet arrives', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: emptyBook() })
      const writes = holdWrites()
      const { unmount } = renderCard()
      await user.click(
        await screen.findByRole('button', { name: 'Open My Journal' }),
      )
      await user.click(await screen.findByRole('button', { name: 'New note' }))
      await user.type(title(), 'Fifth')
      await user.click(save())
      await waitFor(() => expect(writes.waiting).toHaveLength(1))

      unmount()
      renderCard()
      await screen.findByRole('dialog', { name: 'My Journal' })
      await waitFor(() => expect(save()).toBeDisabled())
      expect(title()).toHaveAttribute('readonly')
      expect(cancelButton()).toBeDisabled()
      await user.click(save())
      await act(async () => {
        fireEvent.keyDown(title(), { key: 'Enter', ctrlKey: true })
      })

      await writes.letGo()
      await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
      expect(posts(server)).toHaveLength(1)
      expect(server.books[API].entries.map(entry => entry.title)).toEqual([
        'Fifth',
      ])
      expect(hasDraft(API)).toBe(false)
    })
  })

  describe('a chapter deleted meanwhile, as in Foundry', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it.each([
      [
        'one of two',
        [
          noteChapter({ createdAt: '2026-10-21T10:00:00.000Z' }),
          noteChapter({
            id: 'secondChapter001',
            title: 'Session 2',
            createdAt: '2026-10-21T11:00:00.000Z',
          }),
        ],
      ],
      ['its only one', [noteChapter()]],
    ])(
      'puts the note in no chapter, as it then shows, and saves it so: %s',
      async (_, chapters) => {
        const user = userEvent.setup({
          advanceTimers: jest.advanceTimersByTime,
        })
        const server = serveNotes({ [API]: emptyBook({ chapters }) })
        await renderJournal(user)
        await user.click(
          within(contents()).getByRole('button', { name: 'Session 1' }),
        )
        await user.click(
          screen.getByRole('button', { name: 'New note in Session 1' }),
        )
        await user.type(title(), 'Wolves')
        await deleteChapter(server)

        const chapter = screen.queryByRole('combobox', { name: 'Chapter' })
        if (chapters.length > 1) expect(chapter).toHaveValue('')
        else expect(chapter).toBeNull()
        await user.click(save())
        expect(posts(server).at(-1)?.body).toEqual({
          role: 'entry',
          title: 'Wolves',
          body: '',
          chapterId: null,
        })
      },
    )

    it('closes at once on Cancel with nothing typed: the book moved the note, not the player', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const server = serveNotes({
        [API]: emptyBook({
          chapters: [noteChapter()],
          entries: [noteEntry()],
        }),
      })
      await renderJournal(user)
      await user.click(
        within(contents()).getByRole('button', { name: 'Session 1' }),
      )
      await user.click(
        screen.getByRole('button', { name: 'New note in Session 1' }),
      )
      await deleteChapter(server)
      await user.click(cancelButton())
      expect(
        screen.queryByRole('dialog', { name: 'Discard your changes?' }),
      ).toBeNull()
      expect(screen.queryByRole('form')).toBeNull()
    })
  })

  describe('a note whose answer was lost on its way back', () => {
    it('is taken as saved where it was kept, so it’s never made twice', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      loseCreates(true)
      await renderJournal(user)
      await user.click(screen.getByRole('button', { name: 'New note' }))
      await user.selectOptions(chapterField(), 'No chapter')
      await user.type(title(), 'Wolves')
      await user.type(body(), 'Three of them.')
      await user.click(save())

      await waitFor(() => expect(readerHeading()).toHaveTextContent('Wolves'))
      expect(screen.queryByRole('form')).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(
        server.books[API].entries.filter(
          ({ title: named }) => named === 'Wolves',
        ),
      ).toHaveLength(1)
      expect(hasDraft(API)).toBe(false)
    })

    it('keeps the editor open, saying so in its footer, where it wasn’t kept', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      loseCreates(false)
      await renderJournal(user)
      await user.click(screen.getByRole('button', { name: 'New note' }))
      await user.type(title(), 'Wolves')
      await user.type(body(), 'Three of them.')
      await user.click(save())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Sending Stone couldn’t be reached. Your text is still here.',
      )
      // Above Cancel and Save, in the footer.
      expect(alert.nextElementSibling).toContainElement(save())
      expect(body()).toHaveValue('Three of them.')
      expect(save()).toBeEnabled()
      expect(server.books[API].entries).toHaveLength(2)
    })
  })
})
