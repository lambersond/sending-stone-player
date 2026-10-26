'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Check, Copy } from 'lucide-react'

type Props = {
  value: string
  /** What is copied, for its accessible name: "Copy {label}". */
  label: string
  /**
   * Shown whole over as many lines as it takes, rather than cut to one: for a value that must be
   * read or copied by hand on a phone, such as a link code.
   */
  wrap?: boolean
  /** Called once the value is copied, such as for a toast saying so (round 0.39.0). */
  onCopied?: () => void
  /**
   * The button shows its word beside its icon, Copy, then Copied once it has copied, rather than
   * the icon alone (round 0.39.0).
   */
  word?: boolean
}

/**
 * A value on screen with a button to copy it. Copying is a convenience; it can be copied by hand.
 */
export function CopyField({
  value,
  label,
  wrap = false,
  onCopied,
  word = false,
}: Readonly<Props>) {
  // Which value was copied, not only that one was: a new value in its place, such as an invite
  // link once reset, isn't on the clipboard, so its button offers Copy again.
  const [copiedValue, setCopiedValue] = useState<string>()
  const copied = copiedValue === value
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
      onCopied?.()
    } catch {
      // The value is on screen to copy by hand.
    }
  }
  return (
    <span className='flex min-w-0 items-center gap-2 rounded-lg border border-border bg-page py-1 pr-1 pl-3'>
      <code
        className={clsx(
          'min-w-0 flex-1 font-mono text-xs text-text-primary',
          wrap ? 'break-all select-all' : 'truncate',
        )}
      >
        {value}
      </code>
      <button
        type='button'
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        title={copied ? 'Copied' : 'Copy'}
        className={clsx(
          'shrink-0 rounded-md text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary',
          // With its word, as tall as the page's small buttons; its name starts with the word.
          word
            ? 'inline-flex min-h-9 items-center gap-1.5 px-2.5 text-xs font-medium'
            : 'p-1.5',
          // A value copied on a phone: a button as easy to tap as the card's others.
          wrap && 'inline-flex min-h-11 min-w-11 items-center justify-center',
        )}
      >
        {copied ? (
          <Check aria-hidden className='size-4 text-primary' />
        ) : (
          <Copy aria-hidden className='size-4' />
        )}
        {word && (copied ? 'Copied' : 'Copy')}
      </button>
    </span>
  )
}
