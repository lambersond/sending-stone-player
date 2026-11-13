import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import {
  CHARACTER_AVATAR,
  CHARACTER_LIST,
  CHARACTER_ROW,
  CHARACTER_ROW_LINK,
} from './constants'
import { RemoveCharacterButton } from './remove-character-button'
import { Avatar } from '@/components/avatar/avatar'
import { gameHost } from '@/utils/game-host'
import type { CharacterListProps } from './types'

export function CharacterList({
  characters,
  onRemove,
}: Readonly<CharacterListProps>) {
  return (
    <ul className={CHARACTER_LIST}>
      {characters.map(character => (
        <li
          key={character.id}
          className={clsx(
            CHARACTER_ROW,
            'group pr-2 transition-colors hover:border-primary/50',
          )}
        >
          <Link
            href={`/characters/${character.id}`}
            className={clsx(CHARACTER_ROW_LINK, 'rounded-l-2xl')}
          >
            <Avatar
              name={character.name}
              className={clsx(CHARACTER_AVATAR, 'text-lg')}
            />
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
