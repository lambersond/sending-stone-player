'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { createCharacter, deleteCharacter } from '@/db/characters'
import { requireUser } from '@/lib/session'
import { characterSchema } from '@/schemas/character'
import type { CharacterFormState } from '@/types/character'

export async function addCharacter(
  _state: CharacterFormState,
  formData: FormData,
): Promise<CharacterFormState> {
  const user = await requireUser()
  const values = {
    name: String(formData.get('name') ?? ''),
    gameUrl: String(formData.get('gameUrl') ?? ''),
  }

  const parsed = characterSchema.safeParse(values)
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors }
  }

  try {
    await createCharacter(user.id, parsed.data)
  } catch (error) {
    console.error('Failed to save a character', error)
    return { values, message: 'Your character could not be saved. Try again.' }
  }

  refresh()
  return {}
}

export async function removeCharacter(characterId: string): Promise<void> {
  const user = await requireUser()
  await deleteCharacter(user.id, characterId)
  refresh()
}
