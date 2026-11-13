import { removeCharacter } from './actions'
import { listCharacters } from '@/db/characters'
import { CharacterList } from '@/features/characters/components/character-list/character-list'

/**
 * The player's characters to choose from, or that they have none yet (v0.48.0: read once the page
 * has its user, their outline shimmering until then).
 */
export async function CharacterChoices({
  userId,
}: Readonly<{ userId: string }>) {
  const characters = await listCharacters(userId)

  return characters.length > 0 ? (
    <CharacterList characters={characters} onRemove={removeCharacter} />
  ) : (
    <p className='rounded-2xl border border-dashed border-border p-6 text-center text-text-secondary'>
      You have no characters yet. Join a campaign below to choose one.
    </p>
  )
}
