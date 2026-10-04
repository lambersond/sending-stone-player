'use client'

import {
  useActionState,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'
import clsx from 'clsx'
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import { CopyField } from '@/components/copy-button'
import {
  CAMPAIGN_TITLE_EXAMPLE,
  CAMPAIGN_TITLE_MAX_LENGTH,
  GAME_URL_EXAMPLE,
  SECRET_MAX_LENGTH,
  SECRET_MIN_LENGTH,
} from '@/constants/campaign'
import type { CampaignSetupFormState } from '@/types/campaign'

type Props = {
  action: (
    state: CampaignSetupFormState,
    formData: FormData,
  ) => Promise<CampaignSetupFormState>
  /** A random secret to start from. */
  suggestedSecret: string
  /** Called when the Gamemaster is done with the campaign just set up. */
  onDone: () => void
}

export function CampaignSetupForm({
  action,
  suggestedSecret,
  onDone,
}: Readonly<Props>) {
  const [state, formAction, pending] = useActionState(action, {})
  const secret = useRef<HTMLInputElement>(null)
  const generate = () => {
    if (secret.current) secret.current.value = randomSecret()
  }

  if (state.saved) {
    return (
      <div role='status' className='grid gap-4 text-sm'>
        <p>
          <strong>{state.saved.title}</strong> is set up. Copy its secret now:
          Sending Stone keeps only a check of it, so it can&apos;t be shown
          again.
        </p>
        <CopyField value={state.saved.secret} label='secret' />
        <p className='text-text-secondary'>
          In Foundry, enter it beside the campaign in Manage Campaigns, under
          the same title.
        </p>
        <button
          type='button'
          onClick={onDone}
          className='inline-flex h-11 items-center justify-center justify-self-end rounded-xl bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover'
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className='grid gap-4'>
      <form action={formAction} className='grid gap-5'>
        <Field
          label='Campaign title'
          name='title'
          hint='The same title as the campaign in Manage Campaigns in Foundry. Case doesn’t matter.'
          defaultValue={state.values?.title}
          errors={state.errors?.title}
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
        <Field
          ref={secret}
          label='Secret'
          name='secret'
          hint={`Enter the same secret beside this campaign in Manage Campaigns in Foundry. At least ${SECRET_MIN_LENGTH} characters.`}
          defaultValue={state.values?.secret ?? suggestedSecret}
          errors={state.errors?.secret}
          minLength={SECRET_MIN_LENGTH}
          maxLength={SECRET_MAX_LENGTH}
          autoComplete='off'
          autoCapitalize='none'
          spellCheck={false}
          className='font-mono text-sm'
          required
        >
          <button
            type='button'
            onClick={generate}
            className='inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
          >
            <RefreshCw aria-hidden className='size-4' />
            Generate
          </button>
        </Field>
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
          Set up campaign
        </button>
      </form>
    </div>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>
  label: string
  name: string
  hint: string
  errors?: string[]
  /** Beside the input, such as a button acting on it. */
  children?: ReactNode
}

function Field({
  label,
  hint,
  errors,
  children,
  className,
  ...input
}: Readonly<FieldProps>) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const error = errors?.[0]

  return (
    <div className='grid gap-1.5'>
      <label htmlFor={id} className='text-sm font-medium'>
        {label}
      </label>
      <div className='flex gap-2'>
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error && errorId]
            .filter(Boolean)
            .join(' ')}
          className={clsx(
            'h-11 min-w-0 flex-1 rounded-xl border border-border bg-page px-3.5 outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger',
            className,
          )}
          {...input}
        />
        {children}
      </div>
      <p id={hintId} className='text-sm text-text-secondary'>
        {hint}
      </p>
      {error && (
        <p id={errorId} className='text-sm text-danger'>
          {error}
        </p>
      )}
    </div>
  )
}

/** A random secret, as long and URL-safe as the server's. */
function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
