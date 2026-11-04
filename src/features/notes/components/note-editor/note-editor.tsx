'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import { flushSync } from 'react-dom'
import { Pane } from '../pane/pane'
import { DiscardModal } from './discard-modal'
import { EditorFooter } from './editor-footer'
import { EditorHeading } from './editor-heading'
import { MOST_NOTE_BODY, MOST_NOTE_TITLE } from '@/constants/notes'
import { NoteText } from '@/features/notes/components/note-lines/note-text'
import { FIELD } from '@/features/notes/constants'
import { useDraftFocus } from '@/features/notes/hooks/use-draft-focus'
import { useDraftSave } from '@/features/notes/hooks/use-draft-save'
import { draftChanged } from '@/features/notes/hooks/use-notes'
import { headingHint } from '@/features/notes/utils/editor'
import { bigHeadings } from '@/utils/note-headings'
import type { NoteEditorProps, Shown } from './types'
import type { NoteDraft } from '@/features/notes/types'

/** From how many characters a note's count shows under it, as it nears the most it may hold. */
const COUNT_FROM = 18_000

/**
 * A note written or changed, in Foundry's Markdown, filling the journal's reader (round 0.35.0
 * §8.10): its heading in the bar; the chapter, the title, and the note, written or previewed as the
 * book will draw it, scrolling; and Cancel and Save in the footer below them, pinned to the
 * modal's bottom, which follows an on-screen keyboard (`useKeyboardInset`). What's typed is the
 * draft in the page's store, never this editor's own, so it outlives the editor: the journal
 * closed, the sheet arriving or going, or the party panel closed and opened again.
 */
export function NoteEditor({
  draft,
  setDraft,
  chapters,
  name,
  preview,
  onSave,
  onCancel,
}: Readonly<NoteEditorProps>) {
  const ids = useId()
  const headingId = `${ids}-heading`
  const helpId = `${ids}-help`
  const hintId = `${ids}-hint`
  const form = useRef<HTMLDivElement>(null)
  const chapter = useRef<HTMLSelectElement>(null)
  const title = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const { saving, error, send } = useDraftSave({
    draft,
    setDraft,
    onSave,
    name,
  })
  const [asking, setAsking] = useState(false)
  const [shown, setShown] = useState<Shown>()
  const writeTab = useRef<HTMLButtonElement>(null)
  const previewTab = useRef<HTMLButtonElement>(null)
  useDraftFocus({
    draft,
    setDraft,
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
    if (canSave) await send()
  }
  // A chapter deleted meanwhile, as in Foundry, is no longer one to choose, and one sent is
  // refused: the note goes in no chapter, as the list of chapters then shows, so what's shown is
  // what's saved. The book made that change, not the player, so what it started as has it too.
  const lostChapter =
    draft.chapterId !== null &&
    !chapters.some(({ id }) => id === draft.chapterId)
      ? draft.chapterId
      : undefined
  useEffect(() => {
    if (lostChapter === undefined || saving) return
    setDraft(held =>
      held?.key === draft.key && held.chapterId === lostChapter
        ? {
            ...held,
            chapterId: null,
            started:
              held.started.chapterId === lostChapter
                ? { ...held.started, chapterId: null }
                : held.started,
          }
        : held,
    )
  }, [lostChapter, saving, draft.key, setDraft])
  // Ctrl+Enter or ⌘+Enter saves from the fields, as Save does, sparing a Tab to the footer.
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
    <Pane
      as='form'
      noValidate
      aria-labelledby={headingId}
      onSubmit={event => {
        event.preventDefault()
        void save()
      }}
      bar={<EditorHeading id={headingId} heading={heading} />}
      footer={
        <EditorFooter
          error={error}
          hint='Ctrl+Enter or ⌘+Enter saves.'
          saving={saving}
          canSave={canSave}
          onCancel={cancel}
        />
      }
    >
      <div
        ref={form}
        className='flex min-h-full flex-col gap-3 px-4 py-4 @min-[640px]:px-5'
      >
        {draft.role === 'entry' && chapters.length > 0 && (
          <label className='flex flex-col gap-1 text-sm font-medium'>
            Chapter
            <select
              ref={chapter}
              disabled={saving}
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
            readOnly={saving}
            value={draft.title}
            onChange={event => update({ title: event.target.value })}
            onKeyDown={event => {
              if (saveKey(event)) return
              const { isComposing, keyCode } = event.nativeEvent
              if (event.key !== 'Enter' || isComposing || keyCode === 229) {
                return
              }
              // A phone's return key after the title goes on to the note, and never saves one
              // with no text yet.
              event.preventDefault()
              flushSync(() => setTab('write'))
              body.current?.focus()
            }}
            className={clsx(FIELD, 'h-11')}
          />
        </label>
        <div className='flex flex-1 flex-col gap-1'>
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
          {/* The note fills what the pane leaves it, never less than 14rem. */}
          <div
            id={`${ids}-panel-write`}
            role='tabpanel'
            aria-labelledby={`${ids}-tab-write`}
            hidden={tab !== 'write'}
            className='flex flex-1 flex-col'
          >
            <textarea
              ref={body}
              id={`${ids}-body`}
              readOnly={saving}
              value={draft.body}
              aria-describedby={`${helpId} ${hintId}`}
              onChange={event => update({ body: event.target.value })}
              onKeyDown={saveKey}
              className={clsx(
                FIELD,
                'min-h-56 w-full flex-1 resize-none py-2 font-mono',
              )}
            />
          </div>
          <div
            id={`${ids}-panel-preview`}
            role='tabpanel'
            aria-labelledby={`${ids}-tab-preview`}
            hidden={tab !== 'preview'}
            className='min-h-56 flex-1 rounded-xl border border-border bg-page px-3 py-2'
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
            quote, | table |, ~~strike~~. # and ## are the journal’s chapters
            and notes, so headings start at ###.
          </p>
          <p id={hintId} aria-live='polite' className='text-sm text-danger'>
            {hint}
          </p>
        </div>
        <DiscardModal
          open={asking}
          onClose={() => setAsking(false)}
          onDiscard={onCancel}
        />
      </div>
    </Pane>
  )
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

/** The note as the reader will draw it, from the server's render of it. */
function Preview({ shown }: Readonly<{ shown?: Shown }>) {
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
  if (shown.html === undefined) {
    return (
      <p aria-busy className='text-sm text-text-secondary'>
        Loading…
      </p>
    )
  }
  return <NoteText html={shown.html} lifted />
}
