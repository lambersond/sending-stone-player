'use client'

import { useActionState, useId } from 'react'
import { Flag, LoaderCircle } from 'lucide-react'
import {
  CAMPAIGN_TITLE_EXAMPLE,
  CAMPAIGN_TITLE_MAX_LENGTH,
} from '@/constants/character'
import type { CampaignTitleFormState, Character } from '@/types/character'

type Props = {
  character: Character
  action: (
    state: CampaignTitleFormState,
    formData: FormData,
  ) => Promise<CampaignTitleFormState>
}

/** Asks for the campaign of a character made before characters belonged to campaigns. */
export function CampaignTitlePrompt({ character, action }: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className='mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center md:py-16'>
      <Flag aria-hidden className='size-8 text-primary' />
      <h2 className='mt-4 text-lg font-semibold'>
        Which campaign is {character.name} in?
      </h2>
      <p className='mt-1 text-sm text-text-secondary'>
        Characters now follow a campaign. Enter the title your Gamemaster gave
        it in Sending Stone.
      </p>
      <form action={formAction} className='mt-6 grid w-full gap-2 text-left'>
        <label htmlFor={id} className='text-sm font-medium'>
          Campaign title
        </label>
        <input
          id={id}
          name='campaignTitle'
          defaultValue={state.value}
          placeholder={CAMPAIGN_TITLE_EXAMPLE}
          maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
          autoComplete='off'
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          className='h-11 rounded-xl border border-border bg-page px-3.5 outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger'
        />
        {state.error && (
          <p id={errorId} className='text-sm text-danger'>
            {state.error}
          </p>
        )}
        <button
          type='submit'
          disabled={pending}
          className='mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          {pending && (
            <LoaderCircle aria-hidden className='size-4 animate-spin' />
          )}
          Save campaign
        </button>
      </form>
    </div>
  )
}
