'use client'

import { useId, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  DiscardModal,
  EditorFooter,
  EditorHeading,
  FIELD,
  useDraftFocus,
  useDraftSave,
} from './note-editor'
import { Pane } from './pane'
import { MOST_NOTE_TITLE } from '@/constants/notes'
import {
  draftChanged,
  type DraftChange,
  type NoteDraft,
} from '@/hooks/use-notes'
import type { NoteWriteAnswer } from '@/types/notes'

/**
 * A chapter added or renamed, filling the journal's reader as the editor does, with its Cancel and
 * Save in the footer below its field (round 0.35.0 §8.10). Its title is its only field, so Enter
 * saves. Chapters are never deleted from the app, and it says so.
 */
export function ChapterForm({
  draft,
  setDraft,
  name,
  onSave,
  onCancel,
}: Readonly<{
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  /** The book's character or party, as a refusal names it. */
  name: string
  /** Sends the chapter; the journal clears the draft once it's answered ok. */
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  onCancel: () => void
}>) {
  const ids = useId()
  const headingId = `${ids}-heading`
  const form = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLInputElement>(null)
  const { saving, error, send } = useDraftSave({
    draft,
    setDraft,
    onSave,
    name,
  })
  const [asking, setAsking] = useState(false)
  useDraftFocus({ draft, setDraft, form, fields: { title } })

  const canSave = draft.title.trim() !== '' && !saving
  const save = async () => {
    if (canSave) await send()
  }
  const heading =
    draft.key === 'new-chapter'
      ? 'New chapter'
      : `Rename ${draft.started.title}`
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
          hint='Enter saves.'
          saving={saving}
          canSave={canSave}
          onCancel={() => {
            if (draftChanged(draft)) setAsking(true)
            else onCancel()
          }}
        />
      }
    >
      <div
        ref={form}
        className='flex flex-col gap-3 px-4 py-4 @min-[640px]:px-5'
      >
        <label className='flex flex-col gap-1 text-sm font-medium'>
          Chapter title
          <input
            ref={title}
            type='text'
            required
            maxLength={MOST_NOTE_TITLE}
            enterKeyHint='done'
            autoComplete='off'
            readOnly={saving}
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
        <p className='text-xs text-text-secondary'>
          A chapter is a level 1 heading in Foundry’s journal. Chapters are
          deleted only in Foundry.
        </p>
        <DiscardModal
          open={asking}
          onClose={() => setAsking(false)}
          onDiscard={onCancel}
        />
      </div>
    </Pane>
  )
}
