/**
 * The Sending Stone protocol, as described in the fvtt-sending-stone module's PROTOCOL.md.
 */

/** The protocol version this listener understands. Version 2 sends each event to campaigns. */
export const PROTOCOL_VERSION = 2

/** The largest envelope accepted, in bytes. A bridge.hello with every combat is well under. */
export const MAX_ENVELOPE_BYTES = 1_000_000

/**
 * Where the module posts events. The Gamemaster sets only this app's address as the module's
 * destination; the module adds this path.
 */
export const EVENTS_PATH = '/api/events'

/**
 * How long a campaign can go without hearing anything, an event or a heartbeat, before its
 * Gamemaster's game counts as offline. The module sends something at least every 30 to 40
 * seconds, but a background tab's timers may run only once a minute.
 */
export const BRIDGE_TIMEOUT = 120_000

export const EVENTS = {
  HELLO: 'bridge.hello',
  PING: 'bridge.ping',
  HEARTBEAT: 'bridge.heartbeat',
  CHARACTER_UPDATED: 'character.updated',
  CHARACTER_TEXTS: 'character.texts',
  CHAT_CREATED: 'chat.message.created',
  CHAT_UPDATED: 'chat.message.updated',
  CHAT_DELETED: 'chat.message.deleted',
  CHAT_CLEARED: 'chat.cleared',
  COMBAT_CREATED: 'combat.created',
  COMBAT_STARTED: 'combat.started',
  COMBAT_TURN: 'combat.turn',
  COMBAT_UPDATED: 'combat.updated',
  COMBAT_ENDED: 'combat.ended',
  COMBATANT_ADDED: 'combat.combatant.added',
  COMBATANT_UPDATED: 'combat.combatant.updated',
  COMBATANT_REMOVED: 'combat.combatant.removed',
  COMMAND_RESULT: 'command.result',
} as const

/**
 * Where the Gamemaster's module fetches what players ask their game to do, such as rolls. It asks
 * only once this app has said, in its answer to a hello or heartbeat, that it has commands.
 */
export const COMMANDS_PATH = '/api/bridge/commands'

/**
 * The rolls a player can have made in the Gamemaster's game: a skill check, a tool check, an
 * ability check, a saving throw, a death saving throw, or initiative.
 */
export const ROLL_KINDS = [
  'skill',
  'tool',
  'ability',
  'save',
  'death',
  'initiative',
] as const

/**
 * How the module's fetch of players' rolls is answered, in milliseconds. While a player has their
 * table open, the fetch is held open for a roll, and checked this often; otherwise it is answered
 * at once, with when to ask again.
 */
export const COMMANDS_HOLD = 20_000
export const COMMANDS_CHECK_EVERY = 1000
export const COMMANDS_COLD_WAIT = 10_000
/** When rolls are turned off for the campaign, how long before the module asks again. */
export const COMMANDS_OFF_WAIT = 60_000

/** How recently a player must have had their table open for a roll to be awaited. */
export const PLAYERS_PRESENT_FOR = 120_000

/** How often a player's table marks them present, at most. */
export const PLAYERS_SEEN_EVERY = 30_000

/** How recently the module must have fetched players' rolls for one to reach the game. */
export const BRIDGE_POLLED_WITHIN = 45_000

/** How long a roll may wait for the module to fetch it before it no longer goes to the game. */
export const ROLL_PENDING_FOR = 30_000

/**
 * How long a fetched roll may go unanswered before it counts as lost: longer than the module takes
 * to give up on one, a minute, as when a module stops it to ask the Gamemaster something.
 */
export const ROLL_ANSWER_WITHIN = 75_000

/** How long a character's rolls are kept, once made. */
export const ROLLS_KEPT_FOR = 86_400_000

/** How many of a character's rolls may be on their way to the game at once, and in a minute. */
export const ROLLS_IN_FLIGHT = 3
export const ROLLS_PER_MINUTE = 20
