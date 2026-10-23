/**
 * The Sending Stone protocol, as described in the fvtt-sending-stone module's PROTOCOL.md.
 */

/** The protocol version this listener understands. Version 2 sends each event to campaigns. */
export const PROTOCOL_VERSION = 2

/**
 * The largest envelope accepted, in bytes, as this app tells the module (`maxBytes`). A hello
 * carried every character's whole sheet only from modules before 0.22.0, which for a party of nine
 * with large spellbooks came to 1.1 MB; since then each sheet comes in a post of its own, which the
 * module checks against this before sending. A slim sheet is expanded within bounds of it. It stays
 * under the 4.5 MB a Vercel function accepts.
 */
export const MAX_ENVELOPE_BYTES = 4_000_000

/**
 * The highest format of slim sheet this app expands, as it tells the module (`slimSheets`): from
 * module 0.22.0, actions by reference to their rows, and defaults left out.
 */
export const SLIM_SHEETS = 1

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

/**
 * Why a post or fetch from the module is refused, as every refusal's JSON body says in `reason`,
 * beside its status: module 0.23.0 tells the Gamemaster in its own words what went wrong and what
 * to do, and an older module goes by the status alone.
 */
export const REFUSAL = {
  NO_SECRET: 'noSecret',
  WRONG_SECRET: 'wrongSecret',
  NOT_FORGE: 'notForge',
  NOT_SET_UP: 'notSetUp',
  TOO_LARGE: 'tooLarge',
  BAD_ENVELOPE: 'badEnvelope',
  UNSUPPORTED_PROTOCOL: 'unsupportedProtocol',
  MALFORMED: 'malformed',
  UNAVAILABLE: 'unavailable',
} as const

export type RefusalReason = (typeof REFUSAL)[keyof typeof REFUSAL]

/** How often a campaign's latest refusal is written, at most, unless its reason changes. */
export const REFUSAL_RECORD_EVERY = 60_000

/** How long a campaign's card shows its latest refusal. */
export const REFUSAL_SHOWN_FOR = 86_400_000

/**
 * How many of a game's campaigns waiting for Foundry a post whose title matches none is checked
 * against, newest first, to note on their cards: each check is a scrypt hash, which anyone who can
 * post from the game's address could otherwise have run once for every waiting campaign.
 */
export const WAITING_SECRET_CHECKS = 5

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
  PROMPT_OPENED: 'roll.prompt.opened',
  PROMPT_CLOSED: 'roll.prompt.closed',
  GROUP_UPDATED: 'group.updated',
  GROUP_REMOVED: 'group.removed',
  JOURNAL_UPDATED: 'journal.updated',
  BRIDGE_SETTINGS: 'bridge.settings',
  COMPANIONS_LISTED: 'companions.listed',
  COMPANION_UPDATED: 'companion.updated',
} as const

/**
 * Where the Gamemaster's module fetches what players ask their game to do, such as rolls. It asks
 * only once this app has said, in its answer to a hello or heartbeat, that it has commands.
 */
export const COMMANDS_PATH = '/api/bridge/commands'

/**
 * The rolls a player can have made in the Gamemaster's game: a skill check, a tool check, an
 * ability check, a saving throw, a death saving throw, or initiative; and, where the Gamemaster
 * lets them, an attack, or the use of a spell or feature, then its damage or healing; a hit die
 * spent, or a feature's own formula, such as a light's radius (module 0.16.0), or several hit dice
 * spent at once, of one size or more (module 0.20.0); and from a link in a description, the table
 * asked for the saving throw it calls for, its damage or healing, or a roll of its own (module
 * 0.17.0), or for the check it calls for (module 0.18.0); and an enchantment on one of the
 * character's items ended, such as Magic Weapon's, or a Flame Tongue's put out (module 0.21.0);
 * and from module 0.29.0, a concentration of the character's ended, a feature's, an item's or a
 * resource's charges spent directly, or Heroic Inspiration used or gained, none of them a roll;
 * and from module 0.31.0, items and coins moved between the character and a party or another
 * character, none of them a roll; and from module 0.33.0, an item removed from the character, no
 * roll either; and from module 0.36.0, an action's damage or healing on its own, and a spent
 * recharge rolled, and the current turn ended, the character's or one of its companions', no roll
 * either.
 */
export const ROLL_KINDS = [
  'skill',
  'tool',
  'ability',
  'save',
  'death',
  'initiative',
  'attack',
  'use',
  'damage',
  'hitDie',
  'hitDice',
  'formula',
  'ask',
  'textDamage',
  'textRoll',
  'itemDamage',
  'recharge',
  'endEnchantment',
  'endConcentration',
  'endTurn',
  'spend',
  'inspiration',
  'transfer',
  'remove',
] as const

/**
 * The most charges spent at once, from module 0.29.0: more than any counter has, so that the
 * counter's own count is what holds a spend back.
 */
export const MAX_SPEND = 999

/**
 * The most of one item's stack, or of one coin, moved at once, and the most items in one move,
 * from module 0.31.0: well above any pile a party keeps, so that what's held is what holds a move
 * back.
 */
export const MOST_MOVED = 10_000_000
export const MOST_MOVED_ITEMS = 10

/** The most characters one distribution shares a coin among, from module 0.32.0. */
export const MOST_AMONG = 20

/**
 * What else the Gamemaster's module can do with players' rolls, as its hello says: take damage a
 * player changed, with more dice, another die or every die at its highest, and from module 0.19.0
 * a description's damage changed so too, whose sheets then say how the world rolls a critical
 * hit's; and ask players for the saving throws their game asks of their characters, such as
 * concentration checks (module 0.13.0); and make an area attack, such as a breath weapon's, at the
 * combatants its player picks (module 0.16.0); and make a check an activity asks for, the player's
 * own, against it, as the activity's card does (module 0.21.0, under dnd5e 5); and change a
 * description's damage only on a die it adds (module 0.21.0); and make a use at its user, as its
 * request's `self` asks (module 0.22.0); and make the rolls a campaign's Gamemaster makes here as
 * one of its characters, marked as theirs (module 0.23.0), which only the Gamemaster's view reads;
 * and let players enter their own dice's results, as the Manual Dice module does (module 0.26.0),
 * each character's player where its roster entry says they may too (module 0.32.0).
 */
export const ROLL_FEATURES = [
  'modifiers',
  'prompts',
  'areaAttacks',
  'activityChecks',
  'signedDice',
  'selfTargets',
  'gmRolls',
  'manualDice',
] as const

/**
 * A saving throw the game asks for, as the module names it: its chat card's id and its
 * character's, joined by "-"; or for one Midi-QOL asks, from module 0.27.0, a key of the module's
 * own in place of the card's.
 */
export const PROMPT_ID = /^[A-Za-z0-9]{1,64}-[A-Za-z0-9]{1,64}$/

/**
 * The format of what Midi-QOL asks of a character that this app reads, as it tells the module
 * (`midiPrompts`): from module 0.27.0, its saves, ability and skill checks, concentration checks
 * and turn saves, which the module asks here while the character is open in the app.
 */
export const MIDI_PROMPTS = 1

/**
 * The format of a campaign's Group actors that this app reads, as it tells the module (`groups`):
 * from module 0.30.0, the hello's `groups`, and `group.updated` and `group.removed`, which the
 * module sends only then.
 */
export const GROUPS = 1

/**
 * The format of the Foundry settings this app reads, as it tells the module (`settings`): from
 * module 0.30.0, the hello's `settings`, and `bridge.settings` when one of them changes, which the
 * module sends only then. Only the Gamemaster's campaign card shows them.
 */
export const FOUNDRY_SETTINGS = 1

/**
 * The format of moves of items and coins this app takes, as it tells the module (`transfers`):
 * from module 0.31.0, the `transfer` command and the hello's `features.transfers`. The module
 * fetches moves alone, with rolls off, only then.
 */
export const TRANSFERS = 1

/**
 * What else the Gamemaster's module does with moves, as its hello says, from module 0.32.0: send a
 * party's items and coins elsewhere, by a player whose Foundry user owns it, to any of the
 * campaign's characters or another party they own, and party to party (`partySends`); and share a
 * party's coin of one kind among its members that are the campaign's characters (`distribute`).
 */
export const TRANSFER_FEATURES = ['partySends', 'distribute'] as const
export type TransferFeature = (typeof TRANSFER_FEATURES)[number]

/**
 * The format of removals of a character's items this app takes, as it tells the module
 * (`removals`): from module 0.33.0, the `remove` command and the hello's `features.removals`. The
 * module fetches for them with rolls and moves off, only then.
 */
export const REMOVALS = 1

/**
 * The format of journal notes this app takes, as it tells the module (`notes`): from module 0.34.0,
 * the `note` command, `journal.updated` and the hello's `features.notes`. The module fetches for
 * them, and sends journals, only then. From module 0.35.0, 2: it reads who changed a journal in
 * Foundry, `journal.changed`, and sends orders of a group's notes, `op: "order"`.
 */
export const NOTES = 2

/**
 * The format of companions this app takes, as it tells the module (`companions`): from module
 * 0.36.0, the hello's `companions`, `companions.listed` and `companion.updated`.
 */
export const COMPANIONS = 1

/**
 * A companion's key, as the module lists it, from module 0.36.0: its actor's id, or for a token's
 * creature `<sceneId>-<tokenId>`. Never a campaign character's actor id.
 */
export const COMPANION_KEY = /^[\dA-Za-z]{1,64}(?:-[\dA-Za-z]{1,64})?$/

/** The most companions a campaign's list holds, from module 0.36.0. */
export const MOST_COMPANIONS = 50

/**
 * The kinds a companion's roll is never, from module 0.36.0: what an NPC has none of, and what
 * edits it rather than acting, as charges spent by hand, and ending a turn, which the character's
 * page does for its companions' turns too. The module's list has `note` too, which isn't a roll
 * here.
 */
export const COMPANION_UNTAKEN = [
  'inspiration',
  'hitDie',
  'hitDice',
  'spend',
  'transfer',
  'remove',
  'endTurn',
] as const

/**
 * How a campaign's companions enter initiative, as the module's hello says (module 0.36.0): each
 * its own roll, or right after its character.
 */
export const COMPANION_INITIATIVE = ['own', 'after'] as const

/**
 * Where what the game asks of a character comes from, for one Midi-QOL asks (module 0.27.0): a
 * save or check in one of its workflows, a concentration check, or a save or check an effect
 * calls for at the start or end of a turn. What a chat card asks says none.
 */
export const PROMPT_SOURCES = ['midi', 'concentration', 'overtime'] as const

/**
 * The longest Midi-QOL waits for a player's answer, from when the module asks, in milliseconds:
 * then it rolls as the Gamemaster has it set up. A prompt that says it waits longer is held as
 * waiting this long, from when it came.
 */
export const MIDI_PROMPT_WAIT = 60_000

/**
 * How long a prompt Midi-QOL asks is still shown once its time is up, while the module says what
 * became of it, in milliseconds; and how long a notice of how it closed shows, where it was rolled
 * in Foundry or left to Midi-QOL.
 */
export const MIDI_PROMPT_GRACE = 15_000
export const PROMPT_NOTICE_FOR = 6000

/**
 * How long after an attack or a use is made its damage may be rolled at the table, in
 * milliseconds.
 */
export const DAMAGE_WITHIN = 600_000

/** The most dice terms an attack's or a use's damage may throw. */
export const MAX_DAMAGE_TERMS = 20

/** The most combatants a use, or an area attack, may be made at. */
export const MAX_USE_TARGETS = 20

/** A kind of damage or healing, as dnd5e keys it, such as "fire" or "temphp". */
export const DAMAGE_TYPE = /^[A-Za-z][\w-]{0,31}$/

/** A hit die's size, as dnd5e names it, such as "d10". */
export const HIT_DIE = /^d(4|6|8|10|12)$/

/**
 * The most hit dice spent at once, of every size together: a character's at level 20. One with more
 * left, as dnd5e's extra hit dice may give, spends the rest in another go.
 */
export const MOST_HIT_DICE = 20

/** A spell slot's pool, as dnd5e keys it, such as "spell3" or "pact". */
export const SPELL_SLOT = /^(spell[1-9]|pact)$/

/** A weapon's attack mode, as dnd5e keys it, such as "twoHanded" or "thrown-offhand". */
export const ATTACK_MODE = /^[A-Za-z][\w-]{0,31}$/

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

/**
 * How recently a player's page must have asked for their character's table for the character to
 * be open in the app, as the module is told with each fetch (module 0.27.0); how often each page
 * notes it, at most; and the most characters a campaign has open at once that it's told of.
 */
export const OPEN_WITHIN = 15_000
export const TABLE_SEEN_EVERY = 5000
export const MOST_OPEN = 200

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

/**
 * How many of the Gamemaster's latest rolls as a character its player's page is shown (#156), of
 * those kept, and the longest name the Gamemaster's page gives one, which is shown as text alone.
 */
export const GM_ROLLS_SHOWN = 10
export const MAX_ROLL_LABEL = 120

/** How many of a character's rolls may be on their way to the game at once, and in a minute. */
export const ROLLS_IN_FLIGHT = 3
export const ROLLS_PER_MINUTE = 20

/**
 * How many times a minute a character may ask the table for a saving throw or check a description
 * calls for, on top of those: each ask is a card in everyone's chat. Asks the game didn't make
 * don't count.
 */
export const ASKS_PER_MINUTE = 3
