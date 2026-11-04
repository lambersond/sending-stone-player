import { seatWords } from '@/utils/seat-words'
import type { SeatRole } from '@/types/seats'

/** Words listed as a sentence has them: "a, b and c". */
export function listed(words: readonly string[], last = 'and'): string {
  return words.length > 1
    ? `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`
    : words.join('')
}

/**
 * What the game said of a roll, in words: why it wasn't made, mostly; as the seat at the sheet
 * reads it, its player or the Gamemaster (#156).
 */
function reasonsOf(role: SeatRole): Record<string, string> {
  const { game, notViewing, targets, applies } = seatWords(role)
  return {
    unavailable: `${game} isn’t taking rolls now`,
    off: `${game} isn’t taking rolls now`,
    unknown: 'your character in the game can’t make it',
    'not-dying': 'you aren’t dying',
    'not-in-combat': 'you aren’t in the combat',
    'already-rolled': 'you have rolled initiative already',
    busy: 'too many rolls at once. Wait a moment',
    cancelled: 'it was called off in the game',
    timeout: 'the game took too long',
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
    lost: `no answer from ${game}`,
    'attacks-off': `${game} isn’t taking attacks`,
    'midi-off': `${game} isn’t taking attacks`,
    'self-test': `${game} can’t make it with your dice`,
    item: 'your character in the game hasn’t that item',
    activity: 'it can’t be used from Sending Stone',
    area: `${game} can’t make that area attack from here`,
    ammo: 'you have none of that ammunition left',
    mode: 'the weapon can’t attack that way',
    target: 'a target can’t be picked, or there are too many',
    scene: `${notViewing} that target’s level or scene`,
    consume: 'there’s nothing left to use it with',
    slots: 'you have no spell slots left for it',
    slot: 'that spell slot can’t cast it',
    'damage-type': 'its kind of damage is chosen in the game',
    type: 'it can’t deal that kind of damage',
    'active-defence': `${targets} defend themselves`,
    reaction: 'you’ve used your reaction',
    'bonus-action': 'you’ve used your bonus action',
    'midi-dialog': `${game} asks how to roll it`,
    midi: `${game} stopped it`,
    'no-attack': 'the attack wasn’t made',
    gone: 'it can’t be found in the game any more',
    link: `${game} doesn’t find that in its description`,
    secret: 'it’s in a secret part of the description',
    'not-waiting': 'its damage was rolled in the game',
    'no-damage': 'no damage follows it',
    damaged: 'its damage is rolled already',
    dice: 'the dice weren’t those the game said',
    invalid: `${game} couldn’t make it`,
    prompt: `${game} isn’t asking for it any more`,
    'no-hit-dice': 'you have no hit dice of that size left',
    'full-hp': 'you’re at full hit points',
    profile: 'that enchantment isn’t offered at that level',
    'enchant-target': 'that item can’t take that enchantment',
    applied: 'that enchantment is on it already',
    enchant: `it was used, but the enchantment wasn’t applied: ${applies}`,
    enchantment: 'that enchantment can’t be ended from here',
    concentration: 'that concentration has already ended',
    uses: 'that can’t be spent from Sending Stone',
    short: 'you haven’t that many left',
    'not-inspired': 'you have no Heroic Inspiration to use',
    inspired: 'you have Heroic Inspiration already',
    // A creature's legendary action its pool can't pay, a recharge with nothing spent, and a
    // critical hit asked of damage on its own that has none, from module 0.36.0.
    legendary: 'it has too few legendary actions left',
    charged: 'it’s charged already',
    critical: 'that damage can’t be a critical hit’s',
    // A favorite, an effect or a removal while the character is transformed, from module 0.40.0.
    shaped: 'that waits until your character is back in their own form',
  }
}

/** Why a roll wasn't made, in words, for each seat. */
const REASONS_BY_ROLE: Record<SeatRole, Record<string, string>> = {
  player: reasonsOf('player'),
  gm: reasonsOf('gm'),
}

/** What the game said of a roll, in words, as a seat reads it. */
export function reasons(role: SeatRole): Record<string, string> {
  return REASONS_BY_ROLE[role]
}

/** As the character's player reads them. */
export const REASONS = REASONS_BY_ROLE.player
