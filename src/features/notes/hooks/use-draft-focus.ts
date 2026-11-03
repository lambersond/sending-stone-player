import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { DraftChange, NoteDraft } from '@/features/notes/types'

/**
 * Where focus goes as an editor mounts, and what's noted as it unmounts (§9.6): opened by a
 * button, its title takes focus, as the draft it opens with says; mounted again where focus was
 * inside it, as when the sheet arrives while the player types, focus and the caret go back. Its
 * cleanup runs while its fields are still in the page, so it can read where focus is; it changes
 * the draft only where it's still this editor's, never bringing back one just saved or discarded.
 */
export function useDraftFocus({
  draft,
  setDraft,
  form,
  fields,
}: {
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  /** Inside the editor's form, which focus is looked for in as it unmounts. */
  form: RefObject<HTMLElement | null>
  fields: {
    chapter?: RefObject<HTMLSelectElement | null>
    title: RefObject<HTMLInputElement | null>
    body?: RefObject<HTMLTextAreaElement | null>
  }
}): void {
  // As the editor mounts, from the draft it mounts with: the effect runs only then.
  const mounted = useRef(draft)
  useLayoutEffect(() => {
    const { key } = mounted.current
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
      field?.focus()
      if (
        field &&
        !(field instanceof HTMLSelectElement) &&
        focus.start !== undefined
      ) {
        field.setSelectionRange(focus.start, focus.end ?? focus.start)
      }
    }
    // The whole form, its footer's Cancel and Save too.
    const shown = form.current?.closest('form') ?? form.current
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
