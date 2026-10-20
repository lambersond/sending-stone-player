'use client'

import { useId, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { UserRound } from 'lucide-react'
import { EntryIcon } from '@/components/character-sheet/sheet-entry'
import { Modal } from '@/components/modal'
import { MOST_MOVED } from '@/constants/sending-stone'
import { useTableRole } from '@/hooks/use-table-api'
import { namesWords, thingsWords } from '@/utils/move-words'
import type { MoveEnd } from './move-dialog'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { SheetCurrency } from '@/types/sending-stone'

/*
 * A party's coin distributed among its characters (module 0.32.0), asked in a dialog of its own:
 * one kind of coin, all of it, shared equally among the party's members that are the campaign's
 * characters, a whole share each, what's left over staying with the party. It says who shares it,
 * what each is given and what stays, and that the game's chat will say so; and it's sent at once,
 * the dialog closing as it is, as where it stands is told where the sheet tells it.
 */

export type DistributeDialogProps = {
  open: boolean
  onClose: () => void
  /** "You" for a player; the character's name for the Gamemaster. */
  mover: string
  /** The party it's distributed from. */
  from: MoveEnd
  /** The party's coins, as its sheet has them. */
  currency: SheetCurrency[]
  /**
   * Who shares it: the party's members that are the campaign's characters, in its sheet's order.
   */
  among: MoveEnd[]
  onMove: (move: {
    among: string[]
    currency: Record<string, number>
    words: LocalMove
  }) => void
}

/** The dialog a party's coin is distributed in: which coin, among whom, and what each is given. */
export function DistributeDialog(props: Readonly<DistributeDialogProps>) {
  const { open, onClose, from } = props
  // Its content is only rendered while open, so no coin is chosen each time it opens. On a phone
  // it's as wide as the screen, as the move's dialog is.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Distribute coins'
      subtitle={`From ${from.name}`}
      fullOnPhone
    >
      <DistributeForm {...props} />
    </Modal>
  )
}

/** A coin there's a whole one of, with as many as may be shared. */
type Shared = SheetCurrency & { whole: number }

function DistributeForm({
  onClose,
  mover,
  from,
  currency,
  among,
  onMove,
}: Readonly<DistributeDialogProps>) {
  const gm = useTableRole() === 'gm'
  const ids = useId()
  const name = `${ids}-coin`
  const amongId = `${ids}-among`
  const k = among.length
  // Only whole coins are shared: dnd5e 6 may hold part of one, which stays.
  const coins: Shared[] = currency
    .map(coin => ({
      ...coin,
      whole: Math.min(Math.floor(coin.value), MOST_MOVED),
    }))
    .filter(({ whole }) => whole >= 1)
  // None is chosen at first: what's shared goes to others, so it's the player's to choose.
  const [chosen, setChosen] = useState<string>()
  const coin =
    k > 0
      ? coins.find(({ id, whole }) => id === chosen && whole >= k)
      : undefined
  const share = coin ? Math.floor(coin.whole / k) : 0
  const names = namesWords(among.map(({ name: who }) => who))
  const words = coin && {
    things: thingsWords([
      { coins: share * k, abbreviation: coin.abbreviation },
    ]),
    each: thingsWords([{ coins: share, abbreviation: coin.abbreviation }]),
    left: coin.whole - share * k,
  }
  const ready = !!words

  let summary = 'Choose a coin.'
  if (coins.every(({ whole }) => whole < k)) {
    summary = 'There isn’t a whole coin for each of them.'
  } else if (coin && words) {
    const verb = mover === 'You' ? 'distribute' : 'distributes'
    const stays =
      words.left > 0
        ? `${thingsWords([{ coins: words.left, abbreviation: coin.abbreviation }])} stays with ${from.name}.`
        : `Nothing stays with ${from.name}.`
    summary = `${mover} ${verb} ${words.things} among ${names}: ${words.each} each. ${stays}`
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!coin || !words) return
    onMove({
      among: among.map(({ id }) => id),
      currency: { [coin.id]: coin.whole },
      words: {
        verb: 'distribute',
        things: words.things,
        other: from.name,
        among: names,
        each: words.each,
        ...(gm && { mover }),
      },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      <fieldset>
        <legend className='mb-2 text-sm font-medium'>Coin</legend>
        <div className='grid gap-1.5'>
          {coins.map(option => (
            <CoinOption
              key={option.id}
              coin={option}
              name={name}
              among={k}
              checked={option.id === chosen}
              onChange={setChosen}
            />
          ))}
        </div>
      </fieldset>
      <div className='grid gap-2'>
        <p id={amongId} className='text-sm font-medium'>
          Among
        </p>
        <ul aria-labelledby={amongId} className='grid gap-1'>
          {among.map(end => (
            <li
              key={end.id}
              className='flex min-h-11 items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-semibold'
            >
              <EntryIcon src={end.portrait} fallback={UserRound} />
              <span className='min-w-0 flex-1 truncate'>{end.name}</span>
            </li>
          ))}
        </ul>
      </div>
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
          Distribute
        </button>
      </div>
    </form>
  )
}

/**
 * One coin to share: a card around the radio button, as the move's recipients look, named by its
 * coin and how many there are, as "Gold 103 gp". One there are too few of to give each a whole one
 * can't be chosen, and says so under it.
 */
function CoinOption({
  coin,
  name,
  among,
  checked,
  onChange,
}: Readonly<{
  coin: Shared
  name: string
  among: number
  checked: boolean
  onChange: (id: string) => void
}>) {
  const why = useId()
  const few = coin.whole < among
  return (
    <div className='grid gap-0.5'>
      <label
        className={clsx('block', few ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        <input
          type='radio'
          name={name}
          value={coin.id}
          checked={checked}
          disabled={few}
          aria-describedby={few ? why : undefined}
          onChange={() => onChange(coin.id)}
          className='peer sr-only'
        />
        <span
          className={clsx(
            'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
            checked
              ? 'border-primary bg-primary/10 text-primary-text'
              : 'border-border hover:bg-primary/5',
            few && 'opacity-60',
          )}
        >
          <span
            aria-hidden
            className={clsx(
              'size-3.5 shrink-0 rounded-full border',
              checked ? 'border-4 border-primary' : 'border-border',
            )}
          />
          <span className='min-w-0 flex-1 truncate'>{coin.label}</span>
          {/* Said after its name, as "Gold 103 gp". */}{' '}
          <span className='shrink-0 font-normal text-text-secondary tabular-nums'>
            {coin.whole.toLocaleString('en')} {coin.abbreviation}
          </span>
        </span>
      </label>
      {/* Under the card, apart from its name, as what it's described by. */}
      {few && (
        <p id={why} className='px-3 text-xs text-text-secondary'>
          Too few to share among {among}
        </p>
      )}
    </div>
  )
}
