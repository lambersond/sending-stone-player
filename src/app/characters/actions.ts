'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { JOIN_PATH } from '@/constants/campaign'
import {
  chooseCharacter,
  deleteCharacter,
  joinCampaign,
  markChatRead,
  type ChoiceProblem,
} from '@/db/characters'
import { requireUser } from '@/lib/session'
import { toInviteCode } from '@/schemas/campaign'
import type {
  ChooseCharacterFormState,
  InviteFormState,
} from '@/types/campaign'

const PROBLEMS: Record<ChoiceProblem, string> = {
  'invalid-invite':
    'This invite link no longer works. Ask your Gamemaster for a new one.',
  'unknown-character':
    'That character is no longer in the campaign. Choose another.',
  taken: 'Another player has just chosen that character. Choose another.',
}

/** Join the campaign an invite link is for, as the character chosen. */
export async function joinAsCharacter(
  inviteCode: string,
  _state: ChooseCharacterFormState,
  formData: FormData,
): Promise<ChooseCharacterFormState> {
  const user = await requireUser(`${JOIN_PATH}/${inviteCode}`)
  const actorId = String(formData.get('actorId') ?? '')
  if (!actorId) return { message: 'Choose a character.' }

  const joined = await joinCampaign(user.id, inviteCode, actorId)
  if (typeof joined === 'string') return { message: PROBLEMS[joined] }
  redirect(`/characters/${joined.id}`)
}

/** Choose which of its campaign's characters one of the player's characters is. */
export async function chooseActor(
  characterId: string,
  _state: ChooseCharacterFormState,
  formData: FormData,
): Promise<ChooseCharacterFormState> {
  const user = await requireUser()
  const actorId = String(formData.get('actorId') ?? '')
  if (!actorId) return { message: 'Choose a character.' }

  const chosen = await chooseCharacter(user.id, characterId, actorId)
  if (chosen === 'missing') {
    return { message: 'This character is no longer in a campaign.' }
  }
  if (chosen !== true) return { message: PROBLEMS[chosen] }
  refresh()
  return {}
}

/** Follow an invite link the player pasted. */
export async function openInvite(
  _state: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  await requireUser()
  const value = String(formData.get('invite') ?? '')
  const inviteCode = toInviteCode(value)
  if (!inviteCode) {
    return { value, error: 'Paste the invite link your Gamemaster shared.' }
  }
  redirect(`${JOIN_PATH}/${inviteCode}`)
}

/** Delete one of the player's characters from its own page, and go back to their characters. */
export async function deleteCharacterAndLeave(
  characterId: string,
): Promise<void> {
  const user = await requireUser()
  await deleteCharacter(user.id, characterId)
  redirect('/characters')
}

export async function removeCharacter(characterId: string): Promise<void> {
  const user = await requireUser()
  await deleteCharacter(user.id, characterId)
  refresh()
}

/**
 * Note how far the player has read their character's chat: up to the message sent at `readAt`,
 * an ISO timestamp. A time to come is taken as now, so later messages still count as unread.
 */
export async function markChatReadUpTo(
  characterId: string,
  readAt: string,
): Promise<void> {
  const user = await requireUser()
  const at = Date.parse(readAt)
  if (Number.isNaN(at)) return
  await markChatRead(user.id, characterId, new Date(Math.min(at, Date.now())))
}
