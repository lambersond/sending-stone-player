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

export const EVENTS = {
  HELLO: 'bridge.hello',
  PING: 'bridge.ping',
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
} as const
