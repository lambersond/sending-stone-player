/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
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
import { ChapterForm } from './chapter-form'
import { ChapterPane } from './chapter-pane'
import {
  Contents,
  ContentsButton,
  groupsOf,
  keyOf,
  type JournalGroup,
} from './contents'
import { EmptyJournal } from './empty-journal'
import { NoteEditor } from './note-editor'
import { NotePane } from './note-pane'
import { NoteTime } from './note-time'
import { Pane } from './pane'
import { ReorderPane } from './reorder-pane'
import { readDescription } from '@/components/character-sheet/description-html'
import { ConfirmModal, InPortalRoot, useDialogRoot } from '@/components/modal'
import { useKeyboardInset } from '@/hooks/use-keyboard-inset'
import { useModalDialog } from '@/hooks/use-modal-dialog'
import {
  journalTitle,
  noteChoiceRefusalWords,
  notesBanner,
  savedWords,
  whoSeesNotes,
  whoSeesShort,
} from '@/utils/note-words'
import { movedWords, orderSavedWords } from '@/utils/order-words'
import { matchesSearch } from '@/utils/search'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { NoteDraft, NotePick, useNotes } from '@/hooks/use-notes'
import type {
  NoteBookKind,
  NoteChapterView,
  NoteEntryView,
  NoteResolve,
  NotesView,
  NoteWriteAnswer,
} from '@/types/notes'

/** How long the header says what was done, in milliseconds, before it clears itself. */
const SAID_FOR = 6000

/**
 * What the header says last: what was done, or why it wasn't, which is drawn as a warning, not
 * with a success's check. `n` counts what's said, so the same words said again are new.
 */
type Said = { words: string; refused: boolean; n: number }

/** Below this width of the modal, the contents are a drawer. */
const NARROW = 640

/**
 * Below this height of the modal, its header, a pane's bar and its footer leave the fields between
 * too little room, as above a phone's keyboard turned sideways: it scrolls as a whole instead,
 * the reader as tall as this, its footer kept in view.
 */
const SHORT = 320

type Notes = ReturnType<typeof useNotes>

type Props = {
  /** The book, as the card reads it. */
  notes: Notes
  role: SeatRole
  kind: NoteBookKind
  /** The book's character or party, as its words name it. */
  name: string
  open: boolean
  /** Closes it, the draft kept. */
  onClose: () => void
}

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
}: Readonly<Props>) {
  const ref = useModalDialog(open)
  const { root, attach } = useDialogRoot(ref)
  const titleId = useId()
  const inset = useKeyboardInset(open)
  // Shown once the dialog is, by the effect above that shows it.
  const [shown, setShown] = useState(false)
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

/** Where focus goes once what it goes to is drawn. */
type FocusTo =
  | { heading: true }
  | { contents: true }
  | { reorder: true }
  | { arrow: 'previous' | 'next' }
  | { opener: NoteDraft['opener']; key: string; chapterId: string | null }

/** A Reorder open: its group, and the group's stamp as it opened, which the new order is from. */
type Ordering = { chapterId: string | null; stamp: string }

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
}: Readonly<Omit<Props, 'open'> & { titleId: string }>) {
  const { view, state, draft, setDraft, setPick } = notes
  const pick = notes.open?.pick
  const ids = useId()
  const contentsId = `${ids}-contents`
  const container = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [short, setShort] = useState(false)
  const [ordering, setOrdering] = useState<Ordering>()
  const [focusTo, setFocusTo] = useState<FocusTo>()
  const [said, setSaid] = useState<Said>()
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

  // The modal's own size, not the screen's: below 640 px wide the contents are a drawer, inert
  // while it's closed; below 320 px tall it scrolls as a whole. Measured as it's drawn, and as it
  // changes, as a phone turns or a keyboard comes up.
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = ({ width, height }: { width: number; height: number }) => {
      // Not laid out yet: nothing to go by.
      if (width > 0) setNarrow(width < NARROW)
      if (height > 0) setShort(height < SHORT)
    }
    measure(element.getBoundingClientRect())
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  // Grown past it, the contents are a pane again, and no drawer is open.
  useEffect(() => {
    if (!narrow) setDrawer(false)
  }, [narrow])
  // Turned short, as a keyboard comes up under the field being typed in, the journal scrolls from
  // its top: the field is brought back into view, above the footer.
  useLayoutEffect(() => {
    const focused = document.activeElement
    if (short && focused && container.current?.contains(focused)) {
      focused.scrollIntoView?.({ block: 'nearest' })
    }
  }, [short])

  // What the header says clears itself a while after.
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(undefined), SAID_FOR)
    return () => clearTimeout(timer)
  }, [said])

  // Focus moves once what it goes to is drawn: the editor's opener is drawn again as it closes,
  // and a pane replaced by another takes its controls with it. It waits for Delete's confirm to
  // close, as the page behind a modal dialog takes no focus; a passive effect, so the confirm,
  // closing in the same commit, has given focus back first.
  useEffect(() => {
    if (!focusTo || draft || deleting) return
    const root = container.current
    const target = root ? findFocus(root, focusTo) : undefined
    target?.focus()
    setFocusTo(undefined)
  }, [focusTo, draft, deleting])

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
  const searching = query.trim() !== ''
  const hits = searching
    ? new Set(
        order
          .filter(entry =>
            matchesSearch([entry.title, texts.get(entry.id) ?? ''], query),
          )
          .map(({ id }) => id),
      )
    : undefined

  // The reading order as last drawn, to find what follows a note that has left the view.
  const drawn = useRef<NoteEntryView[]>([])
  const shownNow = groups
    ? showing({ pick, groups, order, before: drawn.current, draft })
    : undefined
  const note = shownNow?.note
  const group = shownNow?.group
  useEffect(() => {
    if (groups) drawn.current = order
  })
  // What the reader settled on is kept, so a card mounted again shows the same: the most
  // recently changed note it opened on, or what follows a note gone since.
  const keep = shownNow?.keep ? shownNow.pick : undefined
  useEffect(() => {
    if (keep) setPick(keep)
  }, [keep, setPick])

  const chapters = view?.chapters ?? []
  const canAdd = view?.canAdd === true
  const tooLarge = view?.withheld?.reason === 'tooLarge'
  const ordered =
    ordering &&
    groups?.find(({ chapterId }) => chapterId === ordering.chapterId)
  // A group gone meanwhile, as a chapter deleted in Foundry, takes its Reorder with it.
  useEffect(() => {
    if (ordering && groups && !ordered) setOrdering(undefined)
  }, [ordering, groups, ordered])

  const say = (words: string, refused = false) =>
    setSaid(held => ({ words, refused, n: (held?.n ?? 0) + 1 }))
  // Why a change wasn't made: said as a warning.
  const refuse = (words: string) => say(words, true)
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
    const title = made.title.trim()
    const entry = made.role === 'entry'
    const stamp = made.stamp ?? ''
    const answer = await send(() =>
      isNew(made)
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
          ),
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
  // After a delete, the next note in reading order, else the one before, else its group's page.
  const afterDelete = (entry: NoteEntryView): NotePick => {
    const at = order.findIndex(({ id }) => id === entry.id)
    const near = order[at + 1] ?? order[at - 1]
    if (near && near.id !== entry.id) return { note: near.id }
    return { group: groupOfNote(groups, entry)?.chapterId ?? null }
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
        shown={
          hits ? group.entries.filter(({ id }) => hits.has(id)) : group.entries
        }
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
          setOrdering({ chapterId: group.chapterId, stamp: group.order.stamp })
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

  let locked: 'editing' | 'ordering' | undefined
  if (draft) locked = 'editing'
  else if (ordering) locked = 'ordering'
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
              draftNote={
                draft?.role === 'entry' && !isNew(draft) ? draft.key : undefined
              }
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
          const next = afterDelete(deleting)
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
  notes: Notes
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
          className='-mt-1 -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
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

/**
 * What the reader shows (round 0.35.0 §8.7): the note or group picked; for a note picked that has
 * left the view, the next in reading order as it was, else the one before, else its group's page;
 * with nothing picked, the draft's note where the draft is a change to one, else the most recently
 * changed note, else the last group listed. `keep` where that's to be kept as the pick.
 */
function showing({
  pick,
  groups,
  order,
  before,
  draft,
}: {
  pick?: NotePick
  groups: JournalGroup[]
  order: NoteEntryView[]
  before: NoteEntryView[]
  draft?: NoteDraft
}):
  | {
      pick: NotePick
      note?: NoteEntryView
      group?: JournalGroup
      keep: boolean
    }
  | undefined {
  const at = (next: NotePick, keep: boolean) => {
    if ('note' in next) {
      const note = order.find(({ id }) => id === next.note)
      return note && { pick: next, note, keep }
    }
    const group = groups.find(({ chapterId }) => chapterId === next.group)
    return group && { pick: next, group, keep }
  }
  if (pick) {
    const picked = at(pick, false)
    if (picked) return picked
    // A note picked that has left the view gives way to what was near it.
    if ('note' in pick) {
      const instead = near(pick.note, order, before, groups)
      if (instead) return at(instead, true)
      // Never drawn, as a note saved here whose read hasn't come: it's shown once it comes.
      const first = fallback(groups, order, draft)
      return first && at(first, false)
    }
  }
  const first = fallback(groups, order, draft)
  return first && at(first, true)
}

/** With nothing picked: the draft's note, the most recently changed note, or the last group. */
function fallback(
  groups: JournalGroup[],
  order: NoteEntryView[],
  draft?: NoteDraft,
): NotePick | undefined {
  if (draft?.role === 'entry' && order.some(({ id }) => id === draft.key)) {
    return { note: draft.key }
  }
  let latest: NoteEntryView | undefined
  for (const entry of order) {
    if (
      !latest ||
      Date.parse(entry.modifiedAt) > Date.parse(latest.modifiedAt)
    ) {
      latest = entry
    }
  }
  if (latest) return { note: latest.id }
  const listed = groups.filter(
    ({ chapterId, entries }) => chapterId !== null || entries.length > 0,
  )
  const last = listed.at(-1)
  return last && { group: last.chapterId }
}

/** What follows a note gone from the view: the next as it was, the one before, or its group. */
function near(
  id: string,
  order: NoteEntryView[],
  before: NoteEntryView[],
  groups: JournalGroup[],
): NotePick | undefined {
  const at = before.findIndex(entry => entry.id === id)
  if (at === -1) return
  const here = new Set(order.map(entry => entry.id))
  const next = before.slice(at + 1).find(entry => here.has(entry.id))
  if (next) return { note: next.id }
  const previous = before.slice(0, at).findLast(entry => here.has(entry.id))
  if (previous) return { note: previous.id }
  const { chapterId } = before[at]
  return {
    group: groups.some(group => group.chapterId === chapterId)
      ? chapterId
      : null,
  }
}

/** The group a note is in. */
function groupOfNote(
  groups: JournalGroup[] | undefined,
  entry: NoteEntryView,
): JournalGroup | undefined {
  return groups?.find(({ entries }) => entries.includes(entry))
}

/** Is the draft held now the one on its way, just as it was sent? */
function isSent(held: NoteDraft | undefined, made: NoteDraft): boolean {
  return (
    held?.saving === true &&
    held.key === made.key &&
    held.title === made.title &&
    held.body === made.body &&
    held.chapterId === made.chapterId
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

/**
 * What focus goes to, as it's drawn in the journal now: where it's gone, or inside the closed
 * drawer, which is inert, the reader's heading, else the journal's.
 */
function findFocus(root: HTMLElement, to: FocusTo): HTMLElement | undefined {
  const all = (selector: string) => [
    ...root.querySelectorAll<HTMLElement>(selector),
  ]
  let target: HTMLElement | undefined
  if ('heading' in to) target = undefined
  else if ('contents' in to) target = all('[data-contents-button]')[0]
  else if ('reorder' in to) target = all('[data-reorder]')[0]
  else if ('arrow' in to) {
    target = all(
      `[aria-label="${to.arrow === 'next' ? 'Next note' : 'Previous note'}"]:not(:disabled)`,
    )[0]
  } else {
    const openers = all(`[data-note-opener="${to.opener}"]`)
    switch (to.opener) {
      case 'new':
      case 'new-chapter': {
        target = openers[0]
        break
      }
      case 'new-in': {
        target = openers.find(
          ({ dataset }) => dataset.chapter === (to.chapterId ?? ''),
        )
        break
      }
      case 'rename': {
        target = openers.find(({ dataset }) => dataset.chapter === to.key)
        break
      }
      default: {
        target = openers.find(
          ({ dataset }) =>
            dataset.note === to.key || dataset.chapter === to.key,
        )
      }
    }
  }
  // A closed drawer's controls are inert: its Contents button stands for them.
  if (target?.closest('[inert]')) target = all('[data-contents-button]')[0]
  return (
    target ??
    all('[data-reader-heading]')[0] ??
    root.querySelector<HTMLElement>('h2') ??
    undefined
  )
}
