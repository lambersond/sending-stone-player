'use client'

import { MoveDialog } from '@/features/transfers/components/move-dialog/move-dialog'
import { gmCharacterApi } from '@/utils/seat-urls'
import type { TakeInto, Taking } from '@/features/transfers/types'
import type { TableGroup } from '@/types/party'
import type { TransferInput, LocalMove } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/*
 * Take, on a party's sheet (module 0.31.0): beside each item in its stash, and its coin, for a
 * player whose Foundry user owns the party, into their character, and for the Gamemaster, into the
 * character whose page it's on, or on the party's own page, any of the campaign's characters,
 * picked as it's taken. Each opens the move's dialog, which says what's taken and asks how many.
 */

/**
 * The dialog that takes from a party: into the seat's own character, or the one picked from the
 * campaign's characters. It's sent through the character's API, as a move of theirs, and closes at
 * once. Once it's first opened, it's closed rather than removed, so that the browser gives focus
 * back to the Take that opened it.
 * @param taking - What it was last opened for, kept as it closes.
 * @param onSend - Sends the move through an API, as it's told.
 */
export function TakeDialog({
  open,
  taking,
  takeInto,
  group,
  role,
  onClose,
  onSend,
}: Readonly<{
  open: boolean
  taking?: Taking
  takeInto: TakeInto
  group: TableGroup
  role: SeatRole
  onClose: () => void
  onSend: (api: string, move: LocalMove, transfer: TransferInput) => void
}>) {
  if (!taking) return
  const own = takeInto.kind === 'own' ? takeInto : undefined
  return (
    <MoveDialog
      open={open}
      onClose={onClose}
      mode='take'
      // The Gamemaster's party page says the one picked, once they're picked.
      mover={role === 'gm' ? (own?.name ?? '') : 'You'}
      what={taking.what}
      from={{
        id: group.id,
        name: group.name,
        ...(group.portrait && { portrait: group.portrait }),
        primary: group.primary,
      }}
      {...(own
        ? { into: { id: own.actorId, name: own.name } }
        : { receivers: taking.receivers ?? [] })}
      onMove={({ to, items, currency, words }) => {
        const chosen =
          takeInto.kind === 'choose'
            ? taking.receivers?.find(({ id }) => id === to)
            : undefined
        const api =
          takeInto.kind === 'own'
            ? takeInto.api
            : gmCharacterApi(takeInto.campaignId, to)
        // Who took it, as the Gamemaster's words say: the character it's taken into.
        const mover = role === 'gm' ? (own?.name ?? chosen?.name) : undefined
        const move: LocalMove = {
          verb: words.verb,
          things: words.things,
          other: words.other,
          ...(words.item && { item: words.item }),
          ...(mover && { mover }),
        }
        onSend(api, move, {
          from: group.id,
          to: own ? own.actorId : to,
          ...(items && { items }),
          ...(currency && { currency }),
        })
      }}
    />
  )
}
