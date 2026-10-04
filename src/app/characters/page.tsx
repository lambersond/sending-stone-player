import { Flag } from 'lucide-react'
import Link from 'next/link'
import { openInvite, removeCharacter } from './actions'
import { Avatar } from '@/components/avatar'
import { CharacterList } from '@/components/character-list'
import { InviteForm } from '@/components/invite-form'
import { listCharacters } from '@/db/characters'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your characters' }

export default async function CharactersPage() {
  const user = await requireUser()
  const characters = await listCharacters(user.id)

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
        {characters.length > 0 ? (
          <CharacterList characters={characters} onRemove={removeCharacter} />
        ) : (
          <p className='rounded-2xl border border-dashed border-border p-6 text-center text-text-secondary'>
            You have no characters yet. Join a campaign below to choose one.
          </p>
        )}
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
