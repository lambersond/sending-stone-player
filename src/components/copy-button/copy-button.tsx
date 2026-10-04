'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type Props = {
  value: string
  /** What is copied, for its accessible name: "Copy {label}". */
  label: string
}

/**
 * A value on screen with a button to copy it. Copying is a convenience; it can be copied by hand.
 */
export function CopyField({ value, label }: Readonly<Props>) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // The value is on screen to copy by hand.
    }
  }
  return (
    <span className='flex min-w-0 items-center gap-2 rounded-lg border border-border bg-page py-1 pr-1 pl-3'>
      <code className='min-w-0 flex-1 truncate font-mono text-xs text-text-primary'>
        {value}
      </code>
      <button
        type='button'
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        title={copied ? 'Copied' : 'Copy'}
        className='shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
      >
        {copied ? (
          <Check aria-hidden className='size-4 text-primary' />
        ) : (
          <Copy aria-hidden className='size-4' />
        )}
      </button>
    </span>
  )
}
