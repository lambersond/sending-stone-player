'use client'

import clsx from 'clsx'
import { CoinAmounts } from '../coin-amounts/coin-amounts'
import { RecipientChecks } from '../recipient-checks/recipient-checks'
import { useHandOutForm } from './use-hand-out-form'
import { Modal } from '@/components/modal/modal'
import type { HandOutDialogProps } from './types'

/*
 * A character's coins handed out (module 0.48.0), asked in a dialog of its own: to any of the
 * campaign's other characters, a set amount of each coin to each of those ticked, as a share of
 * loot is paid. It says what each gets and what that comes to in all; that may be more of a coin
 * than the character holds, where the game pays with its other coins. No line is posted for all
 * to read: each is whispered what they received, and the Gamemaster all of it. It's sent at once,
 * the dialog closing as it is, as where it stands is told in the tray.
 */

/**
 * The dialog a character's coins are handed out in: who gets them, what each gets, what it'll do,
 * and Cancel or Hand out, which does nothing until both are chosen and the coins cover it.
 */
export function HandOutDialog(props: Readonly<HandOutDialogProps>) {
  const { open, onClose } = props
  // Its content is only rendered while open, so what's chosen starts afresh each time. On a phone
  // it's as wide as the screen, as a row of coins needs the room.
  return (
    <Modal open={open} onClose={onClose} title='Hand out coins' fullOnPhone>
      <HandOutForm {...props} />
    </Modal>
  )
}

function HandOutForm(props: Readonly<HandOutDialogProps>) {
  const { onClose, role, currency, characters } = props
  const { ticked, setTicked, typed, setTyped, summary, submit } =
    useHandOutForm(props)
  const { text, note, ready } = summary

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      <fieldset>
        <legend className='mb-2 text-sm font-medium'>To</legend>
        <RecipientChecks
          characters={characters}
          value={ticked}
          onChange={setTicked}
        />
      </fieldset>
      <CoinAmounts
        legend='Each gets'
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
            Each is whispered what they received in Foundry’s chat, and{' '}
            {role === 'gm' ? 'you are told.' : 'your Gamemaster is told.'}
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
          Hand out
        </button>
      </div>
    </form>
  )
}
