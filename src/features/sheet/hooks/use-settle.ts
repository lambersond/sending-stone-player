import { useCallback, useEffect, useRef, useState } from 'react'
import { onItsWay } from '@/utils/lifecycle'
import type { Settle, SettleOptions, Settling } from './types'

/**
 * How a pane's commands to the game wait, one kept for each key, as a favorite's, a spell's, an
 * effect's, a pool of slots' or Wild Shape's: one sent waits while it's on its way, however long
 * that takes, and once made until the sheet says what the game made of it (`agrees`), for up to
 * `settleMs` from its send; never once it failed or was refused, so that it can be tried again.
 * One whose way isn't yet heard of is as on its way where `missing` is `'waiting'`, for as long as
 * the sheet might take, and doesn't wait where it's `'idle'`. Its timers go as the pane does.
 */
export function useSettle<T extends Settling>({
  states,
  settleMs,
  missing,
  agrees,
}: Readonly<SettleOptions<T>>): Settle<T> {
  const [held, setHeld] = useState<ReadonlyMap<string, T>>(() => new Map())
  // The local ids of those no longer waited for: sent long enough ago that the sheet should have
  // come, or made and settled at once.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const running = timers.current
    return () => {
      for (const timer of running) clearTimeout(timer)
    }
  }, [])

  const settleIn = useCallback(
    (id: string) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        setSettled(each => new Set(each).add(id))
      }, settleMs)
      timers.current.add(timer)
    },
    [settleMs],
  )
  const sent = useCallback(
    (key: string, command: T) => {
      setHeld(each => new Map(each).set(key, command))
      settleIn(command.id)
    },
    [settleIn],
  )
  const last = useCallback((key: string) => held.get(key), [held])
  const waitingOf = useCallback(
    (command: T | undefined): boolean => {
      if (!command) return false
      const state = states.get(command.id)
      if (!state) return missing === 'waiting' && !settled.has(command.id)
      if (onItsWay(state)) return true
      return (
        state.status === 'done' &&
        !settled.has(command.id) &&
        !agrees(command, state)
      )
    },
    [states, settled, missing, agrees],
  )
  const settleNow = useCallback((id: string) => {
    setSettled(each => (each.has(id) ? each : new Set(each).add(id)))
  }, [])
  const unsettle = useCallback(
    (id: string) => {
      setSettled(each => {
        const next = new Set(each)
        next.delete(id)
        return next
      })
      settleIn(id)
    },
    [settleIn],
  )
  return { sent, last, waitingOf, settleNow, unsettle }
}
