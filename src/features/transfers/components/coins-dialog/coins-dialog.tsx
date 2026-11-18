'use client'

import clsx from 'clsx'
import { CoinAmounts } from '../coin-amounts/coin-amounts'
import { useCoinsForm } from './use-coins-form'
import { Modal } from '@/components/modal/modal'
import type { CoinsDialogProps } from './types'
import type { CoinOp } from '@/types/sending-stone'

/*
 * Coins added to a character or taken away (module 0.49.0), asked in a dialog of its own, as when
 * they're paid or buy something: which of the two, how many of each coin, and what it'll do. Coins
 * taken away may be more of one than the character holds, where the game pays with its other
 * coins, which the dialog says; where they're worth too little, or the game doesn't, it can't be
 * sent. It's sent at once, the dialog closing as it is, as where it stands is told in the tray.
 */

/** The two things done here, as their choice names them. */
const OPS: readonly { op: CoinOp; label: string }[] = [
  { op: 'add', label: 'Add' },
  { op: 'remove', label: 'Take away' },
]

/**
 * The dialog a character's coins are added or taken away in: the choice of which, a number for
 * each coin, what it'll do, and Cancel or the change, which does nothing until both are chosen and
 * the coins cover it.
 */
export function CoinsDialog(props: Readonly<CoinsDialogProps>) {
  const { open, onClose } = props
  // Its content is only rendered while open, so what's chosen starts afresh each time. On a phone
  // it's as wide as the screen, as a row of coins needs the room.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Add or take away coins'
      fullOnPhone
    >
      <CoinsForm {...props} />
    </Modal>
  )
}

function CoinsForm(props: Readonly<CoinsDialogProps>) {
  const { onClose, currency } = props
  const { op, setOp, typed, setTyped, summary, label, submit } =
    useCoinsForm(props)
  const { text, note, ready } = summary

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      <fieldset>
        <legend className='sr-only'>Add or take away</legend>
        <div className='grid grid-cols-2 gap-1 rounded-xl border border-border bg-page p-1'>
          {OPS.map(option => (
            <label
              key={option.op}
              className={clsx(
                'cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-semibold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary',
                op === option.op
                  ? 'bg-primary text-on-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <input
                type='radio'
                name='coins-op'
                className='sr-only'
                checked={op === option.op}
                onChange={() => setOp(option.op)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <CoinAmounts
        legend='Coins'
        currency={currency}
        value={typed}
        onChange={setTyped}
      />
      <div className='grid gap-1'>
        <p aria-live='polite' className='text-sm font-medium'>
          {text}
          {note && ` ${note}`}
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
