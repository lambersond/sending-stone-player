import type { GameDiceAsk } from '@/types/sending-stone'

/** What a dice ask asks, as held (module 0.45.0): its words and its rolls' dice. */
export type DiceAskData = Pick<
  GameDiceAsk,
  'label' | 'purpose' | 'again' | 'critical' | 'rolls'
>

/**
 * A dice ask as held for its player to answer (module 0.45.0): its times by this app's clock, and
 * once closed, when and why.
 */
export type HeldDiceAsk = {
  askId: string
  actorId: string
  ofActorId: string | null
  commandId: string
  data: unknown
  askedAt: Date
  expiresAt: Date
  closedAt: Date | null
  closedReason: string | null
}
