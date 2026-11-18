import { type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

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
   * 0.49.0: it waits, disabled, with no spinner of its own.
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
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onGive}
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
