import { ROLL_KIND_INFO } from '@/constants/roll-kinds'
import { changes } from '@/utils/damage-modifiers'
import { availableRollKinds } from '@/utils/requests/availability'
import { GM_UNSENT } from '@/utils/requests/commands'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet, CombatSnapshot } from '@/types/sending-stone'
import type {
  RollCampaign,
  RollRefusal,
  RollRejection,
} from '@/utils/requests/types'

// A roll's refusals that need nothing but the roll, its seat and its campaign, and the rules a
// companion's roll is held to before it's checked as any roll is (src/db/roll-requests.ts).

/**
 * Whether the game takes this roll now, before anything else is read: the Gamemaster's only where
 * it makes them as the character's, its kind where the game takes it, a companion's only of the
 * kinds the game takes for companions, and whatever it asks of the game only where the game does
 * that.
 * @returns Why not; nothing where it does.
 */
export function rollGate(
  seat: SheetSeat,
  input: RollRequestInput,
  campaign: RollCampaign | null,
): RollRejection | undefined {
  const { companion } = seat
  // The Gamemaster's rolls go only to a game that makes them as the character's, marked as theirs;
  // and ending an enchantment, a concentration or from module 0.36.0 a turn, or taking one back, is
  // no roll, and posts nothing, so it would leave no mark: the Gamemaster ends one in Foundry.
  // Charges spent and Heroic Inspiration post a line marked as theirs, so they're the Gamemaster's
  // to send too.
  if (
    seat.role === 'gm' &&
    (!campaign?.rollFeatures.includes('gmRolls') || GM_UNSENT.has(input.kind))
  ) {
    return { status: 409, reason: 'unavailable' }
  }
  if (!campaign || !availableRollKinds(campaign).includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // A companion's rolls are only those the game takes for companions, as its view offers them.
  if (companion && !campaign.companionKinds.includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // The game asks a companion its saves only from module 0.41.0, and only an important NPC makes
  // death saving throws.
  if (
    companion &&
    input.prompt &&
    !campaign.rollFeatures.includes('companionPrompts')
  ) {
    return { status: 422, reason: 'prompt' }
  }
  if (lacksFeature(input, campaign.rollFeatures)) {
    return { status: 409, reason: 'unavailable' }
  }
  return undefined
}

/**
 * Whether a roll asks the game for what it doesn't do: damage a player changed goes only to a game
 * that can roll it so, an answer to what the game asked only to one that asks, an area attack only
 * to one that makes it at those picked, a check an activity asks for only to one that makes it
 * against the activity, and from module 0.41.0 damage on its own with its choices, or spending
 * what it uses, only to one that takes them.
 */
function lacksFeature(input: RollRequestInput, features: string[]): boolean {
  return (
    (changes(input.modifiers) && !features.includes('modifiers')) ||
    (input.kind === 'itemDamage' &&
      namesAloneChoices(input) &&
      !features.includes('aloneChoices')) ||
    (!!input.prompt && !features.includes('prompts')) ||
    (input.kind === 'attack' &&
      input.targets !== undefined &&
      !features.includes('areaAttacks')) ||
    ('check' in ROLL_KIND_INFO[input.kind] &&
      input.item !== undefined &&
      !features.includes('activityChecks'))
  )
}

/**
 * Does damage on its own name any of its choices, from module 0.41.0: the slot it's rolled at, the
 * attack mode, the ammunition, or spending what its use would?
 */
function namesAloneChoices(input: RollRequestInput): boolean {
  return (
    input.slot !== undefined ||
    input.attackMode !== undefined ||
    input.ammunition !== undefined ||
    input.consume !== undefined
  )
}

/**
 * The combat a roll is made in: initiative's, or the one an attack's or a use's targets are in; or
 * from module 0.36.0, the one whose turn is ended, or taken back.
 */
export function combatOf(input: RollRequestInput): string | undefined {
  if (input.kind === 'initiative') return input.combatId
  if (input.kind === 'endTurn' || input.kind === 'undoEndTurn') {
    return input.turn?.combatId
  }
  return input.target?.combatId ?? input.targets?.[0]?.combatId
}

/**
 * Why a companion can't make this roll, from module 0.36.0, before it's checked as any roll is: a
 * death saving throw of a creature that makes none, as only an important NPC does; or its
 * initiative where its campaign has companions act right after their character and one of its
 * characters is a combatant of that combat, whose initiative the game sets for it. Nothing for a
 * character's own roll.
 */
export function companionRefusal(
  input: RollRequestInput,
  companion: SheetSeat['companion'],
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  campaign: { companionInitiative: string },
): RollRefusal | undefined {
  if (!companion) return undefined
  if (input.kind === 'death' && sheet?.creature?.important !== true) {
    return 'not-dying'
  }
  if (input.kind === 'initiative' && campaign.companionInitiative === 'after') {
    const combat = combats.find(({ id }) => id === input.combatId)
    const follows = combat?.combatants.some(
      ({ character }) => !!character && companion.entry.of.includes(character),
    )
    if (follows) return 'follows'
  }
  return undefined
}
