'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import {
  changeCampaignSecret,
  removeCampaign,
  removePlayer,
  resetInviteCode,
  setUpCampaign,
} from '@/db/campaigns'
import { requireUser } from '@/lib/session'
import { campaignSetupSchema, secretSchema } from '@/schemas/campaign'
import type { CampaignSetupFormState, SecretFormState } from '@/types/campaign'

const PAGE = '/campaigns'

export async function setUpCampaignAction(
  _state: CampaignSetupFormState,
  formData: FormData,
): Promise<CampaignSetupFormState> {
  const user = await requireUser(PAGE)
  const values = {
    title: String(formData.get('title') ?? ''),
    gameUrl: String(formData.get('gameUrl') ?? ''),
    secret: String(formData.get('secret') ?? ''),
  }

  const parsed = campaignSetupSchema.safeParse(values)
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors }
  }

  let created
  try {
    created = await setUpCampaign(user.id, parsed.data)
  } catch (error) {
    console.error('Failed to set up a campaign', error)
    return { values, message: 'The campaign could not be saved. Try again.' }
  }
  if (created === 'duplicate') {
    return {
      values,
      errors: {
        title: [
          'You have already set up a campaign with this title for this game.',
        ],
      },
    }
  }

  refresh()
  // The secret is only kept as a hash, so this is the last chance to copy it.
  return { saved: { title: parsed.data.title, secret: parsed.data.secret } }
}

export async function changeSecretAction(
  campaignId: string,
  _state: SecretFormState,
  formData: FormData,
): Promise<SecretFormState> {
  const user = await requireUser(PAGE)
  const parsed = secretSchema.safeParse(formData.get('secret') ?? '')
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  await changeCampaignSecret(user.id, campaignId, parsed.data)
  return { saved: true }
}

export async function resetInviteAction(campaignId: string): Promise<void> {
  const user = await requireUser(PAGE)
  await resetInviteCode(user.id, campaignId)
  refresh()
}

/** Remove a player's character from the campaign, so that another player can choose it. */
export async function removePlayerAction(
  campaignId: string,
  characterId: string,
): Promise<void> {
  const user = await requireUser(PAGE)
  await removePlayer(user.id, campaignId, characterId)
  refresh()
}

export async function removeCampaignAction(campaignId: string): Promise<void> {
  const user = await requireUser(PAGE)
  await removeCampaign(user.id, campaignId)
  refresh()
}
