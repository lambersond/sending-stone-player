'use client'

import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { MoveDialog, type MoveEnd } from '@/components/transfers/move-dialog'
import {
  ROW_BUTTON,
  type TransferControls,
} from '@/components/transfers/transferring'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { TableGroup } from '@/types/party'
import type { TransferInput } from '@/types/roll'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

/*
 * Take, on a party's sheet (module 0.31.0): beside each item in its stash, and its coin, for a
 * player whose Foundry user owns the party, into their character, and for the Gamemaster, into the
 * character whose page it's on, or on the party's own page, any of the campaign's characters,
 * picked as it's taken. Each opens the move's dialog, which says what's taken and asks how many.
 */

/**
 * Where a party's sheet takes into, as its page says. Only data, as a server page passes it: the
 * API a pick is taken through is built here.
 */
export type TakeInto =
  /** A player's character, or the character a Gamemaster's page is on. */
  | { kind: 'own'; actorId: string; name: string; api: string }
  /** The Gamemaster's party page: picked in the dialog. */
  | { kind: 'choose'; campaignId: string }

/** What's being taken, or was last, with who may take it as its dialog opened. */
export type Taking = {
  what: { item: SheetItem | SheetContainer } | { coins: SheetCurrency[] }
  /** On the Gamemaster's party page, the characters to take into. */
  receivers?: MoveEnd[]
}

/** The Gamemaster's seat at a campaign's character, which a pick is taken through. */
export function chosenApi(campaignId: string, actorId: string): string {
  return `/api/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(actorId)}`
}

/** Any whole coin to take: dnd5e 6 may hold part of one, which can't be moved. */
function anyCoins(currency: SheetCurrency[]): boolean {
  return currency.some(coin => Math.floor(coin.value) >= 1)
}

/**
 * The controls a party's sheet gives its stash: Take beside each item, and its coin, each waiting
 * while what it takes is on its way.
 * @param pending - What's on its way: item ids, and `coins` for coins.
 * @param onTake - Opens the dialog for what's taken.
 */
export function takeControls({
  group,
  pending,
  onTake,
}: Readonly<{
  group: TableGroup
  pending: ReadonlySet<string>
  onTake: (what: Taking['what']) => void
}>): TransferControls {
  return {
    item: item => ({
      aside: (
        <TakeButton
          label={`Take ${item.name}`}
          busy={pending.has(item.id)}
          onTake={() => onTake({ item })}
        />
      ),
    }),
    coins: currency =>
      anyCoins(currency) && (
        <TakeButton
          label={`Take coins from ${group.name}`}
          busy={pending.has('coins')}
          onTake={() => onTake({ coins: currency })}
        />
      ),
  }
}

function TakeButton({
  label,
  busy,
  onTake,
}: Readonly<{ label: string; busy: boolean; onTake: () => void }>): ReactNode {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={event => {
        // Inside a row's summary, it's the dialog that opens, not the row.
        event.preventDefault()
        event.stopPropagation()
        onTake()
      }}
      className={clsx(ROW_BUTTON, busy && 'inline-flex items-center gap-1')}
    >
      {busy && (
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
      )}
      Take
    </button>
  )
}

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
            : chosenApi(takeInto.campaignId, to)
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
