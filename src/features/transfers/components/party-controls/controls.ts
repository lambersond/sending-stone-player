import { createElement, Fragment } from 'react'
import { PartyButton } from './party-button'
import { takeControls } from '@/features/transfers/components/take-controls/controls'
import {
  ITEM_BUTTON,
  ROW_BUTTON,
  PENDING_COINS,
} from '@/features/transfers/constants'
import { anyCoins } from '@/features/transfers/utils'
import type { TransferControls, MoveEnd, PartyMoving } from '../../types'
import type { TableGroup } from '@/types/party'
import type { SheetCurrency } from '@/types/sending-stone'

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
      body:
        sending &&
        createElement(
          PartyButton,
          {
            className: ITEM_BUTTON,
            busy: pending.has(item.id),
            onOpen: () =>
              onOpen({ mode: 'send', what: { item }, recipients: sending }),
          },
          'Send to…',
        ),
    }),
    coins: currency => {
      const whole = anyCoins(currency)
      const busy = pending.has(PENDING_COINS)
      const taking = take.coins?.(currency)
      const sent = whole && !!sending
      const given = !!gives && anyCoins(gives)
      const shared = whole && among.length > 0
      // Nothing at all, rather than an empty group, where none is shown.
      if (!taking && !sent && !given && !shared) return
      return createElement(
        Fragment,
        undefined,
        taking,
        sent &&
          sending &&
          createElement(
            PartyButton,
            {
              className: ROW_BUTTON,
              busy,
              onOpen: () =>
                onOpen({
                  mode: 'send',
                  what: { coins: currency },
                  recipients: sending,
                }),
            },
            'Send to',
          ),
        given &&
          gives &&
          createElement(
            PartyButton,
            {
              className: ROW_BUTTON,
              busy,
              onOpen: () => onOpen({ mode: 'give', coins: gives }),
            },
            'Give',
          ),
        shared &&
          createElement(
            PartyButton,
            {
              className: ROW_BUTTON,
              busy,
              onOpen: () =>
                onOpen({ mode: 'distribute', coins: currency, among }),
            },
            'Distribute',
          ),
      )
    },
    send: sending
      ? item => () =>
          onOpen({ mode: 'send', what: { item }, recipients: sending })
      : undefined,
    waiting: pending,
  }
}
