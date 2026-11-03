import type { Character } from '@/types/character'

export type CharacterListProps = {
  characters: Character[]
  onRemove: (characterId: string) => Promise<void>
}

export type RemoveCharacterButtonProps = {
  characterId: string
  name: string
  onRemove: (characterId: string) => Promise<void>
}
