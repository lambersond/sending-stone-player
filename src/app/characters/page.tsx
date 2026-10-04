import { addCharacter, removeCharacter } from './actions'
import { Avatar } from '@/components/avatar'
import { CharacterForm } from '@/components/character-form'
import { CharacterList } from '@/components/character-list'
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
            You have no characters yet. Add one below.
          </p>
        )}
      </section>

      <section aria-labelledby='add-heading' className='mt-10'>
        <h2 id='add-heading' className='mb-4 text-lg font-semibold'>
          Add a character
        </h2>
        <CharacterForm action={addCharacter} />
      </section>
    </div>
  )
}
