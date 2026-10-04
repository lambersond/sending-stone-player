'use client'

import { useActionState, useId } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { InviteFormState } from '@/types/campaign'

type Props = {
  action: (
    state: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>
}

/** Where a player pastes the invite link their Gamemaster shared. */
export function InviteForm({ action }: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <form
      action={formAction}
      className='grid gap-1.5 rounded-2xl border border-border bg-card p-5 sm:p-6'
    >
      <label htmlFor={id} className='text-sm font-medium'>
        Invite link
      </label>
      <div className='flex flex-col gap-2 sm:flex-row'>
        <input
          id={id}
          name='invite'
          defaultValue={state.value}
          placeholder='https://…/join/…'
          autoComplete='off'
          autoCapitalize='none'
          spellCheck={false}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={[hintId, state.error && errorId]
            .filter(Boolean)
            .join(' ')}
          className='h-11 min-w-0 flex-1 rounded-xl border border-border bg-page px-3.5 outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger'
        />
        <button
          type='submit'
          disabled={pending}
          className='inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          {pending && (
            <LoaderCircle aria-hidden className='size-4 animate-spin' />
          )}
          Join campaign
        </button>
      </div>
      <p id={hintId} className='text-sm text-text-secondary'>
        Your Gamemaster shares this link from their campaign in Sending Stone.
        Opening it also works.
      </p>
      {state.error && (
        <p id={errorId} className='text-sm text-danger'>
          {state.error}
        </p>
      )}
    </form>
  )
}
