import { MOST_AMONG, MOST_MOVED } from '@/constants/sending-stone'
import { amountOf } from '@/features/transfers/components/amount-field/utils'
import { movableCoins } from '@/features/transfers/components/coin-fields/utils'
import {
  coinAbbreviations,
  mayHold,
  shortCoinWords,
} from '@/features/transfers/utils'
import { coinTotals } from '@/utils/coins'
import { coinsWords, namesWords, thingsWords } from '@/utils/move-words'
import type { EachGive, MoveDialogProps } from './types'
import type {
  CoinSpeaker,
  FormSummary,
  MoveEnd,
  Several,
} from '@/features/transfers/types'
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

/**
 * Who may be ticked in a give's list, if any may: a character's coins, where its module hands them
 * out, to its characters (module 0.49.0), or where it hands them to parties too, to everyone
 * (module 0.51.0).
 */
export function severalOf(
  handOut: MoveDialogProps['handOut'],
  currency: readonly SheetCurrency[] | undefined,
): Several | undefined {
  if (!handOut || !currency) return undefined
  return handOut.parties ? 'everyone' : 'characters'
}

/**
 * The parties among a move's ends: its list's, or for a give into a set receiver, that receiver,
 * as a give goes into a party alone; none for a take, which goes into a character.
 */
export function partiesOf({
  mode,
  recipients,
  into,
}: Pick<MoveDialogProps, 'mode' | 'recipients' | 'into'>): MoveEnd[] {
  if (recipients) return recipients.parties
  return mode === 'give' && into ? [into] : []
}

/**
 * Who a move goes to as its dialog opens, by id: a give, the primary party, where it may go there;
 * a send, none until chosen. From module 0.51.0, where everyone may be ticked, none: a party ticked
 * from the start would go with every give until unticked.
 */
export function firstChosen({
  mode,
  recipients,
  several,
}: Pick<MoveDialogProps, 'mode' | 'recipients'> & {
  several?: Several
}): string[] {
  const primary =
    mode === 'give' && several !== 'everyone'
      ? recipients?.parties.find(({ primary }) => primary)
      : undefined
  return primary ? [primary.id] : []
}

/**
 * Who's picked to get it, in the list's order; where there's no list, the set receiver it goes
 * into, if any.
 * @param chosen - Those picked, by id.
 */
export function pickedOf(
  choices: readonly MoveEnd[] | undefined,
  chosen: readonly string[],
  into?: MoveEnd,
): MoveEnd[] {
  if (choices) return choices.filter(({ id }) => chosen.includes(id))
  return into ? [into] : []
}

/**
 * Whether a give is sent as the game hands coins out (module 0.49.0): a character's coins, given
 * where its module hands them out, to no party; from module 0.51.0, where it hands them to parties
 * too, to anyone, a party alone too. So no one picked yet, one, or several, are all given coins the
 * same way, paid with other coins where the game does.
 */
export function givesEach({
  handOut,
  currency,
  chosen,
  parties,
}: {
  handOut?: MoveDialogProps['handOut']
  currency?: readonly SheetCurrency[]
  chosen: readonly string[]
  parties: readonly MoveEnd[]
}): boolean {
  if (!handOut || !currency) return false
  return !!handOut.parties || !parties.some(({ id }) => chosen.includes(id))
}

/** What a give of coins to characters calls what each gets: "Each gets" for several. */
export function coinsLegend(count: number): 'Coins' | 'Each gets' {
  return count > 1 ? 'Each gets' : 'Coins'
}

/**
 * What a give of a character's coins to characters says it'll do, or what it still needs (module
 * 0.49.0): who gets it, no more than one give goes to, then how many; what one gets, or what each
 * of several gets and what that comes to in all; and where that's more of a coin than the
 * character holds, that other coins pay for the rest, or why it can't be sent.
 * @param to - Those ticked, in the list's order.
 * @param each - What each gets, by coin; unset until it's typed.
 * @param currency - The character's coins, as the sheet had them when the dialog opened.
 * @param change - Whether the game pays with other coins where the character is short of one.
 */
export function eachSummary(
  to: readonly MoveEnd[],
  each: Readonly<Record<string, number>> | undefined,
  currency: readonly SheetCurrency[],
  change: boolean,
  speaker: CoinSpeaker,
): FormSummary {
  const several = to.length > 1
  if (to.length === 0) return { text: 'Choose who gets it.', ready: false }
  if (to.length > MOST_AMONG) {
    return { text: `Choose up to ${MOST_AMONG} at a time.`, ready: false }
  }
  if (!each) {
    const text = several ? 'Choose how many each gets.' : 'Choose how many.'
    return { text, ready: false }
  }
  const totals = coinTotals(each, to.length)
  const { note, refused } = shortCoinWords(speaker, currency, totals, {
    change,
    inAll: several,
  })
  if (refused) return { text: refused, ready: false }
  const verb = speaker.who === 'You' ? 'give' : 'gives'
  const things = coinsWords(currency, each)
  const names = namesWords(to.map(({ name }) => name))
  const text = several
    ? `${speaker.who} ${verb} ${things} each to ${names}: ${coinsWords(currency, totals)} in all.`
    : `${speaker.who} ${verb} ${things} to ${names}.`
  return { text, ...(note && { note }), ready: true }
}

/**
 * A give of a character's coins to characters, as it's sent (module 0.49.0), with the words the
 * tray keeps of it: to one, a give to them; to several, what each gets, among whom; either with
 * the sheet's abbreviations for what else the game used.
 * @param name - The character's name; `mover` too, at the Gamemaster's page.
 */
export function eachMove(
  to: readonly MoveEnd[],
  each: Record<string, number>,
  currency: readonly SheetCurrency[],
  { name, gm }: { name: string; gm: boolean },
): EachGive {
  const things = coinsWords(currency, each)
  const names = namesWords(to.map(end => end.name))
  const words: LocalMove =
    to.length > 1
      ? { verb: 'handOut', things, other: name, among: names }
      : { verb: 'give', things, other: names }
  return {
    each: to.map(({ id }) => id),
    currency: each,
    words: {
      ...words,
      ...(gm && { mover: name }),
      abbreviations: coinAbbreviations(currency),
    },
  }
}

/**
 * Who's told of a give once it may be sent: Foundry's chat, for all, of a give to one end; or of
 * coins given to characters (module 0.49.0), a whisper to each, and the Gamemasters. From module
 * 0.51.0, of coins given to parties as characters are: Foundry's chat, for all, of each party's,
 * and the whispers only where a character is among them.
 * @param each - Whether it's given as the game hands coins out.
 * @param to - Those it goes to.
 * @param parties - The parties among a move's ends (`partiesOf`), to tell them from characters.
 */
export function toldWords({
  each,
  to,
  parties = [],
  gm,
}: {
  each: boolean
  to: readonly MoveEnd[]
  parties?: readonly MoveEnd[]
  gm: boolean
}): string {
  if (!each) return 'Foundry’s chat will say so.'
  const party = new Set(parties.map(({ id }) => id))
  const given = to.filter(({ id }) => party.has(id))
  const characters = to.filter(({ id }) => !party.has(id))
  if (characters.length === 0) return 'Foundry’s chat will say so.'
  const told = gm ? 'you are told.' : 'your Gamemaster is told.'
  if (given.length === 0) {
    const who = characters.length === 1 ? characters[0].name : 'Each'
    return `${who} is whispered what they received in Foundry’s chat, and ${told}`
  }
  const what = given.length === 1 ? given[0].name : 'each party'
  const who = characters.length === 1 ? characters[0].name : 'Each character'
  return `Foundry’s chat will say what ${what} gets. ${who} is whispered what they received, and ${told}`
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
