import clsx from 'clsx'
import { Dices, KeyRound, RefreshCw, Trash2, UserMinus } from 'lucide-react'
import { SecretForm } from './secret-form'
import { CopyField } from '@/components/copy-button'
import { LocalTime } from '@/components/game-table/local-time'
import { ConfirmDialog } from '@/components/modal'
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
  /** Remove the player's character with this id from the campaign. */
  removePlayer: (characterId: string) => Promise<void>
  remove: () => Promise<void>
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
const DANGER_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'

/**
 * One of a Gamemaster's campaigns: whether Foundry is connected, its invite link and its players.
 */
export function CampaignCard({
  campaign,
  inviteUrl,
  changeSecret,
  resetInvite,
  removePlayer,
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
          <ConfirmDialog
            trigger={
              <>
                <RefreshCw aria-hidden className='size-4' />
                Reset link
              </>
            }
            triggerClassName={QUIET_BUTTON}
            title='Reset the invite link?'
            confirmLabel='Reset link'
            onConfirm={resetInvite}
          >
            <p>
              The current link to {campaign.title} stops working and a new one
              takes its place. Players who already joined keep their characters.
            </p>
          </ConfirmDialog>
        </div>
      </section>

      <section className='grid gap-2'>
        <h4 className='text-sm font-medium'>Characters</h4>
        {campaign.characters.length > 0 ? (
          <ul className='grid gap-1.5 text-sm'>
            {campaign.characters.map(character => (
              <li
                key={character.id}
                className='flex min-h-10 items-center justify-between gap-3 rounded-lg bg-page py-1 pr-1 pl-3'
              >
                <span className='truncate font-medium'>{character.name}</span>
                <span className='flex shrink-0 items-center gap-1'>
                  <span
                    className={clsx(
                      'text-xs',
                      character.player
                        ? 'font-semibold text-primary'
                        : 'pr-2 text-text-secondary',
                    )}
                  >
                    {character.player ?? 'Not chosen yet'}
                  </span>
                  {character.player && character.characterId && (
                    <ConfirmDialog
                      trigger={<UserMinus aria-hidden className='size-4' />}
                      triggerLabel={`Remove ${character.player} as ${character.name}`}
                      triggerClassName='rounded-md p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger'
                      title={`Remove ${character.player} as ${character.name}?`}
                      confirmLabel='Remove'
                      onConfirm={removePlayer.bind(
                        undefined,
                        character.characterId,
                      )}
                      danger
                    >
                      <p>
                        {character.player} stops following {campaign.title} as{' '}
                        {character.name}, and {character.name} can be chosen
                        again from the invite link.
                      </p>
                    </ConfirmDialog>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-text-secondary'>
            {campaign.rosterReceived
              ? 'Foundry sent no characters for this campaign. Tick its characters in Manage Campaigns in Foundry.'
              : 'The campaign’s characters appear here once Foundry sends them. Reloading the game in Foundry sends them at once.'}
          </p>
        )}
      </section>

      <section className='grid gap-1'>
        <h4 className='flex items-center gap-1.5 text-sm font-medium'>
          <Dices aria-hidden className='size-4 text-text-secondary' />
          Players&apos; rolls
        </h4>
        <p className='text-sm text-text-secondary'>{rollsText(campaign)}</p>
      </section>

      <footer className='flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4'>
        <details className='group min-w-0 flex-1'>
          <summary className={clsx(QUIET_BUTTON, 'cursor-pointer')}>
            <KeyRound aria-hidden className='size-4' />
            Change secret
          </summary>
          <div className='mt-3 max-w-md'>
            <SecretForm action={changeSecret} />
          </div>
        </details>
        <ConfirmDialog
          trigger={
            <>
              <Trash2 aria-hidden className='size-4' />
              Delete campaign
            </>
          }
          triggerClassName={DANGER_BUTTON}
          title={`Delete ${campaign.title}?`}
          confirmLabel='Delete campaign'
          onConfirm={remove}
          danger
        >
          <p>
            Its chat and combats are deleted, and its players&apos; characters
            stop following it. This can&apos;t be undone.
          </p>
          <p>
            To set it up again, you would need a new invite link for your
            players.
          </p>
        </ConfirmDialog>
      </footer>
    </article>
  )
}

/**
 * Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be; and
 * whether they're asked here for the saves the game asks of them.
 */
function rollsText(campaign: OwnedCampaign): string {
  const { rolls } = campaign
  const made = madeText(campaign)
  return rolls.enabled && rolls.reaching && rolls.prompts
    ? `${made} When your game asks one of their characters for a saving throw, such as a concentration check, its player is asked here to roll it.`
    : made
}

/** Whether the players' rolls are made in the Gamemaster's game, and if not, how they could be. */
function madeText({ rolls }: OwnedCampaign): string {
  if (rolls.enabled && rolls.reaching && rolls.spells) {
    return 'Checks, saves, initiative, death saves, attacks and spells your players roll and cast here are made in your game too, with the same dice. Their attacks, spells and features spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching && rolls.attacks) {
    return 'Checks, saves, initiative, death saves and attacks your players roll here are made in your game too, with the same dice. Their attacks spend ammunition, uses and spell slots there.'
  }
  if (rolls.enabled && rolls.reaching) {
    return 'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice. Their attacks and spells stay here: to have them made in your game too, tick Let players attack and cast from Sending Stone in Manage Campaigns in Foundry.'
  }
  if (rolls.enabled) {
    return 'Turned on in Foundry. Players’ rolls reach your game while it’s open; for now they stay here.'
  }
  return 'They stay here. To have them made in your game with the same dice, tick Let players roll from Sending Stone for this campaign in Manage Campaigns in Foundry.'
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
