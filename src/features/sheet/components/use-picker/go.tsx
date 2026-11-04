'use client'

import { Sparkles } from 'lucide-react'

/** The button that makes it, with no one to pick, or once they're picked. */
export function Go({
  label,
  disabled = false,
  onGo,
}: Readonly<{ label: string; disabled?: boolean; onGo: () => void }>) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onGo}
      className='mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-40'
    >
      <Sparkles aria-hidden className='size-4' />
      {label}
    </button>
  )
}
