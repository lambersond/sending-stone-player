'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { lift } from './utils'
import { drawDescription } from '@/components/description/draw-description'
import { readDescription } from '@/components/description/read-description'

/**
 * A note's text, or a chapter's, as the book draws it, at the reader's size, its tables scrolling
 * inside it. Lifted, its own headings come a level up, so under a note's h3 a ### is an h4 and
 * nothing skips a level; on a card, under its h4, they stay as the server drew them.
 */
export function NoteText({
  html,
  lifted = false,
}: Readonly<{ html: string; lifted?: boolean }>) {
  const body = useMemo(() => {
    const read = html ? readDescription(html) : undefined
    return read && lifted ? lift(read) : read
  }, [html, lifted])
  if (!body) return
  return (
    <div className='overflow-x-auto'>
      <div className={clsx('sheet-text note-text reading', lifted && 'lifted')}>
        {drawDescription(body)}
      </div>
    </div>
  )
}
