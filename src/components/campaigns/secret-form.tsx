'use client'

import { useActionState, useId } from 'react'
import { LoaderCircle } from 'lucide-react'
import { SECRET_MAX_LENGTH, SECRET_MIN_LENGTH } from '@/constants/campaign'
import type { SecretFormState } from '@/types/campaign'

type Props = {
  action: (
    state: SecretFormState,
    formData: FormData,
  ) => Promise<SecretFormState>
}

/** Replace a campaign's secret, such as after changing the one the module sends. */
export function SecretForm({ action }: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})
  const id = useId()
  const errorId = `${id}-error`

  return (
    <form action={formAction} className='grid gap-1.5'>
      <label htmlFor={id} className='text-sm font-medium'>
        New secret
      </label>
      <div className='flex gap-2'>
        <input
          id={id}
          name='secret'
          minLength={SECRET_MIN_LENGTH}
          maxLength={SECRET_MAX_LENGTH}
          autoComplete='off'
          autoCapitalize='none'
          spellCheck={false}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          className='h-10 min-w-0 flex-1 rounded-xl border border-border bg-page px-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger'
        />
        <button
          type='submit'
          disabled={pending}
          className='inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
        >
          {pending && (
            <LoaderCircle aria-hidden className='size-4 animate-spin' />
          )}
          Save secret
        </button>
      </div>
      {state.error && (
        <p id={errorId} className='text-sm text-danger'>
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role='status' className='text-sm text-primary'>
          Saved. Enter the same secret in the module&apos;s Configure
          Connection.
        </p>
      )}
    </form>
  )
}
