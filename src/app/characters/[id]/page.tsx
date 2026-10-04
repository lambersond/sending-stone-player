import { cache } from 'react'
import { ArrowLeft, ExternalLink, Radio } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Avatar } from '@/components/avatar'
import { getCharacter } from '@/db/characters'
import { requireUser } from '@/lib/session'
import { gameHost } from '@/utils/game-host'
import type { Metadata } from 'next'

type Props = PageProps<'/characters/[id]'>

const findCharacter = cache(async (characterId: string) => {
  const user = await requireUser()
  return getCharacter(user.id, characterId)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const character = await findCharacter(id)
  return { title: character?.name ?? 'Character' }
}

export default async function CharacterPage({ params }: Props) {
  const { id } = await params
  const character = await findCharacter(id)
  if (!character) notFound()

  return (
    <div className='mx-auto w-full max-w-3xl px-4 py-10 sm:py-14'>
      <Link
        href='/characters'
        className='inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary'
      >
        <ArrowLeft aria-hidden className='size-4' />
        All characters
      </Link>

      <header className='mt-6 flex items-center gap-4'>
        <Avatar name={character.name} className='size-14 text-xl' />
        <div className='min-w-0'>
          <h1 className='truncate text-2xl font-semibold tracking-tight'>
            {character.name}
          </h1>
          <a
            href={character.gameUrl}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1 text-sm text-primary hover:underline'
          >
            {gameHost(character.gameUrl)}
            <ExternalLink aria-hidden className='size-3.5' />
            <span className='sr-only'>(opens in a new tab)</span>
          </a>
        </div>
      </header>

      <section className='mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center'>
        <Radio aria-hidden className='size-8 text-primary' />
        <h2 className='mt-4 font-semibold'>Waiting for the table</h2>
        <p className='mt-1 max-w-md text-sm text-text-secondary'>
          Chat, rolls and combat from this game will show here once its Sending
          Stone events are connected.
        </p>
      </section>
    </div>
  )
}
