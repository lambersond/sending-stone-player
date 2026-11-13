import { Flag } from 'lucide-react'
import Link from 'next/link'
import { openInvite } from './actions'
import { Avatar } from '@/components/avatar/avatar'
import { InviteForm } from '@/features/characters/components/invite-form/invite-form'
import type { SessionUser } from '@/lib/types'
import type { ReactNode } from 'react'

/**
 * The signed-in player's page: who they are, their characters to choose from, and a campaign to
 * join. All of it is known once the page has its user, and drawn at once (v0.48.0), but for the
 * characters themselves, `children`, which stream in once they're read.
 */
export function YourCharacters({
  user,
  children,
}: Readonly<{ user: SessionUser; children: ReactNode }>) {
  return (
    <div className='mx-auto w-full max-w-3xl px-4 py-10 sm:py-14'>
      <header className='flex items-center gap-4'>
        <Avatar
          name={user.name}
          image={user.image}
          className='size-14 text-xl'
        />
        <div className='min-w-0'>
          <p className='text-sm text-text-secondary'>Welcome back</p>
          <h1 className='truncate text-2xl font-semibold tracking-tight'>
            {user.name}
          </h1>
        </div>
      </header>

      <section aria-labelledby='choose-heading' className='mt-10'>
        <h2 id='choose-heading' className='text-lg font-semibold'>
          Choose a character
        </h2>
        <p className='mt-1 mb-4 text-text-secondary'>
          Pick who you are playing to follow their game.
        </p>
        {children}
      </section>

      <section aria-labelledby='join-heading' className='mt-10'>
        <h2 id='join-heading' className='text-lg font-semibold'>
          Join a campaign
        </h2>
        <p className='mt-1 mb-4 text-text-secondary'>
          Open your Gamemaster&apos;s invite link, or paste it here, then choose
          your character.
        </p>
        <InviteForm action={openInvite} />
      </section>

      <p className='mt-10 flex items-center gap-2 text-sm text-text-secondary'>
        <Flag aria-hidden className='size-4 shrink-0 text-primary' />
        <span>
          Running a game?{' '}
          <Link
            href='/campaigns'
            className='font-medium text-primary hover:underline'
          >
            Set up your campaign
          </Link>{' '}
          to invite your players.
        </span>
      </p>
    </div>
  )
}
