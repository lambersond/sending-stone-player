'use client'

import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { DistributeDialog } from './distribute-dialog'
import { MoveDialog, type MoveEnd } from './move-dialog'
import {
  TakeDialog,
  takeControls,
  type TakeInto,
  type Taking,
} from './take-controls'
import { ITEM_BUTTON, ROW_BUTTON, type TransferControls } from './transferring'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { PartyView, TableGroup } from '@/types/party'
import type { TransferInput } from '@/types/roll'
import type { SheetCurrency } from '@/types/sending-stone'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

/*
 * What a party's sheet does with its stash and coin: Take (module 0.31.0), and from module
 * 0.32.0's feedback, for a seat at a character whose Foundry user owns the party, or the
 * Gamemaster's at a character, Send to, which sends its things to anyone but the party; Give, by
 * which a player's character gives the party its coins; and Distribute, which shares one of its
 * coins among its characters. Each opens a dialog of its own, held by the sheet, which says what
 * it was opened with as it closes.
 */

/** What a party's dialog was opened for, with whom, as it stood then: kept as it closes. */
export type PartyMoving =
  | { mode: 'take'; what: Taking['what']; receivers?: MoveEnd[] }
  | {
      mode: 'send'
      what: Taking['what']
      recipients: { parties: MoveEnd[]; characters: MoveEnd[] }
    }
  | { mode: 'give'; coins: SheetCurrency[] }
  | { mode: 'distribute'; coins: SheetCurrency[]; among: MoveEnd[] }

/** What's pending, for coins rather than an item. */
const COINS = 'coins'

/** Any whole coin: dnd5e 6 may hold part of one, which can't be moved. */
function anyCoins(currency: SheetCurrency[] | undefined): boolean {
  return !!currency?.some(coin => Math.floor(coin.value) >= 1)
}

/**
 * The controls a party's sheet gives its stash and coin: Take, and from module 0.32.0 Send to, Give
 * and Distribute.
 */
export function partyControls({
  group,
  pending,
  sends,
  recipients,
  receivers,
  gives,
  among,
  onOpen,
}: Readonly<{
  group: TableGroup
  pending: ReadonlySet<string>
  /** Whether the seat may send the party's things elsewhere. */
  sends: boolean
  /** Where Send to sends, as the view has them as it's opened: none where it may not. */
  recipients?: { parties: MoveEnd[]; characters: MoveEnd[] }
  /** On the Gamemaster's party page, the characters to take into, as Take has them. */
  receivers?: MoveEnd[]
  /** The seat's character's coins, which Give gives, where it may. */
  gives?: SheetCurrency[]
  /** Who Distribute shares a coin among; none where it may not. */
  among: MoveEnd[]
  onOpen: (moving: PartyMoving) => void
}>): TransferControls {
  const take = takeControls({
    group,
    pending,
    onTake: what =>
      onOpen({ mode: 'take', what, ...(receivers && { receivers }) }),
  })
  const sending = sends && recipients ? recipients : undefined
  return {
    item: item => ({
      aside: take.item?.(item)?.aside,
      // The way to send it for anyone who doesn't know of its menu, and a row to open the menu
      // from by keyboard.
      body: sending && (
        <PartyButton
          className={ITEM_BUTTON}
          busy={pending.has(item.id)}
          onOpen={() =>
            onOpen({ mode: 'send', what: { item }, recipients: sending })
          }
        >
          Send to…
        </PartyButton>
      ),
    }),
    coins: currency => {
      const whole = anyCoins(currency)
      const busy = pending.has(COINS)
      const taking = take.coins?.(currency)
      const sent = whole && !!sending
      const given = !!gives && anyCoins(gives)
      const shared = whole && among.length > 0
      // Nothing at all, rather than an empty group, where none is shown.
      if (!taking && !sent && !given && !shared) return
      return (
        <>
          {taking}
          {sent && sending && (
            <PartyButton
              className={ROW_BUTTON}
              busy={busy}
              onOpen={() =>
                onOpen({
                  mode: 'send',
                  what: { coins: currency },
                  recipients: sending,
                })
              }
            >
              Send to
            </PartyButton>
          )}
          {given && gives && (
            <PartyButton
              className={ROW_BUTTON}
              busy={busy}
              onOpen={() => onOpen({ mode: 'give', coins: gives })}
            >
              Give
            </PartyButton>
          )}
          {shared && (
            <PartyButton
              className={ROW_BUTTON}
              busy={busy}
              onOpen={() =>
                onOpen({ mode: 'distribute', coins: currency, among })
              }
            >
              Distribute
            </PartyButton>
          )}
        </>
      )
    },
    send: sending
      ? item => () =>
          onOpen({ mode: 'send', what: { item }, recipients: sending })
      : undefined,
  }
}

/** One of the party's moves' buttons: its words are its name, and it waits while coins do. */
function PartyButton({
  className,
  busy,
  onOpen,
  children,
}: Readonly<{
  className: string
  busy: boolean
  onOpen: () => void
  children: ReactNode
}>) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={event => {
        // Inside a row's summary, it's the dialog that opens, not the row.
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
      className={clsx(className, busy && 'inline-flex items-center gap-1')}
    >
      {busy && (
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
      )}
      {children}
    </button>
  )
}

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
