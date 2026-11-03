'use client'

import { useState } from 'react'
import { Clock, X } from 'lucide-react'
import { ENDED_KEY, ENDED_FOR } from './constants'
import { useHydrated } from '@/hooks/use-hydrated'
import { useStoredText } from '@/hooks/use-stored'
import { endedWords } from '@/utils/wild-shape-words'
import type { TableSheet } from '@/types/table'

/**
 * The banner when the game ends a Wild Shape (round 0.40.0 §5.11): why, and that the character is
 * itself again, under the page's header, with Dismiss. Shown while the sheet has no form and its
 * last ending wasn't from here, where it's within the last twelve hours or came while this page
 * was open, and newer than the last this browser dismissed for the seat. Nothing before the page
 * has hydrated, as what's dismissed is known only in the browser.
 */
export function WildShapeEnded({
  sheet,
  name,
  seat,
}: Readonly<{
  sheet?: TableSheet
  name: string
  /** The seat's key, which what's dismissed is kept by. */
  seat: string
}>) {
  const hydrated = useHydrated()
  const [dismissed, keep] = useStoredText(`${ENDED_KEY}:${seat}`)
  const block = sheet?.wildShape
  const ended = block?.ended ?? undefined
  // The ending the sheet had as this page first had the druid's Wild Shape, 0 for none: any other
  // came since.
  const [first, setFirst] = useState<number | undefined>(() =>
    block ? (block.ended?.at ?? 0) : undefined,
  )
  if (first === undefined && block) setFirst(block.ended?.at ?? 0)
  if (!hydrated || !block || !ended || sheet?.form) return
  // An ending is told of for ENDED_FOR from when it came, as each draw finds the clock, as before
  // v0.43: reading the clock once would change when it stops.
  // eslint-disable-next-line react-hooks/purity -- the clock read as each draw is made, as before
  const fresh = ended.at !== first || Date.now() - ended.at < ENDED_FOR
  const after = Number(dismissed) || 0
  const words = endedWords(ended, name, block.hours)
  if (!words || !fresh || ended.at <= after) return
  return (
    <div
      role='status'
      className='flex shrink-0 items-start gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'
    >
      <Clock aria-hidden className='mt-0.5 size-4 shrink-0 text-warning' />
      <p className='min-w-0 flex-1'>{words}</p>
      <button
        type='button'
        aria-label='Dismiss'
        title='Dismiss'
        onClick={() => {
          keep(String(ended.at))
          document.querySelector<HTMLElement>('#sheet-panel')?.focus()
        }}
        className='-my-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-text-primary/5 hover:text-text-primary sm:size-9'
      >
        <X aria-hidden className='size-4' />
      </button>
    </div>
  )
}
