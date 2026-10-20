'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { AmountField, amountOf } from './amount-field'
import { CoinFields, coinsMoved, movableCoins } from './coin-fields'
import { RecipientList } from './recipient-list'
import { Modal } from '@/components/modal'
import { MOST_MOVED } from '@/constants/sending-stone'
import { useTableRole } from '@/hooks/use-table-api'
import { thingsWords } from '@/utils/move-words'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'

/*
 * One move of items or coins (module 0.31.0), asked in a dialog of its own: an item, or coins,
 * taken from a party, or given to a party or another of the campaign's characters; and from module
 * 0.32.0, a party's sent to anyone but itself, or coins given into the party whose sheet it's on.
 * It says what moves, to whom, and how many, and that the game's chat will say so; and it's sent
 * at once, the dialog closing as it is, as where it stands is told where the sheet tells it.
 */

/** An end of a move: a party, or a character. */
export type MoveEnd = {
  id: string
  name: string
  portrait?: string
  primary?: boolean
}

export type MoveDialogProps = {
  open: boolean
  onClose: () => void
  mode: 'take' | 'give' | 'send'
  /** Who moves it, as the summary says: "You" for a player; the character's name for the GM. */
  mover: string
  what: { item: SheetItem | SheetContainer } | { coins: SheetCurrency[] }
  /** Take and send: the party it's taken or sent from. */
  from?: MoveEnd
  /** Take, or a give into a party, with a set receiver: no To list. */
  into?: MoveEnd
  /** Take on the GM's party page: picked here. */
  receivers?: MoveEnd[]
  /** Give and send: where it may go. */
  recipients?: { parties: MoveEnd[]; characters: MoveEnd[] }
  onMove: (move: {
    to: string
    items?: { id: string; quantity: number }[]
    currency?: Record<string, number>
    words: LocalMove
  }) => void
}

/** What each kind of move is called, as its title and button say it. */
const VERBS: Record<MoveDialogProps['mode'], string> = {
  take: 'Take',
  give: 'Give',
  send: 'Send',
}

/** What the dialog is titled, and under that, where it's from, if it's taken or sent. */
function headingOf({
  mode,
  what,
  from,
}: Pick<MoveDialogProps, 'mode' | 'what' | 'from'>): {
  title: string
  subtitle?: string
} {
  const verb = VERBS[mode]
  const title = 'item' in what ? `${verb} ${what.item.name}` : `${verb} coins`
  return mode !== 'give' && from
    ? { title, subtitle: `From ${from.name}` }
    : { title }
}

/** Whether an item may hold anything: a container, unless it's known to hold nothing. */
function mayHold(item: SheetItem | SheetContainer): boolean {
  return (
    'contents' in item && (item.contents === null || item.contents.length > 0)
  )
}

/** Whether it, or anything in it, at any depth, is equipped or attuned now. */
function worn(item: SheetItem | SheetContainer): boolean {
  if (item.equipped === true || item.attuned) return true
  return 'contents' in item && (item.contents ?? []).some(inner => worn(inner))
}

/**
 * The dialog a move is made in: its title, who it goes to where that's to choose, how many where
 * there's a choice of, what's worth knowing of it, what it'll do, and Cancel or the move. The move
 * does nothing until all that's needed is chosen.
 */
export function MoveDialog(props: Readonly<MoveDialogProps>) {
  const { open, onClose } = props
  const { title, subtitle } = headingOf(props)
  // Its content is only rendered while open, so what's chosen starts afresh each time. On a phone
  // it's as wide as the screen, as a row of coins needs the room.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      fullOnPhone
    >
      <MoveForm {...props} />
    </Modal>
  )
}

function MoveForm({
  onClose,
  mode,
  mover,
  what,
  from,
  into,
  receivers,
  recipients,
  onMove,
}: Readonly<MoveDialogProps>) {
  const gm = useTableRole() === 'gm'
  const item = 'item' in what ? what.item : undefined
  const currency = 'coins' in what ? what.coins : undefined
  const take = mode === 'take'
  const send = mode === 'send'
  // Who it may go to, where that's chosen here: a give's or a send's parties and characters, or on
  // the Gamemaster's party page, the characters it may be taken into.
  const choices = take
    ? receivers
    : recipients && [...recipients.parties, ...recipients.characters]
  // A give goes to the primary party unless said; a send, from a party, to no one until chosen.
  const [chosen, setChosen] = useState<string | undefined>(() =>
    mode === 'give'
      ? recipients?.parties.find(({ primary }) => primary)?.id
      : undefined,
  )
  const [count, setCount] = useState('1')
  const [coins, setCoins] = useState<Record<string, string>>({})

  const max = item ? Math.min(item.quantity, MOST_MOVED) : 0
  // A stack of what holds nothing is split as the player says; anything else moves whole.
  const counted = !!item && item.quantity > 1 && !mayHold(item)
  // A stack that moves whole, of more than the game moves at once, can't be moved from here at
  // all: what may hold anything is never split.
  const tooMany = !!item && !counted && item.quantity > MOST_MOVED
  const recipient = choices ? choices.find(({ id }) => id === chosen) : into
  let quantity: number | undefined
  if (item && !tooMany) {
    quantity = counted ? amountOf(count, max) : item.quantity
  }
  const moved = currency ? coinsMoved(currency, coins) : undefined
  const things =
    item && quantity !== undefined
      ? thingsWords([{ quantity, name: item.name }])
      : moved &&
        thingsWords(
          movableCoins(currency ?? [])
            .filter(({ id }) => moved[id] !== undefined)
            .map(({ id, abbreviation }) => ({
              coins: moved[id],
              abbreviation,
            })),
        )
  // On the Gamemaster's party page, who takes it is who it's taken into, once they're chosen.
  const speaker = take && receivers ? recipient?.name : mover
  const ready = !!recipient && !!speaker && things !== undefined

  let summary: string
  if (tooMany) {
    summary = `More than ${MOST_MOVED.toLocaleString('en')} can’t be moved from here.`
  } else if (!recipient || !speaker) summary = 'Choose who gets it.'
  else if (things === undefined) summary = 'Choose how many.'
  else {
    const you = speaker === 'You'
    if (take) {
      summary = `${speaker} ${you ? 'take' : 'takes'} ${things} from ${from?.name ?? ''}.`
    } else if (send) {
      summary = `${speaker} ${you ? 'send' : 'sends'} ${things} from ${from?.name ?? ''} to ${recipient.name}.`
    } else {
      summary = `${speaker} ${you ? 'give' : 'gives'} ${things} to ${recipient.name}.`
    }
  }

  let label = VERBS[mode]
  if (currency) label = `${label} coins`
  else if (quantity !== undefined && quantity > 1) {
    label = `${label} ${quantity.toLocaleString('en')}`
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !recipient || things === undefined) return
    const words: LocalMove = {
      verb: mode,
      things,
      other: take ? (from?.name ?? '') : recipient.name,
      ...(send && { source: from?.name ?? '' }),
      ...(item && { item: item.id }),
      ...(gm && speaker && { mover: speaker }),
    }
    onMove({
      to: recipient.id,
      ...(item && quantity !== undefined
        ? { items: [{ id: item.id, quantity }] }
        : {}),
      ...(moved && { currency: moved }),
      words,
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      {choices && (
        <fieldset>
          <legend className='mb-2 text-sm font-medium'>To</legend>
          <RecipientList
            parties={take ? undefined : recipients?.parties}
            characters={take ? choices : (recipients?.characters ?? [])}
            value={chosen}
            onChange={setChosen}
          />
        </fieldset>
      )}
      {counted && <AmountField max={max} value={count} onChange={setCount} />}
      {currency && (
        <CoinFields currency={currency} value={coins} onChange={setCoins} />
      )}
      {item && <Notes item={item} />}
      <div className='grid gap-1'>
        <p aria-live='polite' className='text-sm font-medium'>
          {summary}
        </p>
        {ready && (
          <p className='text-sm text-text-secondary'>
            Foundry’s chat will say so.
          </p>
        )}
      </div>
      <div className='flex flex-wrap justify-end gap-2'>
        <button
          type='button'
          onClick={onClose}
          className='h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
        >
          Cancel
        </button>
        <button
          type='submit'
          aria-disabled={ready ? undefined : true}
          className={clsx(
            'inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors',
            ready ? 'hover:bg-primary-hover' : 'cursor-not-allowed opacity-60',
          )}
        >
          {label}
        </button>
      </div>
    </form>
  )
}

/**
 * What's worth knowing of an item before it's moved: that what's in it goes too, where what's in
 * it is known, and that it arrives neither equipped nor attuned, as it, or anything in it, is.
 */
function Notes({ item }: Readonly<{ item: SheetItem | SheetContainer }>) {
  // Secret contents are never told of, not even that there are any.
  const holds = 'contents' in item && (item.contents?.length ?? 0) > 0
  const unequipped = worn(item)
  if (!holds && !unequipped) return
  return (
    <div className='grid gap-1'>
      {holds && (
        <p className='text-sm text-text-secondary'>
          Everything in it goes too.
        </p>
      )}
      {unequipped && (
        <p className='text-sm text-text-secondary'>
          It arrives unequipped and unattuned.
        </p>
      )}
    </div>
  )
}
