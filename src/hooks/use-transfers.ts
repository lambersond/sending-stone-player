'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  follow,
  labelled,
  SETTLED,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import { moveLabel } from '@/utils/move-words'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { RollRequestInput, TransferInput } from '@/types/roll'
import type { SeatRole } from '@/utils/seat-words'

/** A move sent from this page, as it's followed. */
type Followed = {
  move: LocalMove
  transfer: TransferInput
  state: TableRollState
}

/** What a page's moves are told apart by. */
let moves = 0

/**
 * Moves of items and coins sent from a party's sheet, from module 0.31.0, to the Gamemaster's game,
 * each through the API of the character it's taken into, and followed as a roll is, until the game
 * has made it or it's given up on. The Gamemaster's say what their page calls them, for the
 * character's player to be shown them by. A page with no tray shows the latest, as it stands.
 * @returns `take`, to send a move; the latest move and where it stands, until it's dismissed; and
 * what's on its way, by item id, and `coins` for coins, for their controls to wait.
 */
export function useTransfers({ role }: Readonly<{ role: SeatRole }>): {
  take: (api: string, move: LocalMove, transfer: TransferInput) => void
  latest?: { move: LocalMove; state: TableRollState }
  pending: ReadonlySet<string>
  dismiss: () => void
} {
  const [followed, setFollowed] = useState<ReadonlyMap<string, Followed>>(
    () => new Map(),
  )
  const [shown, setShown] = useState<string>()
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])

  const take = useCallback(
    (api: string, move: LocalMove, transfer: TransferInput) => {
      const id = `move-${Date.now()}-${++moves}`
      const input: RollRequestInput = {
        kind: 'transfer',
        transfer,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      }
      const sent = role === 'gm' ? labelled(input, moveLabel(move)) : input
      const controller = new AbortController()
      running.current.add(controller)
      const update = (state: TableRollState) => {
        if (controller.signal.aborted) return
        setFollowed(held => new Map(held).set(id, { move, transfer, state }))
      }
      // Those already settled are let go, but for the one this replaces as the latest.
      setFollowed(held => {
        const kept = new Map(
          [...held].filter(([, { state }]) => !SETTLED.has(state.status)),
        )
        return kept.set(id, { move, transfer, state: { status: 'sending' } })
      })
      setShown(id)
      void follow(api, sent, controller.signal, update, () => {}).finally(() =>
        running.current.delete(controller),
      )
    },
    [role],
  )

  const pending = useMemo(() => {
    const ids = new Set<string>()
    for (const { transfer, state } of followed.values()) {
      if (state.status !== 'sending' && state.status !== 'rolling') continue
      for (const { id } of transfer.items ?? []) ids.add(id)
      if (transfer.currency) ids.add('coins')
    }
    return ids
  }, [followed])

  const current = shown === undefined ? undefined : followed.get(shown)
  const latest = useMemo(
    () => current && { move: current.move, state: current.state },
    [current],
  )
  const dismiss = useCallback(() => setShown(undefined), [])
  return { take, latest, pending, dismiss }
}
