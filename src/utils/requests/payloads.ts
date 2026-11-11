import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { ConnectedCharacter } from '@/types/sending-stone'
import type { DiceAnswerCommand, RollCampaign } from '@/utils/requests/types'

// What the module is sent of a roll, or of a command that rides to the game as one, and what the
// app keeps beside it (src/db/roll-requests.ts, src/db/commands.ts).

/**
 * What the module is sent of a roll: only what to roll, as its label is the app's alone. Marked as
 * typed in only where the player may type theirs, as the game said last: else the same dice,
 * unmarked. A companion's are typed as its character's are. And with it, the dice its effects add,
 * and that its rerolls are its player's, where the game takes them (module 0.42.0); else the game
 * rolls those. Dice the game asked for (module 0.44.0) are sent as their own command.
 */
export function rollPayload(
  seat: SheetSeat,
  input: RollRequestInput,
  campaign: Pick<RollCampaign, 'characters' | 'rollFeatures'>,
) {
  if (input.kind === 'dice') return answerPayload(input)
  const { typed, effectDice, rerolls } = input
  const command = { ...input }
  delete command.label
  delete command.typed
  delete command.effectDice
  delete command.rerolls
  const roster = campaign.characters as unknown as ConnectedCharacter[]
  const typer = seat.companion?.of ?? seat.actorId
  const typedHere =
    typed === true &&
    seat.role === 'player' &&
    command.dice.length > 0 &&
    campaign.rollFeatures.includes('manualDice') &&
    roster.some(({ id, manualDice }) => id === typer && manualDice === true)
  return typedHere
    ? {
        ...command,
        typed: true as const,
        ...(effectDice &&
          effectDice.length > 0 &&
          campaign.rollFeatures.includes('effectDice') && { effectDice }),
        ...(rerolls === 'kept' &&
          campaign.rollFeatures.includes('keptRerolls') && { rerolls }),
      }
    : command
}

/**
 * What the module is sent of dice the game asked for (module 0.44.0): the ask, and the values typed
 * for each of its terms, as its `dice`, by roll and term; typed, as only a typing player's page
 * sends them, and thrown no other way.
 */
function answerPayload(input: RollRequestInput): DiceAnswerCommand {
  return {
    kind: 'dice',
    diceAsk: input.diceAsk ?? '',
    dice: input.answer ?? [],
    mode: 0,
    explicit: false,
    extras: [],
    typed: true,
  }
}

/**
 * What the module is sent of a command: what it's called is the app's alone, as for a roll; and
 * nothing is typed in for one, so nothing says so, nor that its rerolls were kept (module 0.42.0).
 */
export function commandPayload(input: RollRequestInput): RollRequestInput {
  const command = { ...input }
  delete command.label
  delete command.typed
  delete command.rerolls
  return command
}

/**
 * What the Gamemaster's page called what it sent, kept for the character's player to be shown it
 * by; a player's own page never asks for theirs.
 */
export function keptLabel(
  seat: Pick<SheetSeat, 'role'>,
  label: string | undefined,
): { label?: string } {
  return seat.role === 'gm' && label !== undefined ? { label } : {}
}
