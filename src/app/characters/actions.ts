'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import {
  createCharacter,
  deleteCharacter,
  setCampaignTitle,
} from '@/db/characters'
import { requireUser } from '@/lib/session'
import { campaignTitleSchema, characterSchema } from '@/schemas/character'
import type {
  CampaignTitleFormState,
  CharacterFormState,
} from '@/types/character'

export async function addCharacter(
  _state: CharacterFormState,
  formData: FormData,
): Promise<CharacterFormState> {
  const user = await requireUser()
  const values = {
    name: String(formData.get('name') ?? ''),
    campaignTitle: String(formData.get('campaignTitle') ?? ''),
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

/** Give a character made before campaigns the title of its campaign. */
export async function updateCampaignTitle(
  characterId: string,
  _state: CampaignTitleFormState,
  formData: FormData,
): Promise<CampaignTitleFormState> {
  const user = await requireUser()
  const value = String(formData.get('campaignTitle') ?? '')
  const parsed = campaignTitleSchema.safeParse(value)
  if (!parsed.success) {
    return { value, error: parsed.error.issues[0].message }
  }
  await setCampaignTitle(user.id, characterId, parsed.data)
  refresh()
  return {}
}

export async function removeCharacter(characterId: string): Promise<void> {
  const user = await requireUser()
  await deleteCharacter(user.id, characterId)
  refresh()
}
