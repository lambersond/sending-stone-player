'use client'

import { DistributeDialog } from '../distribute-dialog/distribute-dialog'
import { MoveDialog } from '../move-dialog/move-dialog'
import { TakeDialog } from '../take-controls/take-controls'
import type { TakeInto, MoveEnd, PartyMoving } from '../../types'
import type { PartyView, TableGroup } from '@/types/party'
import type { TransferInput, LocalMove } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { ReactNode } from 'react'

/*
 * What a party's sheet does with its stash and coin: Take (module 0.31.0), and from module
 * 0.32.0's feedback, for a seat at a character whose Foundry user owns the party, or the
 * Gamemaster's at a character, Send to, which sends its things to anyone but the party; Give, by
 * which a player's character gives the party its coins; and Distribute, which shares one of its
 * coins among its characters. Each opens a dialog of its own, held by the sheet, which says what
 * it was opened with as it closes.
 */

/**
 * The dialog the party's controls open: Take's, Send's, Give's or Distribute's, each for what it
 * was opened with. Every move but the Gamemaster's party page's Take goes through the API of the
 * seat's character, made as them.
 * @param moving - What it was last opened for, kept as it closes.
 * @param view - The party's view as it is now, which nothing the dialog shows is read from: it
 *   shows what it was opened with.
 * @param onSend - Sends the move through an API, as it's told.
 */
export function PartyMoveDialog({
  open,
  moving,
  takeInto,
  group,
  role,
  onClose,
  onSend,
}: Readonly<{
  open: boolean
  moving?: PartyMoving
  takeInto: TakeInto
  group: TableGroup
  role: SeatRole
  view: PartyView
  onClose: () => void
  onSend: (api: string, move: LocalMove, transfer: TransferInput) => void
}>): ReactNode {
  if (!moving) return
  if (moving.mode === 'take') {
    return (
      <TakeDialog
        open={open}
        taking={{
          what: moving.what,
          ...(moving.receivers && { receivers: moving.receivers }),
        }}
        takeInto={takeInto}
        group={group}
        role={role}
        onClose={onClose}
        onSend={onSend}
      />
    )
  }
  // The rest are made as the seat's character, the Gamemaster's at a character's page too.
  if (takeInto.kind !== 'own') return
  const own = takeInto
  const mover = role === 'gm' ? own.name : 'You'
  const party: MoveEnd = {
    id: group.id,
    name: group.name,
    ...(group.portrait && { portrait: group.portrait }),
    primary: group.primary,
  }
  switch (moving.mode) {
    case 'send': {
      return (
        <MoveDialog
          open={open}
          onClose={onClose}
          mode='send'
          mover={mover}
          what={moving.what}
          from={party}
          recipients={moving.recipients}
          onMove={({ to, items, currency, words }) =>
            onSend(own.api, words, {
              from: group.id,
              to,
              ...(items && { items }),
              ...(currency && { currency }),
            })
          }
        />
      )
    }
    case 'give': {
      return (
        <MoveDialog
          open={open}
          onClose={onClose}
          mode='give'
          mover={mover}
          what={{ coins: moving.coins }}
          into={party}
          onMove={({ to, currency, words }) =>
            onSend(own.api, words, {
              from: own.actorId,
              to,
              ...(currency && { currency }),
            })
          }
        />
      )
    }
    case 'distribute': {
      return (
        <DistributeDialog
          open={open}
          onClose={onClose}
          mover={mover}
          from={party}
          currency={moving.coins}
          among={moving.among}
          onMove={({ among, currency, words }) =>
            onSend(own.api, words, { from: group.id, among, currency })
          }
        />
      )
    }
  }
}
