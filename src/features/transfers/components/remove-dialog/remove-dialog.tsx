'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { AmountField } from '../amount-field/amount-field'
import { Modal } from '@/components/modal/modal'
import { MOST_MOVED } from '@/constants/sending-stone'
import { amountOf } from '@/features/transfers/components/amount-field/utils'
import { mayHold } from '@/features/transfers/utils'
import { useTableRole } from '@/hooks/use-table-api'
import { thingsWords } from '@/utils/move-words'
import type { RemoveDialogProps } from './types'

/*
 * An item removed from the character (module 0.33.0), asked in a dialog of its own: of a stack,
 * how many, set to all of it; that everything in a container goes with it; and that the game's
 * chat will say so. It's sent at once, the dialog closing as it is, as where it stands is told
 * where the sheet tells it.
 */

/**
 * The dialog an item is removed in: its title, how many of a stack, what goes with it, what it'll
 * do, and Cancel or Remove, which does nothing until how many is a number it may be.
 */
export function RemoveDialog(props: Readonly<RemoveDialogProps>): ReactNode {
  const { open, onClose, item } = props
  // Its content is only rendered while open, so how many starts afresh, at all, each time. The
  // name is as the sheet shows it: an unidentified item's never its true one.
  return (
    <Modal open={open} onClose={onClose} title={`Remove ${item.name}?`}>
      <RemoveForm {...props} />
    </Modal>
  )
}

function RemoveForm({
  onClose,
  mover,
  item: given,
  character,
  onRemove,
}: Readonly<RemoveDialogProps>) {
  const gm = useTableRole() === 'gm'
  // As the sheet had it when the dialog opened, however it changes meanwhile: the game removes it
  // only while it still holds as many as were shown, so part of it is never taken for all of it.
  const [item] = useState(given)
  const max = Math.min(item.quantity, MOST_MOVED)
  // A stack of more than one is asked how many, set to all of it; one, or none, goes as it is.
  const counted = item.quantity > 1
  const [count, setCount] = useState(() => String(max))
  const quantity = counted ? amountOf(count, max) : item.quantity
  const valid = quantity !== undefined
  const things =
    quantity === undefined
      ? undefined
      : thingsWords([{ quantity, name: item.name }])
  // What it holds goes with it, where it may hold anything, even what isn't known yet: what's
  // removed can't be got back, and its row says already that what it holds isn't known.
  const whole = quantity === item.quantity
  const you = mover === 'You'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (quantity === undefined || things === undefined) return
    onRemove({
      item: item.id,
      quantity,
      held: item.quantity,
      words: {
        verb: 'remove',
        things,
        other: character,
        item: item.id,
        ...(gm && { mover }),
      },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      {counted && <AmountField max={max} value={count} onChange={setCount} />}
      {mayHold(item) && whole && (
        <p className='text-sm text-text-secondary'>
          Everything in it goes too.
        </p>
      )}
      <div className='grid gap-1'>
        <p aria-live='polite' className='text-sm font-medium'>
          {things === undefined
            ? 'Choose how many.'
            : `${mover} ${you ? 'remove' : 'removes'} ${things}.`}
        </p>
        {valid && (
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
          aria-disabled={valid ? undefined : true}
          className={clsx(
            'inline-flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white transition-colors dark:text-page',
            valid ? 'hover:bg-danger/90' : 'cursor-not-allowed opacity-60',
          )}
        >
          Remove
        </button>
      </div>
    </form>
  )
}
