/* eslint-disable unicorn/no-null -- a chapter is in no chapter, as the API has it */
import { useCallback, useReducer, useRef } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChapterForm } from './chapter-form'
import { NotesSection } from './notes-section'
import {
  forgetNotes,
  type DraftChange,
  type NoteDraft,
} from '@/hooks/use-notes'
import { emptyBook, noteChapter, serveNotes } from '@/mocks/notes-server'
import type { NoteWriteAnswer } from '@/types/notes'

const API = '/api/characters/char-1'

const draftOf = (fields: Partial<NoteDraft> = {}): NoteDraft => ({
  key: 'new-chapter',
  role: 'chapter',
  title: '',
  body: '',
  chapterId: null,
  started: { title: '', body: '', chapterId: null },
  opener: 'new-chapter',
  ...fields,
})

let held: NoteDraft | undefined

type FormProps = Parameters<typeof ChapterForm>[0]

function Harness({
  initial,
  shown = true,
  ...props
}: Readonly<Partial<FormProps> & { initial: NoteDraft; shown?: boolean }>) {
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
    <ChapterForm
      draft={draft}
      setDraft={setDraft}
      name='Thorin'
      onSave={async () => ({ ok: true })}
      onCancel={() => {}}
      opened={false}
      {...props}
    />
  )
}

const input = () =>
  screen.getByRole('textbox', { name: 'Chapter title' }) as HTMLInputElement

describe('components/notes/chapter-form', () => {
  beforeEach(() => {
    held = undefined
    HTMLElement.prototype.scrollIntoView = jest.fn()
  })

  it('heads a new chapter, and a rename by the chapter’s title', () => {
    const { unmount } = render(<Harness initial={draftOf()} />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'New chapter' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('form', { name: 'New chapter' }),
    ).toBeInTheDocument()
    unmount()
    render(
      <Harness
        initial={draftOf({
          key: 'sessionChapter01',
          title: 'Session 1',
          started: { title: 'Session 1', body: '', chapterId: null },
          opener: 'rename',
        })}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'Rename Session 1' }),
    ).toBeInTheDocument()
    expect(input()).toHaveValue('Session 1')
  })

  it('has one field, 16px, of 200 characters at most, and says nothing of deleting', () => {
    render(<Harness initial={draftOf()} />)
    expect(input()).toHaveClass('text-base')
    expect(input()).toHaveAttribute('maxLength', '200')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('form')).not.toHaveTextContent(/delet/i)
    // Its Cancel and Save are in the editor's sticky row.
    expect(
      screen.getByRole('button', { name: 'Save' }).parentElement,
    ).toHaveClass('sticky', 'top-0')
  })

  it('saves on Enter, its only field, once it has a title', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn(async (): Promise<NoteWriteAnswer> => ({ ok: true }))
    render(<Harness initial={draftOf()} onSave={onSave} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.click(input())
    await user.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()

    await user.keyboard('Session 2{Enter}')
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Session 2' }),
    )
  })

  it('keeps the title as typed where it’s refused, saying why', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={draftOf()}
        onSave={async () => ({ ok: false, reason: 'full' })}
      />,
    )
    await user.type(input(), 'Session 51{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This journal is full: 300 notes, 50 chapters and a million characters at most.',
    )
    expect(input()).toHaveValue('Session 51')
  })

  it('asks before discarding a title typed', async () => {
    const user = userEvent.setup()
    const onCancel = jest.fn()
    render(<Harness initial={draftOf()} onCancel={onCancel} />)
    await user.type(input(), 'Session 2')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('takes focus opened by a button, and puts it back mounted again', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <Harness initial={draftOf({ focus: { field: 'title' } })} opened />,
    )
    expect(input()).toHaveFocus()
    await user.keyboard('Sess')
    rerender(<Harness initial={draftOf()} shown={false} />)
    expect(held?.focus).toEqual({ field: 'title', start: 4, end: 4 })
    rerender(<Harness initial={draftOf()} />)
    expect(input()).toHaveFocus()
    expect(input()).toHaveValue('Sess')
  })

  describe('in its section', () => {
    beforeEach(() => {
      forgetNotes()
    })

    afterEach(() => {
      act(() => forgetNotes())
    })

    const renderSection = () =>
      render(
        <NotesSection
          api={API}
          role='player'
          kind='personal'
          name='Thorin'
          active
          look='sheet'
        />,
      )

    it('adds a chapter, then gives focus to its heading', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: emptyBook() })
      renderSection()
      await user.click(
        await screen.findByRole('button', { name: 'New chapter' }),
      )
      expect(input()).toHaveFocus()
      await user.keyboard('Session 1{Enter}')
      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes`,
        method: 'POST',
        body: { role: 'chapter', title: 'Session 1' },
      })
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 3, name: /^Session 1/ }),
        ).toHaveFocus(),
      )
    })

    it('renames a chapter from the stamp it started at', async () => {
      const user = userEvent.setup()
      const server = serveNotes({
        [API]: emptyBook({ chapters: [noteChapter()] }),
      })
      renderSection()
      await user.click(
        await screen.findByRole('button', { name: 'Rename Session 1' }),
      )
      await user.clear(input())
      await user.type(input(), 'The first night{Enter}')
      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes/sessionChapter01`,
        method: 'PATCH',
        body: { title: 'The first night', stamp: 'n:0000000000000b' },
      })
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 3, name: /^The first night/ }),
        ).toHaveFocus(),
      )
    })
  })
})
