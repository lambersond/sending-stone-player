'use client'

import clsx from 'clsx'
import { AmountField } from '../amount-field/amount-field'
import { CoinFields } from '../coin-fields/coin-fields'
import { RecipientList } from '../recipient-list/recipient-list'
import { useMoveForm } from './use-move-form'
import { headingOf, worn } from './utils'
import { Modal } from '@/components/modal/modal'
import type { MoveDialogProps } from './types'
import type { SheetContainer, SheetItem } from '@/types/sending-stone'

/*
 * One move of items or coins (module 0.31.0), asked in a dialog of its own: an item, or coins,
 * taken from a party, or given to a party or another of the campaign's characters; and from module
 * 0.32.0, a party's sent to anyone but itself, or coins given into the party whose sheet it's on.
 * It says what moves, to whom, and how many, and that the game's chat will say so; and it's sent
 * at once, the dialog closing as it is, as where it stands is told where the sheet tells it.
 */

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

function MoveForm(props: Readonly<MoveDialogProps>) {
  const { onClose, recipients } = props
  const {
    choices,
    take,
    chosen,
    setChosen,
    counted,
    max,
    count,
    setCount,
    currency,
    coins,
    setCoins,
    item,
    summary,
    ready,
    label,
    submit,
  } = useMoveForm(props)

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
