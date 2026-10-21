/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { NotebookPen, Plus } from 'lucide-react'
import { ChapterForm } from './chapter-form'
import { NoteEditor } from './note-editor'
import { NoteList } from './note-list'
import { hasProblem } from './note-problem'
import { readDescription } from '@/components/character-sheet/description-html'
import { ConfirmModal } from '@/components/modal'
import { SearchField } from '@/components/search-field'
import { useNotes, type NoteDraft } from '@/hooks/use-notes'
import {
  noteRefusalWords,
  notesBanner,
  savedWords,
  whoSeesNotes,
} from '@/utils/note-words'
import { matchesSearch } from '@/utils/search'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import type {
  NoteBookKind,
  NoteChapterView,
  NoteEntryView,
  NoteResolve,
  NoteWriteAnswer,
} from '@/types/notes'

/** How long the status line says what was done, in milliseconds, before it clears itself. */
const SAID_FOR = 6000

type Props = {
  /** The seat's API base, such as `/api/characters/<id>`: its book is under it, at `/notes`. */
  api: string
  role: SeatRole
  kind: NoteBookKind
  /** The book's character or party, as its words name it. */
  name: string
  /** Whether it's in view, and so polled. */
  active: boolean
  /** Its heading as the tab it's in draws one: the sheet's, or the party sheet's. */
  look: 'sheet' | 'party'
}

/** Where focus goes once what it goes to is drawn. */
type FocusTo =
  | { summary: string }
  | { chapter: string }
  | { opener: NoteDraft['opener']; key: string; chapterId: string | null }

/**
 * A character's or a party's journal notes (round 0.34.0 §9.4), as a section of the tab that tells
 * of them, or under why there's no sheet to show: who sees them, why they can't reach Foundry now,
 * New note and New chapter, a search, and the list, or the editor in its place. It has no gutters
 * or scroller of its own, as its host gives them. Its status line says what was done, and is no
 * status of its own, as the page's one status is whether the game is live.
 */
export function NotesSection({
  api,
  role,
  kind,
  name,
  active,
  look,
}: Readonly<Props>) {
  const notes = useNotes(api, { active })
  const { view, state, draft, setDraft } = notes
  const ids = useId()
  const headingId = `${ids}-heading`
  const section = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState('')
  // Rows opened or closed by hand; a row with a problem is open until it's closed.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [focusTo, setFocusTo] = useState<FocusTo>()
  const [said, setSaid] = useState<{ words: string; n: number }>()
  const [deleting, setDeleting] = useState<NoteEntryView>()
  const [busy, setBusy] = useState<string>()
  // The draft a button opened just now, which comes into view with focus in its title.
  const [opened, setOpened] = useState<string>()
  // Whether the game is live as the book was last read, for words said once a change is answered.
  const live = useRef(view?.live ?? false)
  useLayoutEffect(() => {
    if (view) live.current = view.live
  }, [view])

  // What the status line says clears itself a while after.
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(undefined), SAID_FOR)
    return () => clearTimeout(timer)
  }, [said])

  // Focus moves once what it goes to is drawn: the editor replaces the list, so the button that
  // opened it unmounted with it, and is found again in the list drawn anew; where it's gone, the
  // section's heading has it. A passive effect, so a dialog closing inside the section, as
  // Delete's does, has given focus back first.
  useEffect(() => {
    if (!focusTo || draft) return
    const root = section.current
    const target = (root && findFocus(root, focusTo)) ?? heading.current
    target?.focus()
    setFocusTo(undefined)
  }, [focusTo, draft])

  const entries = useMemo(() => view?.entries ?? [], [view])
  const texts = useMemo(
    () => new Map(entries.map(entry => [entry.id, searchText(entry)])),
    [entries],
  )
  if (state === 'gone') return

  const say = (words: string) =>
    setSaid(held => ({ words, n: (held?.n ?? 0) + 1 }))
  const open = (next: Omit<NoteDraft, 'started' | 'focus'>) => {
    const started = {
      title: next.title,
      body: next.body,
      chapterId: next.chapterId,
    }
    setOpened(next.key)
    setDraft({ ...next, started, focus: { field: 'title' } })
  }
  const newNote = (chapterId: string | null, opener: 'new' | 'new-in') =>
    open({ key: 'new', role: 'entry', title: '', body: '', chapterId, opener })
  const newChapter = () =>
    open({
      key: 'new-chapter',
      role: 'chapter',
      title: '',
      body: '',
      chapterId: null,
      opener: 'new-chapter',
    })
  const edit = (entry: NoteEntryView, opener: 'edit' | 'problem-edit') => {
    // A change the game refused is changed again from what it was.
    const from = entry.state === 'failed' && entry.mine ? entry.mine : entry
    open({
      key: entry.id,
      role: 'entry',
      title: from.title,
      body: from.body ?? '',
      chapterId: from.chapterId,
      stamp: entry.stamp,
      opener,
    })
  }
  const rename = (
    chapter: NoteChapterView,
    opener: 'rename' | 'problem-edit',
  ) =>
    open({
      key: chapter.id,
      role: 'chapter',
      title:
        chapter.state === 'failed' && chapter.mine
          ? chapter.mine.title
          : chapter.title,
      body: '',
      chapterId: null,
      stamp: chapter.stamp,
      opener,
    })
  const save = async (made: NoteDraft): Promise<NoteWriteAnswer> => {
    const title = made.title.trim()
    const entry = made.role === 'entry'
    const stamp = made.stamp ?? ''
    const answer = await (isNew(made)
      ? notes.create(
          entry
            ? {
                role: 'entry',
                title,
                body: made.body,
                chapterId: made.chapterId,
              }
            : { role: 'chapter', title },
        )
      : notes.change(
          made.key,
          entry
            ? { title, body: made.body, chapterId: made.chapterId, stamp }
            : { title, stamp },
        ))
    if (!answer.ok) return answer
    const id = answer.id ?? made.key
    setDraft(held => (held?.key === made.key ? undefined : held))
    if (entry) {
      setToggled(held => ({ ...held, [id]: true }))
      setFocusTo({ summary: id })
    } else {
      setFocusTo({ chapter: id })
    }
    say(savedWords(live.current, role))
    return answer
  }
  const cancel = (made: NoteDraft) => {
    setDraft(held => (held?.key === made.key ? undefined : held))
    if (made.opener === 'edit' || made.opener === 'problem-edit') {
      setToggled(held => ({ ...held, [made.key]: true }))
    }
    setFocusTo({
      opener: made.opener,
      key: made.key,
      chapterId: made.started.chapterId,
    })
  }
  const resolve = async (
    note: { id: string; stamp: string },
    choice: NoteResolve['resolve'],
  ) => {
    setBusy(note.id)
    const answer = await notes.resolve(note.id, {
      resolve: choice,
      stamp: note.stamp,
    })
    setBusy(undefined)
    if (!answer.ok) say(noteRefusalWords(answer.reason, name))
  }

  const banner = view && notesBanner(view, { role, name })
  const writable = view?.canAdd === true
  const tooLarge = view?.withheld?.reason === 'tooLarge'
  const searching = query.trim() !== ''
  const shownEntries = searching
    ? entries.filter(entry =>
        matchesSearch([entry.title, texts.get(entry.id) ?? ''], query),
      )
    : entries
  const chapters = view?.chapters ?? []
  const shownChapters = searching
    ? chapters.filter(({ id }) =>
        shownEntries.some(({ chapterId }) => chapterId === id),
      )
    : chapters
  // After a delete: the next note in its place, else its chapter, else New note.
  const afterDelete = (entry: NoteEntryView): FocusTo => {
    const near = shownEntries.filter(
      ({ chapterId }) => chapterId === entry.chapterId,
    )
    const next = near[near.findIndex(({ id }) => id === entry.id) + 1]
    if (next) return { summary: next.id }
    if (entry.chapterId) return { chapter: entry.chapterId }
    return { opener: 'new', key: 'new', chapterId: null }
  }
  const { game } = seatWords(role)

  let content: ReactNode
  if (!view) {
    content = (
      <p className='text-sm text-text-secondary'>
        {state === 'failed'
          ? 'Notes couldn’t be loaded. Trying again…'
          : 'Loading notes…'}
      </p>
    )
  } else if (draft) {
    content =
      draft.role === 'chapter' ? (
        <ChapterForm
          key={draft.key}
          draft={draft}
          setDraft={setDraft}
          name={name}
          onSave={save}
          onCancel={() => cancel(draft)}
          opened={opened === draft.key}
        />
      ) : (
        <NoteEditor
          key={draft.key}
          draft={draft}
          setDraft={setDraft}
          chapters={chapters}
          name={name}
          preview={notes.preview}
          onSave={save}
          onCancel={() => cancel(draft)}
          opened={opened === draft.key}
        />
      )
  } else {
    const empty = entries.length === 0 && chapters.length === 0
    content = (
      <>
        {writable && (
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              data-note-opener='new'
              onClick={() => newNote(chapters.at(-1)?.id ?? null, 'new')}
              className='inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
            >
              <Plus aria-hidden className='size-4' />
              New note
            </button>
            <button
              type='button'
              data-note-opener='new-chapter'
              onClick={newChapter}
              className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
            >
              <NotebookPen aria-hidden className='size-4' />
              New chapter
            </button>
          </div>
        )}
        {entries.length > 0 && (
          <SearchField
            value={query}
            onChange={setQuery}
            label='Search notes'
            placeholder='Search notes'
          />
        )}
        {empty && (
          <p className='text-sm text-text-secondary'>
            No notes yet. Write down what happened, what you found and who you
            met.
          </p>
        )}
        {!empty && searching && shownEntries.length === 0 && (
          <p className='text-sm text-text-secondary'>
            No notes match “{query.trim()}”.
          </p>
        )}
        {!empty && (
          <NoteList
            chapters={shownChapters}
            entries={shownEntries}
            chaptered={chapters.length > 0}
            role={role}
            writable={writable}
            tooLarge={tooLarge}
            isOpen={entry => toggled[entry.id] ?? hasProblem(entry.state)}
            onToggle={(id, isOpen) =>
              setToggled(held =>
                held[id] === isOpen ? held : { ...held, [id]: isOpen },
              )
            }
            onNewIn={chapter => newNote(chapter.id, 'new-in')}
            onRename={rename}
            onEdit={edit}
            onDelete={setDeleting}
            onResolve={(note, choice) => void resolve(note, choice)}
            busy={busy}
          />
        )}
      </>
    )
  }

  return (
    <section
      ref={section}
      aria-labelledby={headingId}
      aria-busy={view ? undefined : true}
      className='flex flex-col'
    >
      <div className='flex flex-col gap-3'>
        <div className='flex flex-col gap-1'>
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className={clsx(
              'outline-none',
              look === 'sheet'
                ? 'text-xs font-semibold tracking-wider text-text-secondary uppercase'
                : 'text-sm font-semibold',
            )}
          >
            Notes
          </h2>
          <p className='text-sm text-text-secondary'>
            {whoSeesNotes({ kind, role, name, journal: view?.journal })}
          </p>
        </div>
        {banner && (
          <p className='rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm'>
            {banner}
          </p>
        )}
        {content}
      </div>
      {/* What was done, said once: always in the section, so it's heard as it changes. */}
      <p
        aria-live='polite'
        aria-atomic='true'
        className='mt-3 text-sm text-text-secondary empty:mt-0'
      >
        {said && <span key={said.n}>{said.words}</span>}
      </p>
      <ConfirmModal
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        title={`Delete ${deleting?.title ?? ''}?`}
        confirmLabel='Delete'
        danger
        onConfirm={async () => {
          if (!deleting) return
          const next = afterDelete(deleting)
          const answer = await notes.remove(deleting.id, deleting.stamp)
          if (answer.ok) {
            say('Deleted.')
            setFocusTo(next)
          } else {
            say(noteRefusalWords(answer.reason, name))
            setFocusTo({ summary: deleting.id })
          }
        }}
      >
        <p>
          It’s deleted from Foundry’s journal too.
          {!view?.live && ` That happens when ${game} is next open.`}
        </p>
      </ConfirmModal>
    </section>
  )
}

/** Is the draft a note or chapter not yet made? */
function isNew(made: NoteDraft): boolean {
  return made.key === 'new' || made.key === 'new-chapter'
}

/** A note's text as it's searched: its Markdown where the seat has it, else what it draws. */
function searchText(entry: NoteEntryView): string {
  if (entry.body !== undefined) return entry.body
  return readDescription(entry.html)?.textContent ?? ''
}

/** What focus goes to, as it's drawn in the section now. */
function findFocus(root: HTMLElement, to: FocusTo): HTMLElement | undefined {
  const all = (selector: string) => [
    ...root.querySelectorAll<HTMLElement>(selector),
  ]
  if ('summary' in to) {
    return all('[data-note-summary]').find(
      ({ dataset }) => dataset.noteSummary === to.summary,
    )
  }
  if ('chapter' in to) {
    return all('[data-chapter-heading]').find(
      ({ dataset }) => dataset.chapterHeading === to.chapter,
    )
  }
  const openers = all(`[data-note-opener="${to.opener}"]`)
  switch (to.opener) {
    case 'new':
    case 'new-chapter': {
      return openers[0]
    }
    case 'new-in': {
      return openers.find(({ dataset }) => dataset.chapter === to.chapterId)
    }
    case 'rename': {
      return openers.find(({ dataset }) => dataset.chapter === to.key)
    }
    default: {
      return openers.find(
        ({ dataset }) => dataset.note === to.key || dataset.chapter === to.key,
      )
    }
  }
}
