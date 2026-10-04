'use client'

import { useActionState } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'

type Props = {
  choice: CampaignChoice
  action: (
    state: ChooseCharacterFormState,
    formData: FormData,
  ) => Promise<ChooseCharacterFormState>
  /** The button's label. */
  submitLabel?: string
}

/**
 * A campaign's characters to choose from. Each is one player's, so those already chosen are not
 * offered.
 */
export function CharacterChooser({
  choice,
  action,
  submitLabel = 'Choose character',
}: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})

  if (choice.characters.length === 0) {
    return (
      <p className='rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-secondary'>
        {choice.title} hasn&apos;t sent its characters yet. Once your Gamemaster
        opens the game with Sending Stone connected, they&apos;ll be listed
        here.
      </p>
    )
  }

  const open = choice.characters.some(({ claimedBy }) => !claimedBy)
  return (
    <form action={formAction} className='grid gap-4'>
      <fieldset className='grid gap-2'>
        <legend className='mb-2 text-sm font-medium'>
          Which character are you playing?
        </legend>
        {choice.characters.map(({ id, name, claimedBy }) => (
          <label
            key={id}
            className={clsx(
              'flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors',
              claimedBy
                ? 'opacity-60'
                : 'cursor-pointer hover:border-primary/50 has-checked:border-primary has-checked:bg-primary/5',
            )}
          >
            <input
              type='radio'
              name='actorId'
              value={id}
              disabled={claimedBy !== undefined}
              required
              className='size-4 accent-primary'
            />
            <Avatar name={name} className='size-9' />
            <span className='min-w-0 flex-1 truncate font-medium'>{name}</span>
            {claimedBy && (
              <span className='shrink-0 text-xs font-semibold text-text-secondary'>
                {claimedBy === 'you' ? 'Already yours' : 'Taken'}
              </span>
            )}
          </label>
        ))}
      </fieldset>
      {state.message && (
        <p role='alert' className='text-sm text-danger'>
          {state.message}
        </p>
      )}
      {open ? (
        <button
          type='submit'
          disabled={pending}
          className='inline-flex h-11 items-center justify-center gap-2 justify-self-start rounded-xl bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          {pending && (
            <LoaderCircle aria-hidden className='size-4 animate-spin' />
          )}
          {submitLabel}
        </button>
      ) : (
        <p className='text-sm text-text-secondary'>
          Every character has been chosen. If one of them is yours, ask the
          player who chose it to remove it.
        </p>
      )}
    </form>
  )
}
