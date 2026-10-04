'use client'

import { useActionState, useId, type InputHTMLAttributes } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import {
  CAMPAIGN_TITLE_EXAMPLE,
  CAMPAIGN_TITLE_MAX_LENGTH,
  GAME_URL_EXAMPLE,
  NAME_MAX_LENGTH,
} from '@/constants/character'
import type { CharacterFormState } from '@/types/character'

type Props = {
  action: (
    state: CharacterFormState,
    formData: FormData,
  ) => Promise<CharacterFormState>
}

export function CharacterForm({ action }: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form
      action={formAction}
      className='grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6'
    >
      <Field
        label='Character name'
        name='name'
        defaultValue={state.values?.name}
        errors={state.errors?.name}
        maxLength={NAME_MAX_LENGTH}
        autoComplete='off'
        required
      />
      <Field
        label='Campaign title'
        name='campaignTitle'
        hint='The title your Gamemaster gave the campaign in Sending Stone.'
        defaultValue={state.values?.campaignTitle}
        errors={state.errors?.campaignTitle}
        placeholder={CAMPAIGN_TITLE_EXAMPLE}
        maxLength={CAMPAIGN_TITLE_MAX_LENGTH}
        autoComplete='off'
        required
      />
      <Field
        label='Forge game address'
        name='gameUrl'
        hint='The address you open to join the game on The Forge.'
        defaultValue={state.values?.gameUrl}
        errors={state.errors?.gameUrl}
        placeholder={GAME_URL_EXAMPLE}
        inputMode='url'
        autoCapitalize='none'
        autoCorrect='off'
        spellCheck={false}
        required
      />
      {state.message && (
        <p role='alert' className='text-sm text-danger'>
          {state.message}
        </p>
      )}
      <button
        type='submit'
        disabled={pending}
        className='inline-flex h-11 items-center justify-center gap-2 justify-self-start rounded-xl bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
      >
        {pending ? (
          <LoaderCircle aria-hidden className='size-4 animate-spin' />
        ) : (
          <Plus aria-hidden className='size-4' />
        )}
        Add character
      </button>
    </form>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  hint?: string
  errors?: string[]
}

function Field({ label, hint, errors, ...input }: Readonly<FieldProps>) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const error = errors?.[0]
  const describedBy = [hint && hintId, error && errorId].filter(Boolean)

  return (
    <div className='grid gap-1.5'>
      <label htmlFor={id} className='text-sm font-medium'>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.join(' ') || undefined}
        className='h-11 rounded-xl border border-border bg-page px-3.5 outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger'
        {...input}
      />
      {hint && (
        <p id={hintId} className='text-sm text-text-secondary'>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className='text-sm text-danger'>
          {error}
        </p>
      )}
    </div>
  )
}
