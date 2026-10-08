import {
  rollStatus,
  type HeldRollRequest,
  type RollRefusal,
} from '@/utils/roll-requests'
import type { RollRequestInput } from '@/types/roll'
import type { GamePrompt } from '@/types/sending-stone'
import type { TablePrompt } from '@/types/table'

/*
 * Saving throws the Gamemaster's game asks of a player's character, such as a concentration check
 * after damage: held as the module described them, until it says they closed, or their time runs
 * out; shown to the character's player to roll here; and checked when they answer one.
 */

/** What a save the game asks for asks, as held. */
export type PromptData = Pick<
  GamePrompt,
  'type' | 'abilities' | 'dc' | 'label' | 'messageId'
>

/** A save the game asks for, as held for its player to answer. */
export type HeldPrompt = {
  promptId: string
  actorId: string
  data: unknown
  expiresAt: Date
  closedAt: Date | null
}

/** A save the game asks for, as its player is shown it. */
export function toTablePrompt(
  prompt: Pick<HeldPrompt, 'promptId' | 'data' | 'expiresAt'>,
): TablePrompt {
  const { type, abilities, dc, label } = prompt.data as PromptData
  return {
    id: prompt.promptId,
    type,
    abilities,
    ...(dc !== null && { dc }),
    ...(label && { label }),
    expiresAt: prompt.expiresAt.toISOString(),
  }
}

/** The saves still waiting for their player now: those whose time hasn't run out. */
export function waitingPrompts(
  prompts: readonly TablePrompt[] = [],
  now = Date.now(),
): TablePrompt[] {
  return prompts.filter(({ expiresAt }) => Date.parse(expiresAt) > now)
}

/**
 * Can this saving throw answer what the game asked: is it asked of this character, still open,
 * rolled with one of the abilities it may be, and is no other answer to it on its way or made?
 * @param prompt - The save the game asked for, if held.
 * @param answers - The character's other answers to it.
 * @returns Why not, or nothing when it can.
 */
export function checkPrompt(
  input: RollRequestInput,
  prompt: Omit<HeldPrompt, 'promptId'> | null | undefined,
  actorId: string,
  answers: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
  now = Date.now(),
): RollRefusal | undefined {
  if (!prompt || prompt.actorId !== actorId || prompt.closedAt) return 'prompt'
  if (prompt.expiresAt.getTime() <= now) return 'prompt'
  const { abilities } = prompt.data as PromptData
  if (!input.key || !abilities.includes(input.key)) return 'prompt'
  const answering = answers.some(answer =>
    ['sending', 'rolling', 'done'].includes(rollStatus(answer, now)),
  )
  return answering ? 'prompt' : undefined
}
