import { type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

/**
 * A move's button on a character's sheet, Give…, Give or Add or remove, which opens its move's
 * dialog. While its move is on its way it waits: it does nothing and says so, but keeps taking
 * focus, so that the dialog gives focus back to it as it closes, whether the move was sent or not
 * (ROADMAP item 85), as End Turn and the Hit points tile wait.
 */
export function GiveButton({
  label,
  className,
  busy,
  quiet = false,
  onGive,
  children,
}: Readonly<{
  /** Its name, where its words alone don't say what it gives. */
  label?: string
  className: string
  busy: boolean
  /**
   * On a row whose label says what's on its way, as a character's Currency row does from module
   * 0.49.0: it waits with no spinner of its own.
   */
  quiet?: boolean
  onGive: () => void
  children?: ReactNode
}>) {
  const spins = busy && !quiet
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={() => {
        if (!busy) onGive()
      }}
      className={clsx(className, spins && 'inline-flex items-center gap-1')}
    >
      {spins && (
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
      )}
      {children}
    </button>
  )
}
