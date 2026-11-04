'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import {
  BookOpen,
  Check,
  Clock,
  Cloud,
  CloudOff,
  LoaderCircle,
  Lock,
  PenLine,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import { ChapterForm } from '../chapter-form/chapter-form'
import { ChapterPane } from '../chapter-pane/chapter-pane'
import { Contents } from '../contents/contents'
import { EmptyJournal } from '../empty-journal/empty-journal'
import { NoteEditor } from '../note-editor/note-editor'
import { NotePane } from '../note-pane/note-pane'
import { NoteTime } from '../note-time/note-time'
import { Pane } from '../pane/pane'
import { ReorderPane } from '../reorder-pane/reorder-pane'
import { ConfirmModal } from '@/components/modal/confirm-modal'
import { InPortalRoot } from '@/components/modal/in-portal-root'
import { useDialogRoot } from '@/components/modal/use-dialog-root'
import { ContentsButton } from '@/features/notes/components/contents/contents-button'
import { JOURNAL_ICON_BUTTON } from '@/features/notes/constants'
import { useFocusTo } from '@/features/notes/hooks/use-focus-to'
import { useJournalLayout } from '@/features/notes/hooks/use-journal-layout'
import { useKeyboardInset } from '@/features/notes/hooks/use-keyboard-inset'
import { useOrdering } from '@/features/notes/hooks/use-ordering'
import { useReaderPick } from '@/features/notes/hooks/use-reader-pick'
import { useSaid } from '@/features/notes/hooks/use-said'
import { changeOf, inputOf } from '@/features/notes/utils/editor'
import { groupsOf, keyOf } from '@/features/notes/utils/groups'
import {
  journalTitle,
  noteChoiceRefusalWords,
  notesBanner,
  savedWords,
  whoSeesNotes,
  whoSeesShort,
} from '@/features/notes/utils/note-words'
import { movedWords, orderSavedWords } from '@/features/notes/utils/order-words'
import {
  hitsOf,
  groupOfNote,
  isNew,
  isSent,
  searchText,
  afterDelete,
  draftNoteOf,
  hitEntries,
  lockedBy,
} from '@/features/notes/utils/reader'
import { useModalDialog } from '@/hooks/use-modal-dialog'
import { seatWords } from '@/utils/seat-words'
import type { JournalModalProps, JournalNotes } from './types'
import type {
  JournalGroup,
  NoteDraft,
  NotePick,
  Said,
} from '@/features/notes/types'
import type {
  NoteChapterView,
  NoteEntryView,
  NoteResolve,
  NotesView,
  NoteWriteAnswer,
} from '@/types/notes'
import type { SeatRole } from '@/types/seats'

/**
 * A journal, opened from its card (round 0.35.0 §8.4): a modal dialog, the browser's own, which
 * keeps focus inside it and makes the page behind it inert; full screen below 640 px of screen,
 * at most 960 × 880 from there, and above an on-screen keyboard. Its content is mounted only while
 * it's open, and only once the dialog shows, so the focus it takes as it mounts lands in it: each
 * opening starts afresh, its search, shut groups, drawer and half-made order gone, but for what
 * the page's store keeps, the draft and what the reader shows while it's open.
 */
export function JournalModal({
  notes,
  role,
  kind,
  name,
  open,
  onClose,
}: Readonly<JournalModalProps>) {
  const ref = useModalDialog(open)
  const { root, attach } = useDialogRoot(ref)
  const titleId = useId()
  const inset = useKeyboardInset(open)
  // Shown once the dialog is, by the effect above that shows it: a commit later, so that its
  // transition runs.
  const [shown, setShown] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a commit after it opens
  useEffect(() => setShown(open), [open])

  return (
    <dialog
      ref={attach}
      aria-labelledby={titleId}
      // Escape closes the dialog itself; this keeps the store in step. Only its own close: React
      // hands it the close of a dialog opened inside it, as Delete's, too.
      onClose={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      // A click on the dialog element, rather than its content, is a click on the backdrop.
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={inset}
      className='m-0 h-dvh max-h-none w-full max-w-none overflow-hidden rounded-none border-0 bg-card p-0 text-text-primary shadow-2xl backdrop:bg-black/50 motion-safe:animate-journal-pop sm:m-auto sm:h-[min(880px,calc(100dvh-4rem))] sm:min-h-[min(600px,calc(100dvh-1rem))] sm:w-[min(960px,calc(100%-2rem))] sm:rounded-2xl sm:border sm:border-border'
    >
      {open && shown && (
        <InPortalRoot root={root}>
          <Journal
            notes={notes}
            role={role}
            kind={kind}
            name={name}
            titleId={titleId}
            onClose={onClose}
          />
        </InPortalRoot>
      )}
    </dialog>
  )
}

/**
 * The journal's content: its header and banner, and its body, the contents and the reader, or the
 * empty journal. What the reader shows is kept in the store with `open`, so a card mounted again
 * shows the same; the rest is this opening's own.
 */
function Journal({
  notes,
  role,
  kind,
  name,
  titleId,
  onClose,
}: Readonly<Omit<JournalModalProps, 'open'> & { titleId: string }>) {
  const { view, state, draft, setDraft, setPick } = notes
  const pick = notes.open?.pick
  const ids = useId()
  const contentsId = `${ids}-contents`
  const container = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState(0)
  const [deleting, setDeleting] = useState<NoteEntryView>()
  // The note, chapter or order (`order:<key>`) a choice is on its way for, and the note moving.
  const [busy, setBusy] = useState<string>()
  const [moving, setMoving] = useState<string>()
  // Whether the game is live as the book was last read, for words said once a change is answered.
  const live = useRef(view?.live ?? false)
  useLayoutEffect(() => {
    if (view) live.current = view.live
  }, [view])

  // Opened, focus goes to its title, unless the editor took it, as it does with a draft open.
  useLayoutEffect(() => {
    if (!container.current?.contains(document.activeElement)) {
      heading.current?.focus()
    }
  }, [])
  const { drawer, setDrawer, narrow, short } = useJournalLayout(container)
  const { said, say, refuse } = useSaid()
  const setFocusTo = useFocusTo(container, draft, deleting)

  const groups = useMemo(() => (view ? groupsOf(view) : undefined), [view])
  // Reading order: every group's notes, loose first, as the contents list them.
  const order = useMemo(
    () => groups?.flatMap(({ entries }) => entries) ?? [],
    [groups],
  )
  const texts = useMemo(
    () => new Map(order.map(entry => [entry.id, searchText(entry)])),
    [order],
  )
  const hits = hitsOf(order, texts, query)
  const { shownNow, note, group } = useReaderPick({
    pick,
    groups,
    order,
    draft,
    setPick,
  })

  const chapters = view?.chapters ?? []
  const canAdd = view?.canAdd === true
  const tooLarge = view?.withheld?.reason === 'tooLarge'
  const { ordering, setOrdering, ordered } = useOrdering(groups)
  const send = async (work: () => Promise<NoteWriteAnswer>) => {
    setSending(held => held + 1)
    try {
      return await work()
    } finally {
      setSending(held => held - 1)
    }
  }
  const closeDrawer = () => {
    setDrawer(false)
    setFocusTo({ contents: true })
  }
  const choose = (next: NotePick) => {
    setPick(next)
    if (drawer) closeDrawer()
  }
  const begin = (next: Omit<NoteDraft, 'started' | 'focus'>) => {
    setDrawer(false)
    setDraft({
      ...next,
      started: {
        title: next.title,
        body: next.body,
        chapterId: next.chapterId,
      },
      focus: { field: 'title' },
    })
  }
  const newNote = (chapterId: string | null, opener: 'new' | 'new-in') =>
    begin({ key: 'new', role: 'entry', title: '', body: '', chapterId, opener })
  const newChapter = () =>
    begin({
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
    begin({
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
    begin({
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
    const entry = made.role === 'entry'
    const answer = await send(() =>
      isNew(made)
        ? notes.create(inputOf(made))
        : notes.change(made.key, changeOf(made)),
    )
    if (!answer.ok) return answer
    const id = answer.id ?? made.key
    // Only the draft sent, as it was sent: never one opened or typed in since.
    setDraft(held => (isSent(held, made) ? undefined : held))
    // The reader shows what was saved.
    setPick(entry ? { note: id } : { group: id })
    setFocusTo({ heading: true })
    say(savedWords(live.current, role))
    return answer
  }
  const cancel = (made: NoteDraft) => {
    setDraft(held => (held?.key === made.key ? undefined : held))
    setFocusTo({
      opener: made.opener,
      key: made.key,
      chapterId: made.started.chapterId,
    })
  }
  const resolve = async (
    target: { id: string; stamp: string },
    choice: NoteResolve['resolve'],
  ) => {
    setBusy(target.id)
    const answer = await send(() =>
      notes.resolve(target.id, { resolve: choice, stamp: target.stamp }),
    )
    setBusy(undefined)
    if (!answer.ok) refuse(noteChoiceRefusalWords(answer.reason, name))
  }
  const resolveOrder = async (
    held: JournalGroup,
    choice: NoteResolve['resolve'],
  ) => {
    setBusy(`order:${keyOf(held.chapterId)}`)
    const answer = await send(() =>
      notes.resolveOrder({
        chapterId: held.chapterId,
        resolve: choice,
        stamp: held.order.stamp,
      }),
    )
    setBusy(undefined)
    if (!answer.ok) refuse(noteChoiceRefusalWords(answer.reason, name))
  }
  const move = async (entry: NoteEntryView, chapterId: string | null) => {
    setMoving(entry.id)
    const answer = await send(() =>
      notes.change(entry.id, {
        title: entry.title,
        chapterId,
        stamp: entry.stamp,
      }),
    )
    setMoving(undefined)
    if (answer.ok) {
      const to = chapters.find(({ id }) => id === chapterId)
      say(movedWords(to?.title ?? null))
    } else {
      refuse(noteChoiceRefusalWords(answer.reason, name))
    }
    // Its button was off while it moved, and is gone where it left the page shown.
    setFocusTo({ heading: true })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Escape that nothing inside took, from this dialog's own content, closes an open drawer
    // first: the key is prevented, so the browser makes no request to close the dialog.
    if (event.key !== 'Escape' || event.defaultPrevented || !drawer) return
    const { isComposing, keyCode } = event.nativeEvent
    if (isComposing || keyCode === 229) return
    const from = event.target as Element
    if (from.closest('dialog') !== container.current?.closest('dialog')) return
    event.preventDefault()
    closeDrawer()
  }

  const contentsButton = (
    <ContentsButton
      controls={contentsId}
      open={drawer}
      onOpen={() => setDrawer(true)}
    />
  )
  const empty =
    view !== undefined && view.entries.length === 0 && chapters.length === 0
  const editor = draft && (
    // Keyed by the draft, so another one opened starts afresh.
    <Editor
      key={draft.key}
      draft={draft}
      notes={notes}
      chapters={chapters}
      name={name}
      onSave={save}
      onCancel={() => cancel(draft)}
    />
  )
  let reader: ReactNode
  if (!view) {
    reader = (
      <Pane bar={contentsButton}>
        <SkeletonPage />
      </Pane>
    )
  } else if (editor) {
    reader = editor
  } else if (ordering && ordered) {
    reader = (
      <ReorderPane
        title={ordered.title}
        entries={ordered.entries}
        kind={kind}
        name={name}
        onSave={async ids => {
          const answer = await send(() =>
            notes.reorder({
              chapterId: ordering.chapterId,
              ids,
              // The stamp as Reorder opened: an order made meanwhile is never overwritten unseen.
              stamp: ordering.stamp,
            }),
          )
          if (answer.ok) {
            setOrdering(undefined)
            setFocusTo({ reorder: true })
            say(
              orderSavedWords({
                live: live.current,
                orders: view.orders,
                role,
              }),
            )
          }
          return answer
        }}
        onCancel={() => {
          setOrdering(undefined)
          setFocusTo({ reorder: true })
        }}
      />
    )
  } else if (note && groups) {
    const held = groupOfNote(groups, note)
    reader = held && (
      <NotePane
        // Keyed by the note, so another one starts at its top.
        key={note.id}
        entry={note}
        group={held}
        order={order}
        chapters={chapters}
        role={role}
        canAdd={canAdd}
        tooLarge={tooLarge}
        contents={contentsButton}
        onPick={(next, from) => {
          setPick(next)
          setFocusTo(from ? { arrow: from } : { heading: true })
        }}
        onEdit={opener => edit(note, opener)}
        onDelete={() => setDeleting(note)}
        onMove={chapterId => void move(note, chapterId)}
        onResolve={choice => void resolve(note, choice)}
        moving={moving === note.id}
        busy={busy === note.id}
      />
    )
  } else if (group) {
    reader = (
      <ChapterPane
        key={keyOf(group.chapterId)}
        group={group}
        query={query}
        shown={hitEntries(group, hits)}
        chapters={chapters}
        role={role}
        canAdd={canAdd}
        canReorder={view.canReorder}
        drafting={draft !== undefined}
        tooLarge={tooLarge}
        contents={contentsButton}
        onPick={next => {
          setPick(next)
          setFocusTo({ heading: true })
        }}
        onRename={opener => group.chapter && rename(group.chapter, opener)}
        onNewIn={() => newNote(group.chapterId, 'new-in')}
        onReorder={() =>
          setOrdering({
            chapterId: group.chapterId,
            stamp: group.order.stamp,
          })
        }
        onResolve={choice => {
          if (group.chapter) void resolve(group.chapter, choice)
        }}
        onResolveOrder={choice => void resolveOrder(group, choice)}
        onMove={(entry, chapterId) => void move(entry, chapterId)}
        moving={moving}
        busy={group.chapter !== undefined && busy === group.chapter.id}
        orderBusy={busy === `order:${keyOf(group.chapterId)}`}
      />
    )
  }

  const locked = lockedBy(draft, ordering)
  const banner = view && notesBanner(view, { role, name })
  const { game } = seatWords(role)

  return (
    <div
      ref={container}
      onKeyDown={onKeyDown}
      className={clsx(
        '@container flex h-full flex-col',
        // Too short for its parts, it scrolls as one, what's revealed kept clear of the footer.
        short && 'overflow-y-auto overscroll-contain scroll-pb-20',
      )}
    >
      <Header
        titleId={titleId}
        heading={heading}
        title={journalTitle({ kind, role, name })}
        who={whoSeesShort({ kind, role, name })}
        whoAll={whoSeesNotes({ kind, role, name, journal: view?.journal })}
        party={kind === 'party'}
        view={view}
        role={role}
        failing={state === 'failed'}
        sending={sending > 0}
        said={said}
        onClose={onClose}
      />
      {banner && (
        <p className='shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm @min-[640px]:px-5'>
          {banner}
        </p>
      )}
      <div
        className={clsx(
          'relative flex',
          // Short, the reader keeps the height its fields need, and its footer, Cancel and Save
          // in the editor, stays at the bottom of what shows as the rest scrolls under it.
          short
            ? 'h-80 shrink-0 [&>*>.border-t.bg-card:last-child]:sticky [&>*>.border-t.bg-card:last-child]:bottom-0 [&>*>.border-t.bg-card:last-child]:z-10'
            : 'min-h-0 flex-1',
        )}
      >
        {empty ? (
          (editor ?? (
            <EmptyJournal
              canAdd={canAdd}
              onNewNote={() => newNote(null, 'new')}
              onNewChapter={newChapter}
            />
          ))
        ) : (
          <>
            <Contents
              id={contentsId}
              groups={groups}
              query={query}
              onQuery={setQuery}
              hits={hits}
              shown={shownNow?.pick}
              draftNote={draftNoteOf(draft)}
              locked={locked}
              canAdd={canAdd}
              narrow={narrow}
              drawer={drawer}
              onCloseDrawer={closeDrawer}
              onPick={choose}
              onNewNote={chapterId => newNote(chapterId, 'new')}
              onNewChapter={newChapter}
            />
            {reader}
          </>
        )}
      </div>
      <ConfirmModal
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        title={`Delete ${deleting?.title ?? ''}?`}
        confirmLabel='Delete'
        danger
        onConfirm={async () => {
          if (!deleting) return
          const next = afterDelete(order, groups, deleting)
          const answer = await send(() =>
            notes.remove(deleting.id, deleting.stamp),
          )
          if (answer.ok) {
            say('Deleted.')
            setPick(next)
          } else {
            refuse(noteChoiceRefusalWords(answer.reason, name))
          }
          setFocusTo({ heading: true })
        }}
      >
        <p>
          It’s deleted from Foundry’s journal too.
          {!view?.live && ` That happens when ${game} is next open.`}
        </p>
      </ConfirmModal>
    </div>
  )
}

/** The editor or the chapter form, as the draft is a note's or a chapter's. */
function Editor({
  draft,
  notes,
  chapters,
  name,
  onSave,
  onCancel,
}: Readonly<{
  draft: NoteDraft
  notes: JournalNotes
  chapters: NoteChapterView[]
  name: string
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  onCancel: () => void
}>) {
  return draft.role === 'chapter' ? (
    <ChapterForm
      draft={draft}
      setDraft={notes.setDraft}
      name={name}
      onSave={onSave}
      onCancel={onCancel}
    />
  ) : (
    <NoteEditor
      draft={draft}
      setDraft={notes.setDraft}
      chapters={chapters}
      name={name}
      preview={notes.preview}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

/**
 * The journal's own details, whatever the reader shows (round 0.35.0 §8.5): its name, whether it
 * can be written in, who sees it, whether it's up to date with Foundry, its last change by anyone,
 * and what's loading, on its way or just done; Close; and a bar along its edge while it works.
 */
function Header({
  titleId,
  heading,
  title,
  who,
  whoAll,
  party,
  view,
  role,
  failing,
  sending,
  said,
  onClose,
}: Readonly<{
  titleId: string
  heading: RefObject<HTMLHeadingElement | null>
  title: string
  /** Who sees it, in short; and the whole sentence, as its title. */
  who: string
  whoAll: string
  party: boolean
  view?: NotesView
  role: SeatRole
  /** Reading it fails before it was ever read. */
  failing: boolean
  sending: boolean
  said?: Said
  onClose: () => void
}>) {
  const working = !view || sending
  let status: ReactNode
  if (!view) {
    status = (
      <>
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
        {failing ? 'Notes couldn’t be loaded. Trying again…' : 'Loading notes…'}
      </>
    )
  } else if (sending) {
    status = (
      <>
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
        Sending…
      </>
    )
  } else if (said?.refused) {
    // Not done: a warning, never the check a change that was made has.
    status = (
      <span
        key={said.n}
        className='inline-flex items-center gap-1 font-medium text-warning'
      >
        <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
        {said.words}
      </span>
    )
  } else if (said) {
    status = (
      <span
        key={said.n}
        className='inline-flex items-center gap-1 font-medium text-primary-text'
      >
        <Check aria-hidden className='size-3.5' />
        {said.words}
      </span>
    )
  }
  return (
    <header className='relative shrink-0 border-b border-border'>
      {/* Full screen, below `sm`, clear of a phone's notch. */}
      <div className='flex items-start gap-3 px-4 pt-3 pb-2.5 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))] @min-[640px]:px-5 @min-[640px]:pt-4 @min-[640px]:pb-3'>
        <span className='mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text @min-[640px]:flex'>
          <BookOpen aria-hidden className='size-5' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <h2
              ref={heading}
              id={titleId}
              tabIndex={-1}
              className='truncate text-lg leading-tight font-semibold outline-none'
            >
              {title}
            </h2>
            {view && !view.canAdd && (
              <span className='inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-secondary'>
                <Lock aria-hidden className='size-3' />
                Read only
              </span>
            )}
          </div>
          <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary'>
            <span title={whoAll} className='inline-flex items-center gap-1'>
              {party ? (
                <Users aria-hidden className='size-3.5' />
              ) : (
                <Lock aria-hidden className='size-3.5' />
              )}
              {who}
            </span>
            {view && <SyncStatus view={view} role={role} />}
            {view?.lastChange && (
              <span
                title='The last change to anything in this journal, by anyone: a note or chapter added, changed, moved, reordered or deleted'
                className='inline-flex items-center gap-1'
              >
                <PenLine aria-hidden className='size-3.5' />
                <span>
                  Last changed by {view.lastChange.by},{' '}
                  <NoteTime value={view.lastChange.at} />
                </span>
              </span>
            )}
            {/* What's loading, on its way or just done: no status of its own, as the page's one
                status is whether the game is live. */}
            <span
              aria-live='polite'
              className='inline-flex items-center gap-1 empty:hidden'
            >
              {status}
            </span>
          </div>
        </div>
        <button
          type='button'
          aria-label='Close'
          onClick={onClose}
          className={`-mt-1 -mr-1.5 ${JOURNAL_ICON_BUTTON}`}
        >
          <X aria-hidden className='size-5' />
        </button>
      </div>
      {working && (
        <div
          aria-hidden
          className='absolute inset-x-0 -bottom-px h-0.5 overflow-hidden'
        >
          <div className='h-full w-2/5 rounded-full bg-primary motion-safe:animate-journal-bar motion-reduce:opacity-40' />
        </div>
      )}
    </header>
  )
}

/** Whether the journal is up to date with Foundry, or what keeps it from being. */
function SyncStatus({
  view,
  role,
}: Readonly<{ view: NotesView; role: SeatRole }>) {
  const { game } = seatWords(role)
  const notes = [...view.entries, ...view.chapters]
  const waiting =
    notes.filter(({ state }) => state === 'waiting' || state === 'deleting')
      .length + view.groups.filter(({ state }) => state === 'waiting').length
  if (!view.live) {
    return (
      <span
        title={`Changes are kept here and reach Foundry when ${game} is next open.`}
        className='inline-flex items-center gap-1 font-medium text-warning'
      >
        <CloudOff aria-hidden className='size-3.5' />
        Game closed{waiting > 0 && ` · ${waiting} waiting`}
      </span>
    )
  }
  if (
    notes.some(({ state }) => state === 'saving') ||
    view.groups.some(({ state }) => state === 'saving')
  ) {
    return (
      <span className='inline-flex items-center gap-1'>
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
        Saving to the game…
      </span>
    )
  }
  // An order kept for a module before 0.35.0, which never takes it.
  if (view.groups.some(({ state }) => state === 'waiting')) {
    return (
      <span
        title={`The new order reaches Foundry once ${game} connects with Sending Stone 0.35.0 or later.`}
        className='inline-flex items-center gap-1'
      >
        <Clock aria-hidden className='size-3.5' />
        {waiting} waiting
      </span>
    )
  }
  return (
    <span
      title='Up to date with Foundry'
      className='inline-flex items-center gap-1'
    >
      <Cloud aria-hidden className='size-3.5' />
      <span className='@max-[479px]:hidden'>Up to date with Foundry</span>
      <span className='@min-[480px]:hidden'>Synced</span>
    </span>
  )
}

/** A page of bars where a note will be, while the book loads. */
function SkeletonPage() {
  return (
    <div
      aria-hidden
      className='mx-auto flex w-full max-w-[44rem] flex-col gap-3 px-4 py-6 @min-[640px]:px-8'
    >
      {['30%', '62%', '96%', '88%', '92%', '70%', '94%', '81%'].map(
        (width, index) => (
          <div
            key={width}
            style={{ width }}
            className={`${index === 1 ? 'h-6' : 'h-3'} rounded-full bg-border motion-safe:animate-pulse`}
          />
        ),
      )}
    </div>
  )
}
