'use client'

import { useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { DiscardModal, EditorHeader, FIELD, useDraftFocus } from './note-editor'
import { MOST_NOTE_TITLE } from '@/constants/notes'
import {
  draftChanged,
  type DraftChange,
  type NoteDraft,
} from '@/hooks/use-notes'
import { noteRefusalWords } from '@/utils/note-words'
import type { NoteWriteAnswer } from '@/types/notes'

/**
 * A chapter added or renamed, inline in the Notes section in place of its list, with the editor's
 * sticky row of Cancel and Save (round 0.34.0 §9.6). Its title is its only field, so Enter saves.
 * Chapters are never deleted from the app, and it says nothing of deleting one.
 */
export function ChapterForm({
  draft,
  setDraft,
  name,
  onSave,
  onCancel,
  opened,
}: Readonly<{
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  /** The book's character or party, as a refusal names it. */
  name: string
  /** Sends the chapter; the section clears the draft once it's answered ok. */
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  onCancel: () => void
  /** Opened by a button just now, rather than mounted again from the store. */
  opened: boolean
}>) {
  const ids = useId()
  const headingId = `${ids}-heading`
  const form = useRef<HTMLFormElement>(null)
  const title = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [asking, setAsking] = useState(false)
  useDraftFocus({ draft, setDraft, opened, form, fields: { title } })

  const canSave = draft.title.trim() !== '' && !saving
  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(undefined)
    const answer = await onSave(draft)
    setSaving(false)
    if (!answer.ok) setError(noteRefusalWords(answer.reason, name))
  }
  const heading =
    draft.key === 'new-chapter'
      ? 'New chapter'
      : `Rename ${draft.started.title}`
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
        onCancel={() => {
          if (draftChanged(draft)) setAsking(true)
          else onCancel()
        }}
      />
      <label className='flex flex-col gap-1 text-sm font-medium'>
        Chapter title
        <input
          ref={title}
          type='text'
          required
          maxLength={MOST_NOTE_TITLE}
          enterKeyHint='done'
          autoComplete='off'
          value={draft.title}
          onChange={event => {
            const typed = event.target.value
            setDraft(held =>
              held?.key === draft.key
                ? { ...held, title: typed, focus: undefined }
                : held,
            )
          }}
          className={clsx(FIELD, 'h-11')}
        />
      </label>
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
