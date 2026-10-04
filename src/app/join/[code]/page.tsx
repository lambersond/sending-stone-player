import { Ticket } from 'lucide-react'
import Link from 'next/link'
import { joinAsCharacter } from '@/app/characters/actions'
import { CharacterChooser } from '@/components/character-chooser'
import { JOIN_PATH } from '@/constants/campaign'
import { findInvite } from '@/db/campaigns'
import { requireUser } from '@/lib/session'
import { gameHost } from '@/utils/game-host'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Join a campaign' }

/** A campaign's invite link: a signed-in player chooses which of its characters they play. */
export default async function JoinPage({ params }: PageProps<'/join/[code]'>) {
  const { code } = await params
  const user = await requireUser(`${JOIN_PATH}/${code}`)
  const choice = await findInvite(code, user.id)

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
          className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
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
    <div className='mx-auto w-full max-w-xl px-4 py-10 sm:py-14'>
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
                className='font-semibold text-primary hover:underline'
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
