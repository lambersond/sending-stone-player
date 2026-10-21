/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
'use client'

import {
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
import { LoaderCircle } from 'lucide-react'
import { flushSync } from 'react-dom'
import {
  drawDescription,
  readDescription,
} from '@/components/character-sheet/description-html'
import { ConfirmModal } from '@/components/modal'
import { MOST_NOTE_BODY, MOST_NOTE_TITLE } from '@/constants/notes'
import {
  draftChanged,
  type DraftChange,
  type NoteDraft,
} from '@/hooks/use-notes'
import { bigHeadings } from '@/utils/note-headings'
import { noteRefusalWords } from '@/utils/note-words'
import type { NoteChapterView, NoteWriteAnswer } from '@/types/notes'

/** From how many characters a note's count shows under it, as it nears the most it may hold. */
const COUNT_FROM = 18_000

/** The most heading hints listed one by one, before the rest are counted. */
const MOST_HINTS = 3

type Props = {
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  /** The book's chapters, oldest first, for the note to be put in one. */
  chapters: NoteChapterView[]
  /** The book's character or party, as a refusal names it. */
  name: string
  preview: (
    body: string,
  ) => Promise<{ html: string; headings: number[] } | undefined>
  /** Sends the note; the section clears the draft once it's answered ok. */
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  /** Closes it, its changes discarded. */
  onCancel: () => void
  /** Opened by a button just now, rather than mounted again from the store: brought into view. */
  opened: boolean
}

/**
 * A note written or changed, in Foundry's Markdown, inline in the Notes section in place of its
 * list (round 0.34.0 §9.6): Cancel and Save in a row that sticks to the top of what scrolls, so
 * they stay in view with a phone's keyboard up; the chapter, the title, and the note, written or
 * previewed as the book will draw it. What's typed is the draft in the page's store, never this
 * editor's own, so it outlives the editor: another tab chosen, the sheet arriving or going, or the
 * party panel closed and opened again.
 */
export function NoteEditor({
  draft,
  setDraft,
  chapters,
  name,
  preview,
  onSave,
  onCancel,
  opened,
}: Readonly<Props>) {
  const ids = useId()
  const headingId = `${ids}-heading`
  const helpId = `${ids}-help`
  const hintId = `${ids}-hint`
  const form = useRef<HTMLFormElement>(null)
  const chapter = useRef<HTMLSelectElement>(null)
  const title = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [asking, setAsking] = useState(false)
  const [shown, setShown] = useState<Shown>()
  const writeTab = useRef<HTMLButtonElement>(null)
  const previewTab = useRef<HTMLButtonElement>(null)
  useDraftFocus({
    draft,
    setDraft,
    opened,
    form,
    fields: { chapter, title, body },
  })

  const update = (fields: Partial<NoteDraft>) =>
    setDraft(held =>
      held?.key === draft.key ? { ...held, ...fields, focus: undefined } : held,
    )
  const lines = useMemo(() => bigHeadings(draft.body), [draft.body])
  const hint = useMemo(
    () => headingHint(draft.body, lines),
    [draft.body, lines],
  )
  const count = draft.body.length
  const canSave =
    draft.title.trim() !== '' && count <= MOST_NOTE_BODY && !saving
  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(undefined)
    const answer = await onSave(draft)
    setSaving(false)
    // Kept, the section closes it; refused, it stays open with the text as typed.
    if (!answer.ok) setError(noteRefusalWords(answer.reason, name))
  }
  // Ctrl+Enter or ⌘+Enter saves from the fields, as Save does, for Save comes before them.
  const saveKey = (event: KeyboardEvent<HTMLElement>) => {
    const { isComposing, keyCode } = event.nativeEvent
    if (isComposing || keyCode === 229) return false
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return false
    event.preventDefault()
    void save()
    return true
  }
  const show = (next: 'write' | 'preview') => {
    setTab(next)
    if (next === 'preview' && shown?.body !== draft.body) {
      const asked = draft.body
      setShown({ body: asked })
      void preview(asked).then(rendered =>
        setShown(held =>
          held?.body === asked
            ? {
                body: asked,
                ...(rendered ? { html: rendered.html } : { failed: true }),
              }
            : held,
        ),
      )
    }
  }
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = tab === 'write' ? 'preview' : 'write'
    show(next)
    ;(next === 'write' ? writeTab : previewTab).current?.focus()
  }
  const cancel = () => {
    if (draftChanged(draft)) setAsking(true)
    else onCancel()
  }

  const heading =
    draft.key === 'new' ? 'New note' : `Edit ${draft.started.title}`
  return (
    <form
      ref={form}
      noValidate
      aria-labelledby={headingId}
      onSubmit={event => {
        event.preventDefault()
        void save()
      }}
      className='flex w-full max-w-3xl flex-col gap-3'
    >
      <EditorHeader
        id={headingId}
        heading={heading}
        saving={saving}
        canSave={canSave}
        onCancel={cancel}
      />
      {draft.role === 'entry' && chapters.length > 0 && (
        <label className='flex flex-col gap-1 text-sm font-medium'>
          Chapter
          <select
            ref={chapter}
            value={draft.chapterId ?? ''}
            onChange={event =>
              update({ chapterId: event.target.value || null })
            }
            className={clsx(FIELD, 'h-11')}
          >
            <option value=''>No chapter</option>
            {chapters.map(({ id, title: named }) => (
              <option key={id} value={id}>
                {named}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className='flex flex-col gap-1 text-sm font-medium'>
        Title
        <input
          ref={title}
          type='text'
          required
          maxLength={MOST_NOTE_TITLE}
          enterKeyHint='next'
          autoComplete='off'
          value={draft.title}
          onChange={event => update({ title: event.target.value })}
          onKeyDown={event => {
            if (saveKey(event)) return
            const { isComposing, keyCode } = event.nativeEvent
            if (event.key !== 'Enter' || isComposing || keyCode === 229) return
            // A phone's return key after the title goes on to the note, and never saves one with
            // no text yet.
            event.preventDefault()
            flushSync(() => setTab('write'))
            body.current?.focus()
          }}
          className={clsx(FIELD, 'h-11')}
        />
      </label>
      <div className='flex flex-col gap-1'>
        <div className='flex items-end justify-between gap-2'>
          <label htmlFor={`${ids}-body`} className='text-sm font-medium'>
            Note
          </label>
          <div role='tablist' aria-label='Write or preview' className='flex'>
            <TabButton
              ref={writeTab}
              id={`${ids}-tab-write`}
              panel={`${ids}-panel-write`}
              selected={tab === 'write'}
              onClick={() => show('write')}
              onKeyDown={onTabKey}
            >
              Write
            </TabButton>
            <TabButton
              ref={previewTab}
              id={`${ids}-tab-preview`}
              panel={`${ids}-panel-preview`}
              selected={tab === 'preview'}
              onClick={() => show('preview')}
              onKeyDown={onTabKey}
            >
              Preview
            </TabButton>
          </div>
        </div>
        <div
          id={`${ids}-panel-write`}
          role='tabpanel'
          aria-labelledby={`${ids}-tab-write`}
          hidden={tab !== 'write'}
        >
          <textarea
            ref={body}
            id={`${ids}-body`}
            rows={12}
            value={draft.body}
            aria-describedby={`${helpId} ${hintId}`}
            onChange={event => update({ body: event.target.value })}
            onKeyDown={saveKey}
            className={clsx(FIELD, 'w-full resize-y py-2 font-mono')}
          />
        </div>
        <div
          id={`${ids}-panel-preview`}
          role='tabpanel'
          aria-labelledby={`${ids}-tab-preview`}
          hidden={tab !== 'preview'}
          className='min-h-24 rounded-xl border border-border bg-card px-3 py-2'
        >
          {tab === 'preview' && <Preview shown={shown} />}
        </div>
        {count > COUNT_FROM && (
          <p
            className={clsx(
              'text-right text-xs tabular-nums',
              count > MOST_NOTE_BODY ? 'text-danger' : 'text-text-secondary',
            )}
          >
            {count.toLocaleString('en-US')} /{' '}
            {MOST_NOTE_BODY.toLocaleString('en-US')}
          </p>
        )}
        <p id={helpId} className='text-xs text-text-secondary'>
          Foundry’s Markdown: **bold**, *italic*, ### Heading, - list, &gt;
          quote, | table |, ~~strike~~. # and ## are the journal’s chapters and
          notes, so headings start at ###.
        </p>
        <p id={hintId} aria-live='polite' className='text-sm text-danger'>
          {hint}
        </p>
      </div>
      {error && (
        <p role='alert' className='text-sm text-danger'>
          {error}
        </p>
      )}
      <DiscardModal
        open={asking}
        onClose={() => setAsking(false)}
        onDiscard={onCancel}
      />
    </form>
  )
}

/** A field's look: 16px text, so iOS doesn't zoom into it as it takes focus. */
export const FIELD =
  'rounded-xl border border-border bg-page px-3 text-base font-normal outline-none focus:ring-2 focus:ring-primary/40'

/**
 * The editor's header row: its heading, then Cancel and Save. It sticks to the top of the nearest
 * box that scrolls, a card of its own so it reads the same over the page and over a panel; the
 * heading is cut short first, so the buttons never wrap off a narrow one.
 */
export function EditorHeader({
  id,
  heading,
  saving,
  canSave,
  onCancel,
}: Readonly<{
  id: string
  heading: string
  saving: boolean
  canSave: boolean
  onCancel: () => void
}>) {
  return (
    <div className='sticky top-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2'>
      <h3
        id={id}
        title={heading}
        className='min-w-0 flex-1 truncate font-semibold'
      >
        {heading}
      </h3>
      <button
        type='button'
        onClick={onCancel}
        className='min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
      >
        Cancel
      </button>
      <button
        type='submit'
        disabled={!canSave}
        className='inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
      >
        {saving && (
          <LoaderCircle
            aria-hidden
            className='size-4 motion-safe:animate-spin'
          />
        )}
        Save
      </button>
    </div>
  )
}

/** Asks before what was written is thrown away. */
export function DiscardModal({
  open,
  onClose,
  onDiscard,
}: Readonly<{ open: boolean; onClose: () => void; onDiscard: () => void }>) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title='Discard your changes?'
      confirmLabel='Discard'
      cancelLabel='Keep editing'
      onConfirm={async () => onDiscard()}
      danger
    >
      <p>What you wrote here isn’t saved.</p>
    </ConfirmModal>
  )
}

/**
 * Where focus goes as an editor mounts, and what's noted as it unmounts (§9.6): opened by a
 * button, it comes into view and its title takes focus; mounted again where focus was inside it,
 * as when the sheet arrives while the player types, focus and the caret go back. Its cleanup runs
 * while its fields are still in the page, so it can read where focus is; it changes the draft only
 * where it's still this editor's, never bringing back one just saved or discarded.
 */
export function useDraftFocus({
  draft,
  setDraft,
  opened,
  form,
  fields,
}: {
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  opened: boolean
  form: RefObject<HTMLFormElement | null>
  fields: {
    chapter?: RefObject<HTMLSelectElement | null>
    title: RefObject<HTMLInputElement | null>
    body?: RefObject<HTMLTextAreaElement | null>
  }
}): void {
  // As the editor mounts, from the draft it mounts with: the effect runs only then.
  const mounted = useRef({ draft, opened })
  useLayoutEffect(() => {
    const { draft: first, opened: byButton } = mounted.current
    const { key } = first
    if (byButton) form.current?.scrollIntoView?.({ block: 'start' })
    // Where focus was is read from the draft as it's held now, not as this editor was rendered
    // with it: where the editor it replaces unmounted in the same commit, as when the sheet
    // arrives, that one noted it after this one was rendered.
    let focus: NoteDraft['focus']
    setDraft(held => {
      if (held?.key !== key || !held.focus) return held
      focus = held.focus
      return { ...held, focus: undefined }
    })
    if (focus) {
      const field =
        (focus.field === 'chapter' && fields.chapter?.current) ||
        (focus.field === 'body' && fields.body?.current) ||
        fields.title.current
      // In view already, if it was opened by a button.
      field?.focus({ preventScroll: byButton })
      if (
        field &&
        !(field instanceof HTMLSelectElement) &&
        focus.start !== undefined
      ) {
        field.setSelectionRange(focus.start, focus.end ?? focus.start)
      }
    }
    const shown = form.current
    const { chapter, title, body } = fields
    return () => {
      const active = document.activeElement
      if (!shown || !active || !shown.contains(active)) return
      let noted: NoteDraft['focus'] = { field: 'title' }
      if (active === body?.current || active === title.current) {
        const typed = active as HTMLInputElement | HTMLTextAreaElement
        noted = {
          field: active === title.current ? 'title' : 'body',
          start: typed.selectionStart ?? undefined,
          end: typed.selectionEnd ?? undefined,
        }
      } else if (active === chapter?.current) {
        noted = { field: 'chapter' }
      }
      setDraft(held => (held?.key === key ? { ...held, focus: noted } : held))
    }
    // Only as it mounts and unmounts: what it notes is where focus is then.
  }, [])
}

/** One of the note's two tabs, Write and Preview: the one chosen is in the Tab order. */
function TabButton({
  ref,
  id,
  panel,
  selected,
  onClick,
  onKeyDown,
  children,
}: Readonly<{
  ref: RefObject<HTMLButtonElement | null>
  id: string
  panel: string
  selected: boolean
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  children: ReactNode
}>) {
  return (
    <button
      ref={ref}
      id={id}
      type='button'
      role='tab'
      aria-selected={selected}
      aria-controls={panel}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={clsx(
        'min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors',
        selected
          ? 'bg-primary/10 text-primary-text'
          : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

/** What's previewed: the text asked about, and the server's render of it once it comes. */
type Shown = { body: string; html?: string; failed?: true }

/** The note as the book will draw it, from the server's render of it. */
function Preview({ shown }: Readonly<{ shown?: Shown }>) {
  const html = shown?.html
  const read = useMemo(
    () => (html === undefined ? undefined : readDescription(html)),
    [html],
  )
  if (!shown) return
  if (shown.body.trim() === '') {
    return <p className='text-sm text-text-secondary'>Nothing to preview.</p>
  }
  if (shown.failed) {
    return (
      <p className='text-sm text-text-secondary'>
        The preview couldn’t be loaded. Your text is still here.
      </p>
    )
  }
  if (!read) {
    return (
      <p aria-busy className='text-sm text-text-secondary'>
        Loading…
      </p>
    )
  }
  return (
    <div className='overflow-x-auto'>
      <div className='sheet-text note-text'>{drawDescription(read)}</div>
    </div>
  )
}

/**
 * The editor's hint for the lines that would be the journal's own headings, one sentence a line,
 * at most three, then how many more: the scanner's lines, from 1, as showdown makes them h1 or h2.
 * A line it found under-ruled is the one above the rule, which the hint names.
 */
export function headingHint(markdown: string, lines: number[]): string {
  if (lines.length === 0) return ''
  const rows = markdown.split(/\r\n|\r|\n/)
  const said = lines.slice(0, MOST_HINTS).map(line => {
    const text = (rows[line - 1] ?? '')
      .replace(/^(?:[ \t]*>)+/, '')
      .replace(/^(?:[ \t]*(?:[*+-]|\d+\.)[ \t]+)+/, '')
      .trimStart()
    return text.startsWith('#')
      ? String.raw`Line ${line} is a # or ## heading. Use ### or more, or put a \ before the #.`
      : `Line ${line + 1} is under-ruled with = or -, which makes the line above it a heading. Leave a blank line between them.`
  })
  const more = lines.length - said.length
  return more > 0 ? `${said.join(' ')} …and ${more} more` : said.join(' ')
}
