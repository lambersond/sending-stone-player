'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CookingPot, LoaderCircle } from 'lucide-react'
import { CookbookDishList } from './cookbook-dish-list'
import { CopyField } from '@/components/copy-button'
import { ConfirmDialog } from '@/components/modal'
import { NoteTime } from '@/components/notes/note-time'
import type { useCookbookView } from '@/hooks/use-cookbook-view'
import type { CookbookPlace } from '@/types/cookbook'

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
const QUIET_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
const DANGER_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-danger/50 hover:bg-danger/5 hover:text-danger'

/** What the panel shows of the player's book, as its owner reads it. */
type Read = ReturnType<typeof useCookbookView>

/**
 * A player's Magical Recipe Book, from module 0.38.0: the link code their character's book in the
 * cookbook sends its dishes with, made, shown once, replaced or revoked here, and what became of
 * each dish it sent. Since round 0.39.0 it's the body of the modal the sheet's cog opens, its owner
 * reading it; and it never hides there: while the game takes no dishes and the character has no
 * link, as after a revoke then, it says so and offers no code, so no player makes one before their
 * Gamemaster takes dishes.
 */
export function CookbookPanel({
  view,
  reload,
  fresh,
  setFresh,
  make,
  revoke,
}: Readonly<Read & Omit<CookbookPlace, 'characterId'>>) {
  const [refused, setRefused] = useState<string>()
  const [making, startMaking] = useTransition()
  // Where focus goes once the control is there: Copy link code once Make a link code has made one,
  // as the button pressed is gone with it; Make a new code after Done; Make a link code after a
  // revoke, whose own button is gone with the link.
  const focusTo = useRef<'copy' | 'again' | 'make'>(undefined)
  const root = useRef<HTMLDivElement>(null)
  const madeBlock = useRef<HTMLDivElement>(null)
  const again = useRef<HTMLSpanElement>(null)
  const makeButton = useRef<HTMLButtonElement>(null)
  // No code to offer: while the game takes no dishes and the character has no link.
  const off = !!view && !view.enabled && !view.link
  useEffect(() => {
    // Only focus lost with the control pressed, never taken from where its player has gone since:
    // to the page, or to the dialog it's in, as a button removed inside a modal may leave it.
    const active = document.activeElement
    const dialog = root.current?.closest('dialog')
    const lost = active === document.body || (!!dialog && active === dialog)
    if (off && focusTo.current) {
      // Nothing to give it to, as after a revoke while the game takes no dishes: it stays in the
      // dialog, on its first control, its Close, and by the time a code is offered again its player
      // has moved on.
      focusTo.current = undefined
      if (lost) dialog?.querySelector('button')?.focus()
      return
    }
    const targets = {
      // The code's own field is the block's first button.
      copy: () => madeBlock.current?.querySelector('button'),
      again: () => again.current?.closest('button'),
      make: () => makeButton.current,
    }
    const target = focusTo.current && targets[focusTo.current]()
    if (!target) return
    focusTo.current = undefined
    if (lost) target.focus()
  })

  if (!view) return

  /**
   * Shows the code made, or why none was. Made by Make a link code, focus goes on to copying it;
   * Make a new code's dialog gives focus back to its own button as it closes.
   */
  const made = async (by: 'first' | 'another') => {
    const answer = await make()
    if ('code' in answer) {
      if (by === 'first') focusTo.current = 'copy'
      setFresh(answer.code)
    } else setRefused(answer.message)
    await reload()
  }
  const makeFirst = () =>
    startMaking(async () => {
      setRefused(undefined)
      await made('first')
    })
  const makeAnother = async () => {
    setRefused(undefined)
    setFresh(undefined)
    await made('another')
  }
  const revokeCode = async () => {
    setRefused(undefined)
    await revoke()
    setFresh(undefined)
    focusTo.current = 'make'
    await reload()
  }
  const done = () => {
    focusTo.current = 'again'
    setFresh(undefined)
  }

  const { link, dishes } = view
  const offLine = (
    <p className='text-sm text-warning'>
      Your Gamemaster’s game isn’t taking dishes right now.
    </p>
  )
  return (
    <div ref={root} className='flex flex-col gap-3'>
      <div className='flex min-w-0 items-start gap-3'>
        <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text'>
          <CookingPot aria-hidden className='size-5' />
        </span>
        <p className='min-w-0 text-sm text-text-secondary'>
          Send dishes you cook in the Magical Recipe Book to this game. Your
          Gamemaster chooses who ate them in Foundry.
        </p>
      </div>

      {fresh && (
        <div
          ref={madeBlock}
          role='status'
          className='grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm'
        >
          <p>
            Copy it now: Sending Stone keeps only a check of it, so it can’t be
            shown again. In the Magical Recipe Book, open this character’s menu
            and choose <strong>Link Sending Stone</strong>, or{' '}
            <strong>Sending Stone Link</strong> if it’s linked already. Paste it
            there.
          </p>
          <CopyField value={fresh} label='link code' wrap />
          <button
            type='button'
            onClick={done}
            className={`${PRIMARY_BUTTON} justify-self-end px-5`}
          >
            Done
          </button>
        </div>
      )}

      {link && (
        <>
          <p className='text-sm break-words'>
            Linked with a code ending …{link.hint}, made{' '}
            <NoteTime value={link.createdAt} />
            {link.lastUsedAt ? (
              <>
                {' '}
                · last dish <NoteTime value={link.lastUsedAt} />
              </>
            ) : (
              ' · not used yet'
            )}
          </p>
          {!view.enabled && offLine}
          <div className='flex flex-wrap gap-2'>
            <ConfirmDialog
              trigger={<span ref={again}>Make a new code</span>}
              triggerClassName={QUIET_BUTTON}
              title='Make a new link code?'
              confirmLabel='Make a new code'
              onConfirm={makeAnother}
            >
              <p>
                The old code stops working, and the Magical Recipe Book needs
                the new one.
              </p>
            </ConfirmDialog>
            <ConfirmDialog
              trigger='Revoke'
              triggerClassName={DANGER_BUTTON}
              title='Revoke this link code?'
              confirmLabel='Revoke'
              onConfirm={revokeCode}
              danger
            >
              <p>
                Dishes from the Magical Recipe Book stop reaching this game
                until you make a new code.
              </p>
            </ConfirmDialog>
          </div>
        </>
      )}
      {/* Not linked, and the game takes no dishes: no code to make, until it does. */}
      {off && offLine}
      {/* Not linked: but not while a code just made waits for the view that says it's linked. */}
      {!link && !fresh && !off && (
        <div className='flex flex-wrap gap-2'>
          <button
            ref={makeButton}
            type='button'
            onClick={makeFirst}
            disabled={making}
            className={PRIMARY_BUTTON}
          >
            {making && (
              <LoaderCircle aria-hidden className='size-4 animate-spin' />
            )}
            Make a link code
          </button>
        </div>
      )}
      {refused && (
        <p role='alert' className='text-sm text-danger'>
          {refused}
        </p>
      )}

      {dishes.length > 0 && (
        <CookbookDishList dishes={dishes} live={view.live} />
      )}
      {dishes.length === 0 && link && (
        <p className='text-sm text-text-secondary'>No dishes sent yet.</p>
      )}
    </div>
  )
}
