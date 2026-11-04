import { useEffect, useState, type RefObject } from 'react'
import type { NoteDraft, FocusTo } from '@/features/notes/types'
import type { NoteEntryView } from '@/types/notes'

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

/**
 * Where focus goes once what it goes to is drawn, held until then.
 * @returns `setFocusTo`, which asks for it.
 */
export function useFocusTo(
  container: RefObject<HTMLDivElement | null>,
  draft: NoteDraft | undefined,
  deleting: NoteEntryView | undefined,
) {
  const [focusTo, setFocusTo] = useState<FocusTo>()
  // Focus moves once what it goes to is drawn: the editor's opener is drawn again as it closes,
  // and a pane replaced by another takes its controls with it. It waits for Delete's confirm to
  // close, as the page behind a modal dialog takes no focus; a passive effect, so the confirm,
  // closing in the same commit, has given focus back first.
  useEffect(() => {
    if (!focusTo || draft || deleting) return
    const root = container.current
    const target = root ? findFocus(root, focusTo) : undefined
    target?.focus()
    // The request is done once focus has moved, after the commit that drew what it goes to.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- after the commit, by design
    setFocusTo(undefined)
  }, [focusTo, draft, deleting, container])

  return setFocusTo
}
