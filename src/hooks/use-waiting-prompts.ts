'use client'

import { useEffect, useState } from 'react'
import { MIDI_PROMPT_GRACE, PROMPT_NOTICE_FOR } from '@/constants/sending-stone'
import { shownPrompts, waitingPrompts } from '@/utils/prompts'
import type { CompanionAsked, TablePrompt } from '@/types/table'

/**
 * The saving throws the game asks of the character that still wait for their player: each until
 * its time runs out, when it's dropped, though nothing new comes from the game.
 * @param prompts - As the table view last had them.
 */
export function useWaitingPrompts(
  prompts: readonly TablePrompt[] = [],
): TablePrompt[] {
  const [now, setNow] = useState(() => Date.now())
  const waiting = waitingPrompts(prompts, now)
  useTick(
    waiting.map(({ expiresAt }) => Date.parse(expiresAt)),
    setNow,
  )
  return waiting
}

/**
 * The character's companions the game asks a save of that still wait, from module 0.41.0 (round
 * 0.41.0 §3.7): each until the soonest of its prompts runs out, when it's dropped, as the
 * character's own are, though nothing new comes from the game.
 * @param asked - As the table view last had them (`companionPrompts`).
 */
export function useWaitingCompanions(
  asked: readonly CompanionAsked[] = [],
): CompanionAsked[] {
  const [now, setNow] = useState(() => Date.now())
  const waiting = asked.filter(({ expiresAt }) => Date.parse(expiresAt) > now)
  useTick(
    waiting.map(({ expiresAt }) => Date.parse(expiresAt)),
    setNow,
  )
  return waiting
}

/**
 * What the game asks of the character that its sheet shows: each save still waiting for its
 * player; what Midi-QOL asks, a while after its time runs out, until the game says what became of
 * it; and how one Midi-QOL asked closed, other than as answered here, for a few seconds from when
 * this page first saw it, though the table view moves on meanwhile. Each goes in its time, though
 * nothing new comes from the game.
 * @param prompts - As the table view last had them.
 */
export function useShownPrompts(
  prompts: readonly TablePrompt[] = [],
): TablePrompt[] {
  const [now, setNow] = useState(() => Date.now())
  // Each notice this page has seen, and when it first saw it, kept while it shows.
  const [notices, setNotices] = useState<
    ReadonlyMap<string, { prompt: TablePrompt; at: number }>
  >(() => new Map())
  useEffect(() => {
    const fresh = prompts.filter(({ id, closed }) => closed && !notices.has(id))
    if (fresh.length === 0) return
    const at = Date.now()
    setNotices(held => {
      const next = new Map(held)
      for (const prompt of fresh) {
        if (!next.has(prompt.id)) next.set(prompt.id, { prompt, at })
      }
      return next
    })
  }, [prompts, notices])

  // Those the view no longer has, whose notices still show, after those it has.
  const listed = new Set(prompts.map(({ id }) => id))
  const kept = [...notices.values()]
    .filter(({ prompt }) => !listed.has(prompt.id))
    .map(({ prompt }) => prompt)
  const seen = new Map([...notices].map(([id, { at }]) => [id, at]))
  const shown = shownPrompts([...prompts, ...kept], seen, now)
  useTick(
    shown.map(prompt => {
      if (prompt.closed) {
        return (seen.get(prompt.id) ?? now) + PROMPT_NOTICE_FOR
      }
      const expires = Date.parse(prompt.expiresAt)
      return prompt.source && expires <= now
        ? expires + MIDI_PROMPT_GRACE
        : expires
    }),
    setNow,
  )
  return shown
}

/** Moves `now` on at the next of these moments, as what's shown changes then. */
function useTick(moments: number[], setNow: (now: number) => void) {
  const next = Math.min(...moments)
  useEffect(() => {
    if (!Number.isFinite(next)) return
    const timer = setTimeout(() => setNow(Date.now()), next - Date.now() + 50)
    return () => clearTimeout(timer)
  }, [next, setNow])
}
