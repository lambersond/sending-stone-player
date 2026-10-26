'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// A page's short confirmations, such as "Invite link copied" on the campaigns page (round 0.39.0):
// a pill at the bottom of the screen for a moment, and the same words in one status region that
// stays on the page, so that a screen reader is told each without a region coming and going. Each
// sits beside the page's own confirmation, never in its place.

/** How long a toast shows, in milliseconds, as the design has it. */
export const TOAST_FOR = 1800

type Toast = (
  text: string,
  options?: {
    /**
     * Whether the status region says it too: not where what was pressed already says so, as a
     * Copy button saying Copied.
     */
    announce?: boolean
  },
) => void

/** No toast, as anywhere outside a page that shows them. */
const NO_TOAST: Toast = () => {}

const ToastContext = createContext<Toast>(NO_TOAST)

/** Shows a toast on the page, where the page shows them. */
export function useToast(): Toast {
  return use(ToastContext)
}

/**
 * The toasts of what's inside: one status region, visually hidden, whose words change with each
 * toast it's to say, and the pill that shows them, hidden from screen readers as the region says
 * them. The pill sits above the page and under any dialog, which the browser draws on top.
 */
export function PageToasts({ children }: Readonly<{ children: ReactNode }>) {
  // Each toast numbered, so that the same words twice show afresh.
  const [shown, setShown] = useState<{ text: string; id: number }>()
  const [said, setSaid] = useState('')
  const count = useRef(0)
  const toast = useCallback<Toast>((text, { announce = true } = {}) => {
    count.current += 1
    setShown({ text, id: count.current })
    if (announce) setSaid(text)
  }, [])

  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => {
      setShown(undefined)
      // Emptied as it goes, so that the same words said again are a change the reader is told.
      setSaid('')
    }, TOAST_FOR)
    return () => clearTimeout(timer)
  }, [shown])

  return (
    <ToastContext value={toast}>
      {children}
      <p role='status' className='sr-only'>
        {said}
      </p>
      {shown && (
        <p
          key={shown.id}
          aria-hidden
          data-page-toast
          className='pointer-events-none fixed bottom-5 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-text-primary px-3.5 py-2.5 text-sm font-medium text-card shadow-lg'
        >
          {shown.text}
        </p>
      )}
    </ToastContext>
  )
}
