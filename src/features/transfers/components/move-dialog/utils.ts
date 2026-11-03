import { MOST_MOVED } from '@/constants/sending-stone'
import { amountOf } from '@/features/transfers/components/amount-field/utils'
import { movableCoins } from '@/features/transfers/components/coin-fields/utils'
import { mayHold } from '@/features/transfers/utils'
import { thingsWords } from '@/utils/move-words'
import type { MoveDialogProps } from './types'
import type { MoveEnd } from '@/features/transfers/types'
import type { LocalMove } from '@/types/roll'
import type {
  SheetContainer,
  SheetItem,
  SheetCurrency,
} from '@/types/sending-stone'

/** What each kind of move is called, as its title and button say it. */
const VERBS: Record<MoveDialogProps['mode'], string> = {
  take: 'Take',
  give: 'Give',
  send: 'Send',
}

/** What the dialog is titled, and under that, where it's from, if it's taken or sent. */
export function headingOf({
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

/** Whether it, or anything in it, at any depth, is equipped or attuned now. */
export function worn(item: SheetItem | SheetContainer): boolean {
  if (item.equipped === true || item.attuned) return true
  return 'contents' in item && (item.contents ?? []).some(inner => worn(inner))
}

/**
 * Who a move may go to, where that's chosen in its dialog: a give's or a send's parties and
 * characters, or on the Gamemaster's party page, the characters it may be taken into.
 */
export function choicesOf({
  mode,
  receivers,
  recipients,
}: Pick<MoveDialogProps, 'mode' | 'receivers' | 'recipients'>):
  MoveEnd[] | undefined {
  return mode === 'take'
    ? receivers
    : recipients && [...recipients.parties, ...recipients.characters]
}

/** Who a move goes to as its dialog opens: a give, the primary party; a send, none until chosen. */
export function firstChosen({
  mode,
  recipients,
}: Pick<MoveDialogProps, 'mode' | 'recipients'>): string | undefined {
  return mode === 'give'
    ? recipients?.parties.find(({ primary }) => primary)?.id
    : undefined
}

/**
 * How many of an item move, from what's typed: at most as many as the game moves at once; a stack
 * of what holds nothing is split as the player says, and anything else moves whole; and a stack
 * that moves whole, of more than the game moves at once, can't be moved from here at all.
 */
export function itemAmounts(
  item: SheetItem | SheetContainer | undefined,
  count: string,
): { max: number; counted: boolean; tooMany: boolean; quantity?: number } {
  const max = item ? Math.min(item.quantity, MOST_MOVED) : 0
  // A stack of what holds nothing is split as the player says; anything else moves whole.
  const counted = !!item && item.quantity > 1 && !mayHold(item)
  // A stack that moves whole, of more than the game moves at once, can't be moved from here at
  // all: what may hold anything is never split.
  const tooMany = !!item && !counted && item.quantity > MOST_MOVED
  let quantity: number | undefined
  if (item && !tooMany) {
    quantity = counted ? amountOf(count, max) : item.quantity
  }
  return { max, counted, tooMany, quantity }
}

/** What moves, in words: so many of the item, or the coins chosen; none until it's chosen. */
export function thingsOf(
  item: SheetItem | SheetContainer | undefined,
  quantity: number | undefined,
  currency: SheetCurrency[] | undefined,
  moved: Record<string, number> | undefined,
): string | undefined {
  return item && quantity !== undefined
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
}

/** What a move's dialog says it'll do, or what it still needs. */
export function summaryOf({
  mode,
  tooMany,
  recipient,
  speaker,
  things,
  from,
}: {
  mode: MoveDialogProps['mode']
  tooMany: boolean
  recipient?: MoveEnd
  speaker?: string
  things?: string
  from?: MoveEnd
}): string {
  if (tooMany) {
    return `More than ${MOST_MOVED.toLocaleString('en')} can’t be moved from here.`
  }
  if (!recipient || !speaker) return 'Choose who gets it.'
  if (things === undefined) return 'Choose how many.'
  const you = speaker === 'You'
  if (mode === 'take') {
    return `${speaker} ${you ? 'take' : 'takes'} ${things} from ${from?.name ?? ''}.`
  }
  if (mode === 'send') {
    return `${speaker} ${you ? 'send' : 'sends'} ${things} from ${from?.name ?? ''} to ${recipient.name}.`
  }
  return `${speaker} ${you ? 'give' : 'gives'} ${things} to ${recipient.name}.`
}

/** What a move's button says: its verb, and how many where it's more than one item, or coins. */
export function labelOf(
  mode: MoveDialogProps['mode'],
  currency: SheetCurrency[] | undefined,
  quantity: number | undefined,
): string {
  let label = VERBS[mode]
  if (currency) label = `${label} coins`
  else if (quantity !== undefined && quantity > 1) {
    label = `${label} ${quantity.toLocaleString('en')}`
  }
  return label
}

/** The move a dialog makes, as it's sent, with the words the tray keeps of it. */
export function moveOf({
  mode,
  things,
  recipient,
  from,
  item,
  quantity,
  moved,
  gm,
  speaker,
}: {
  mode: MoveDialogProps['mode']
  things: string
  recipient: MoveEnd
  from?: MoveEnd
  item?: SheetItem | SheetContainer
  quantity?: number
  moved?: Record<string, number>
  gm: boolean
  speaker?: string
}): Parameters<MoveDialogProps['onMove']>[0] {
  const take = mode === 'take'
  const send = mode === 'send'
  const words: LocalMove = {
    verb: mode,
    things,
    other: take ? (from?.name ?? '') : recipient.name,
    ...(send && { source: from?.name ?? '' }),
    ...(item && { item: item.id }),
    ...(gm && speaker && { mover: speaker }),
  }
  return {
    to: recipient.id,
    ...(item && quantity !== undefined
      ? { items: [{ id: item.id, quantity }] }
      : {}),
    ...(moved && { currency: moved }),
    words,
  }
}
