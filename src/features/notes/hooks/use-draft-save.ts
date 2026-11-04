import { useState } from 'react'
import { noteRefusalWords } from '@/features/notes/utils/note-words'
import type { DraftChange, NoteDraft } from '@/features/notes/types'
import type { NoteWriteAnswer } from '@/types/notes'

/**
 * Save, for the editor and the chapter form: the draft is marked in the store as it's sent, so
 * its fields hold still and Cancel waits till it's answered, in an editor mounted again meanwhile
 * too, as one there could otherwise send it again; once answered, the mark goes from a draft still
 * held, and a refusal says why.
 */
export function useDraftSave({
  draft,
  setDraft,
  onSave,
  name,
}: {
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  /** The book's character or party, as a refusal names it. */
  name: string
}): { saving: boolean; error?: string; send: () => Promise<void> } {
  const [error, setError] = useState<string>()
  const { key } = draft
  const send = async () => {
    setError(undefined)
    setDraft(held => (held?.key === key ? { ...held, saving: true } : held))
    const answer = await onSave(draft)
    // Kept, the section has let the draft go; refused, it's open again with the text as typed.
    setDraft(held =>
      held?.key === key && held.saving ? { ...held, saving: undefined } : held,
    )
    if (!answer.ok) setError(noteRefusalWords(answer.reason, name))
  }
  return { saving: draft.saving === true, error, send }
}
