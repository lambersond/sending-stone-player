import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { RemoveCharacterButton } from './remove-character-button'
import { Avatar } from '@/components/avatar'
import { gameHost } from '@/utils/game-host'
import type { Character } from '@/types/character'

type Props = {
  characters: Character[]
  onRemove: (characterId: string) => Promise<void>
}

export function CharacterList({ characters, onRemove }: Readonly<Props>) {
  return (
    <ul className='grid grid-cols-1 gap-3'>
      {characters.map(character => (
        <li
          key={character.id}
          className='group flex items-center rounded-2xl border border-border bg-card pr-2 transition-colors hover:border-primary/50'
        >
          <Link
            href={`/characters/${character.id}`}
            className='flex min-w-0 flex-1 items-center gap-4 rounded-l-2xl p-4'
          >
            <Avatar name={character.name} className='size-11 text-lg' />
            <span className='min-w-0 flex-1'>
              <span className='block truncate font-medium'>
                {character.name}
              </span>
              <span className='block truncate text-sm text-text-secondary'>
                {character.campaignTitle || 'No campaign'} ·{' '}
                {gameHost(character.gameUrl)}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className='size-5 text-text-secondary transition-colors group-hover:text-primary'
            />
          </Link>
          <RemoveCharacterButton
            characterId={character.id}
            name={character.name}
            onRemove={onRemove}
          />
        </li>
      ))}
    </ul>
  )
}
