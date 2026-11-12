'use client'

import { useCallback, useMemo, useState } from 'react'
import { SETTLED } from '@/constants/lifecycle'
import { NO_DICE } from '@/constants/roll-kinds'
import { PENDING_COINS } from '@/features/transfers/constants'
import { useFollow } from '@/hooks/use-follow'
import { useTableRead } from '@/hooks/use-table-read'
import { answeredByGame, labelled, onItsWay } from '@/utils/lifecycle'
import { moveLabel } from '@/utils/move-words'
import type {
  RollRequestInput,
  TransferInput,
  LocalMove,
  TableRollState,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'

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
 * character's player to be shown them by. A page with no tray shows the latest, as it stands. Over
 * a character's table, the table is read again as the game answers a move (ROADMAP item 43), so
 * that its sheet shows what it took in or gave as the move's status says it's made.
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
  const follow = useFollow()
  const readAgain = useTableRead()

  const take = useCallback(
    (api: string, move: LocalMove, transfer: TransferInput) => {
      const id = `move-${Date.now()}-${++moves}`
      const input: RollRequestInput = { kind: 'transfer', transfer, ...NO_DICE }
      const sent = role === 'gm' ? labelled(input, moveLabel(move)) : input
      // Those already settled are let go, but for the one this replaces as the latest.
      setFollowed(held => {
        const kept = new Map(
          [...held].filter(([, { state }]) => !SETTLED.has(state.status)),
        )
        return kept.set(id, { move, transfer, state: { status: 'sending' } })
      })
      setShown(id)
      follow(api, sent, state => {
        setFollowed(held => new Map(held).set(id, { move, transfer, state }))
        if (answeredByGame(state)) readAgain()
      })
    },
    [role, follow, readAgain],
  )

  const pending = useMemo(() => {
    const ids = new Set<string>()
    for (const { transfer, state } of followed.values()) {
      if (!onItsWay(state)) continue
      for (const { id } of transfer.items ?? []) ids.add(id)
      if (transfer.currency) ids.add(PENDING_COINS)
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
