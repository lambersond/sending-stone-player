import { Ticket } from 'lucide-react'
import Link from 'next/link'
import { INVITE_PAGE } from './constants'
import { joinAsCharacter } from '@/app/characters/actions'
import { findInvite } from '@/db/campaigns'
import { CharacterChooser } from '@/features/characters/components/character-chooser/character-chooser'
import { gameHost } from '@/utils/game-host'

/**
 * A campaign's invite, for the signed-in player to choose which of its characters they play, or
 * that the link doesn't work (v0.48.0: read once the page has its user, its outline shimmering
 * until then).
 */
export async function InviteChoice({
  code,
  userId,
}: Readonly<{ code: string; userId: string }>) {
  const choice = await findInvite(code, userId)

  if (!choice) {
    return (
      <div className='mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center'>
        <Ticket aria-hidden className='size-8 text-primary' />
        <h1 className='mt-4 text-xl font-semibold'>
          This invite link doesn&apos;t work
        </h1>
        <p className='mt-2 text-text-secondary'>
          Your Gamemaster may have replaced it with a new one. Ask them for the
          campaign&apos;s current invite link.
        </p>
        <Link
          href='/characters'
          className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10'
        >
          Your characters
        </Link>
      </div>
    )
  }

  const yours = choice.characters.filter(({ claimedBy }) => claimedBy === 'you')
  const details = [
    choice.worldTitle,
    gameHost(choice.gameUrl),
    choice.gamemaster && `run by ${choice.gamemaster}`,
  ].filter(Boolean)

  return (
    <div className={INVITE_PAGE}>
      <p className='text-sm text-text-secondary'>You&apos;re invited to</p>
      <h1 className='mt-1 text-2xl font-semibold tracking-tight'>
        {choice.title}
      </h1>
      <p className='mt-1 text-sm text-text-secondary'>{details.join(' · ')}</p>
      {yours.length > 0 && (
        <p className='mt-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm'>
          You&apos;re already playing{' '}
          {yours.map(({ characterId, name }, index) => (
            <span key={characterId}>
              {index > 0 && ', '}
              <Link
                href={`/characters/${characterId}`}
                className='font-semibold text-primary-text hover:underline'
              >
                {name}
              </Link>
            </span>
          ))}{' '}
          in this campaign.
        </p>
      )}
      <div className='mt-8'>
        <CharacterChooser
          choice={choice}
          action={joinAsCharacter.bind(undefined, code)}
          submitLabel='Join as this character'
        />
      </div>
    </div>
  )
}
