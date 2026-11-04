import type { GamePrompt } from '@/types/sending-stone'

/** What a save the game asks for asks, as held. */
export type PromptData = Pick<
  GamePrompt,
  | 'type'
  | 'abilities'
  | 'skills'
  | 'dc'
  | 'label'
  | 'messageId'
  | 'source'
  | 'advantage'
  | 'askedInFoundry'
>

/** A save the game asks for, as held for its player to answer. */
export type HeldPrompt = {
  promptId: string
  actorId: string
  data: unknown
  expiresAt: Date
  closedAt: Date | null
  /** Why it closed, such as "answered" or "gone". */
  closedReason?: string | null
}
