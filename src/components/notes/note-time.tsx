'use client'

import { useSyncExternalStore } from 'react'
import { fullNoteTime, noteTime } from '@/utils/note-time'

/*
 * The minute it is, for every time shown in the notes at once: one timer while any is shown, so
 * "just now" becomes "2 minutes ago" without a poll bringing anything new. The minute is kept as
 * the timer last read it, so each render reads the same one; the words are worked out from the
 * clock as they're drawn.
 */
const MINUTE = 60_000
const ticking = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

/** The minute it is now. */
const thisMinute = () => Math.floor(Date.now() / MINUTE)
let minute = thisMinute()

function subscribe(listener: () => void): () => void {
  ticking.add(listener)
  timer ??= setInterval(() => {
    minute = thisMinute()
    for (const each of ticking) each()
  }, MINUTE)
  return () => {
    ticking.delete(listener)
    if (ticking.size > 0) return
    clearInterval(timer)
    timer = undefined
  }
}

/**
 * When a note was changed, as its list says it: "just now", "2 hours ago", "yesterday", "21 Oct".
 * The server can't know the viewer's clock or time zone, so the words are filled in only in the
 * browser, and the full date and time are its title.
 */
export function NoteTime({ value }: Readonly<{ value: string }>) {
  // Nothing on the server and as the page hydrates: nothing is said until the browser's clock is.
  const shown =
    useSyncExternalStore(
      subscribe,
      () => minute,
      () => 0,
    ) > 0
  return (
    <time dateTime={value} title={shown ? fullNoteTime(value) : undefined}>
      {shown ? noteTime(value) : ''}
    </time>
  )
}
