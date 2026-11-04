import { type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

export function GiveButton({
  label,
  className,
  busy,
  onGive,
  children,
}: Readonly<{
  /** Its name, where its words alone don't say what it gives. */
  label?: string
  className: string
  busy: boolean
  onGive: () => void
  children?: ReactNode
}>) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onGive}
      className={clsx(className, busy && 'inline-flex items-center gap-1')}
    >
      {busy && (
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
      )}
      {children}
    </button>
  )
}
