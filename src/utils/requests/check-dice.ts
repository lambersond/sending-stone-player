import { answerFits } from '@/utils/dice-asks'
import { rollStatus } from '@/utils/requests/status'
import type { SheetSeat } from '@/types/character'
import type { DiceAskData, HeldDiceAsk } from '@/types/dice-asks'
import type { RollRequestInput } from '@/types/roll'
import type { HeldRollRequest, RollRefusal } from '@/utils/requests/types'

/**
 * Can these dice answer what the game asked, from module 0.44.0: is it asked of this seat, its
 * player's while they type in their dice, of its character, or at a companion's seat of that
 * companion in its own character's run; still waiting; and is no other answer to it on its way or
 * made, as from another of the player's devices (`diceAsk`)? And do the values fit it: each term
 * one it lists, once, with a value for each of its dice, each one of its faces (`dice`)?
 * @param ask - The ask, if held.
 * @param answers - The other answers to it.
 */
export function checkDiceAnswer(
  input: RollRequestInput,
  ask: Omit<HeldDiceAsk, 'askId' | 'commandId' | 'askedAt'> | null | undefined,
  seat: Pick<SheetSeat, 'role' | 'manualDice' | 'actorId' | 'companion'>,
  answers: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
  now = Date.now(),
): RollRefusal | undefined {
  if (seat.role !== 'player' || seat.manualDice !== true) return 'diceAsk'
  if (!ask || ask.actorId !== seat.actorId) return 'diceAsk'
  if ((ask.ofActorId ?? undefined) !== seat.companion?.of) return 'diceAsk'
  if (ask.closedAt || ask.expiresAt.getTime() <= now) return 'diceAsk'
  const answering = answers.some(answer =>
    ['sending', 'rolling', 'done'].includes(rollStatus(answer, now)),
  )
  if (answering) return 'diceAsk'
  return answerFits(ask.data as DiceAskData, input.answer ?? [])
    ? undefined
    : 'dice'
}
