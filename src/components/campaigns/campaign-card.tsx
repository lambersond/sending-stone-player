import clsx from 'clsx'
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { ConfirmButton } from './confirm-button'
import { SecretForm } from './secret-form'
import { CopyField } from '@/components/copy-button'
import { LocalTime } from '@/components/game-table/local-time'
import { gameHost } from '@/utils/game-host'
import type { OwnedCampaign, SecretFormState } from '@/types/campaign'

type Props = {
  campaign: OwnedCampaign
  inviteUrl: string
  changeSecret: (
    state: SecretFormState,
    formData: FormData,
  ) => Promise<SecretFormState>
  resetInvite: () => Promise<void>
  remove: () => Promise<void>
}

/**
 * One of a Gamemaster's campaigns: whether Foundry is connected, its invite link and its players.
 */
export function CampaignCard({
  campaign,
  inviteUrl,
  changeSecret,
  resetInvite,
  remove,
}: Readonly<Props>) {
  const details = [campaign.worldTitle, gameHost(campaign.gameUrl)].filter(
    Boolean,
  )
  return (
    <article
      aria-labelledby={`campaign-${campaign.id}`}
      className='grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6'
    >
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3
            id={`campaign-${campaign.id}`}
            className='truncate text-lg font-semibold'
          >
            {campaign.title}
          </h3>
          <p className='truncate text-sm text-text-secondary'>
            {details.join(' · ')}
          </p>
        </div>
        <FoundryStatus campaign={campaign} />
      </header>

      <section className='grid gap-1.5'>
        <h4 className='text-sm font-medium'>Invite link</h4>
        <CopyField value={inviteUrl} label='invite link' />
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-sm text-text-secondary'>
            Share it with your players. They sign in and choose their character.
          </p>
          <ConfirmButton
            icon={<RefreshCw aria-hidden className='size-4' />}
            label='Reset link'
            question='Stop this link working and make a new one?'
            confirmLabel='Reset link'
            onConfirm={resetInvite}
          />
        </div>
      </section>

      <section className='grid gap-2'>
        <h4 className='text-sm font-medium'>Characters</h4>
        {campaign.characters.length > 0 ? (
          <ul className='grid gap-1.5 text-sm'>
            {campaign.characters.map(character => (
              <li
                key={character.id}
                className='flex items-baseline justify-between gap-3 rounded-lg bg-page px-3 py-2'
              >
                <span className='truncate font-medium'>{character.name}</span>
                <span
                  className={clsx(
                    'shrink-0 text-xs',
                    character.player
                      ? 'font-semibold text-primary'
                      : 'text-text-secondary',
                  )}
                >
                  {character.player ?? 'Not chosen yet'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-text-secondary'>
            The campaign&apos;s characters appear here once Foundry connects.
          </p>
        )}
      </section>

      <footer className='flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4'>
        <details className='group min-w-0 flex-1'>
          <summary className='inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'>
            <KeyRound aria-hidden className='size-4' />
            Change secret
          </summary>
          <div className='mt-3 max-w-md'>
            <SecretForm action={changeSecret} />
          </div>
        </details>
        <ConfirmButton
          icon={<Trash2 aria-hidden className='size-4' />}
          label='Remove campaign'
          question='Remove it, with its chat and combats?'
          confirmLabel='Remove'
          onConfirm={remove}
          danger
        />
      </footer>
    </article>
  )
}

function FoundryStatus({ campaign }: Readonly<{ campaign: OwnedCampaign }>) {
  let label = 'Waiting for Foundry'
  let dot = 'bg-text-secondary'
  if (campaign.live) {
    label = 'Live'
    dot = 'bg-primary motion-safe:animate-pulse'
  } else if (campaign.connected) {
    label = 'Offline'
  }
  return (
    <span className='inline-flex shrink-0 flex-col items-end gap-0.5'>
      <span className='inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-semibold'>
        <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
        {label}
      </span>
      {!campaign.live && campaign.lastSeenAt && (
        <span className='text-xs text-text-secondary'>
          Last heard <LocalTime value={campaign.lastSeenAt} />
        </span>
      )}
    </span>
  )
}
