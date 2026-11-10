import type { DiceAnswerTerm, RollRequestInput } from '@/types/roll'

/**
 * Why a roll can't go to the Gamemaster's game: the game can't take it now, the sheet has no such
 * skill, ability, tool, attack, spell or feature, nor check of the character's own an activity asks
 * for, the character isn't dying, isn't in the combat, or has rolled initiative already. For an
 * attack or a use: the spell it's cast with has no spell
 * slots left, or none of the slot chosen; a spell an item casts isn't offered at the level chosen
 * (`slot`); the attack mode or ammunition chosen isn't the weapon's, or none of it is left; or a
 * target can't be picked, or there are more than it takes. For damage:
 * its attack or use can't be found, or is too old; no damage follows it; its damage is rolled
 * already; the dice aren't those it said; or a kind of damage chosen isn't one it offers. For a
 * saving throw the game asked for: it no longer waits, isn't this character's, isn't rolled with an
 * ability it may be, or is answered already. For a hit die: the character has none of its size
 * left; for hit dice spent at once, fewer of a size than are spent. For a formula: its dice aren't
 * those the formula throws. From a link in a description: the description is no longer on the
 * sheet, or not held here (`gone`); it has no such link, or not of the kind asked for, or a saving
 * throw it calls for isn't rolled with that ability, or a check with that skill, tool or ability,
 * or healing, or damage the game marks as never a critical hit's, without what one adds, is asked
 * for as one (`link`); the table is asked for one in a secret (`secret`); its dice aren't those
 * its formulas throw, changed as the player chose, or as a critical hit's where the sheet doesn't
 * say how the world makes one, or where it isn't offered, as where it adds dice the world's rules
 * don't say how they throw; a kind of damage chosen isn't one it offers; or damage is changed where
 * the game, before module 0.19.0, doesn't take it so (`unavailable`). For a use of an enchant
 * activity, from module 0.21.0: the way it enchants isn't one it offers, or not at the level it's
 * cast at, or none was chosen (`profile`); or the item it enchants isn't one it may, as for one
 * that enchants its own (`enchant-target`); or one that enchants its own item is used in the way
 * it's on it in already, which dnd5e would take as ending it, at a cost (`applied`). For an
 * enchantment ended: it isn't one the player may end, on that item of the character's
 * (`enchantment`). From module 0.29.0: a concentration ended isn't one the character keeps
 * (`concentration`); charges spent aren't of a counter the sheet lets the player spend directly
 * (`uses`), or there aren't as many left (`short`); and Heroic Inspiration is used without it
 * (`not-inspired`), or gained with it already (`inspired`). From module 0.31.0, for a move of items
 * and coins: an end isn't one of the campaign's characters or parties, or a party the player's
 * character can't see (`unknown`); the character isn't the end the move must be made by, or both
 * ends are parties (`not-yours`); the player's character may only see the party, not change it
 * (`not-owner`); an item isn't held there any more, or a coin isn't on the sheet (`gone`); there
 * isn't as much of it there (`short`); part of a container that holds anything is asked for, as a
 * container moves whole (`container`); or an item is asked for with the container it's in
 * (`nested`). From module 0.32.0, for a distribution of a party's coin: those it's shared among
 * aren't the party's members that are the campaign's characters (`members`), or there isn't a
 * whole coin for each of them (`split`). From module 0.33.0, for an item removed: the stack holds
 * as many as asked, but not as many as the page showed, as after a potion was drunk (`changed`).
 * From module 0.36.0: an action's damage on its own asked for as a critical hit's where the game
 * would make none (`critical`); a recharge of uses that aren't spent (`charged`); and a companion's
 * initiative where it acts right after its character, who's in that combat (`follows`). From module
 * 0.36.0, for a turn ended: the combat hasn't started (`not-started`); its round or current
 * combatant isn't the one the page showed, or that one is hidden (`moved`); or it's neither the
 * character's turn nor one of its companions' (`not-turn`); and for a turn taken back, that the End
 * Turn named can't be (`not-undoable`): not this seat's, not ended, too long ago, or its turn's
 * combatant gone. From module 0.39.0, for one of the character's own effects turned off, on or
 * deleted: it's there, but not its player's to change that way now (`effect`), as the sheet's `ops`
 * say, or the game. From module 0.40.0, for Wild Shape, as the sheet last said: a change into a
 * form that isn't one of the known forms usable from here, or the one the character is in, or a
 * Beast learned in place of one that isn't a known form (`form`); a change or return from another
 * kind of transformation, which ends in Foundry (`transformed`); a change while Incapacitated, at 0
 * hit points or dead (`incapacitated`); a change with no use left (`consume`); a return while not
 * shaped (`not-shaped`); a Beast learned with every place taken (`full`), in place of the form the
 * character is in (`shaped`), or in place of another before a Long Rest (`swap`). And from module
 * 0.40.0, a favorite, an effect, a move or a removal while its character, or a character at either
 * end of a move, is transformed (`shaped`). From module 0.41.0, for damage on its own: a slot, an
 * attack mode, an ammunition or a spend named for a row the game sends no choices for, or to a game
 * that takes none (`slot`, `mode`, `ammo`, `consume`); a slot that isn't one of the spell's pools,
 * or none where it has a pool to be cast with (`slot`), or none left of it where it's spent
 * (`slots`); an attack mode that isn't the weapon's (`mode`); an ammunition that isn't its, or none
 * left of it where it's spent (`ammo`); and a spend where using it spends nothing (`consume`).
 * From module 0.42.1, for a spell slot spent or restored: no such pool with slots (`slot`), its
 * count not the one shown (`changed`), none left to spend (`slots`) or none used to restore
 * (`full`); and while the character is transformed, as the sheet last said (`shaped`).
 * From module 0.42.1, a spell prepared or unprepared that isn't one the character prepares: a
 * cantrip, one always prepared, one cast at will, innately, as a ritual or from an item
 * (`prepare`); one the sheet doesn't list is `gone`.
 * From module 0.45.0, for dice the game asked for: the ask isn't the seat's, its player's while
 * they type in their dice, no longer waits, or is answered already, as from another device
 * (`diceAsk`); or its values don't fit it (`dice`).
 */
export type RollRefusal =
  | 'unavailable'
  | 'unknown'
  | 'not-dying'
  | 'not-in-combat'
  | 'already-rolled'
  | 'slots'
  | 'slot'
  | 'mode'
  | 'ammo'
  | 'target'
  | 'gone'
  | 'no-damage'
  | 'damaged'
  | 'dice'
  | 'type'
  | 'prompt'
  | 'no-hit-dice'
  | 'link'
  | 'secret'
  | 'profile'
  | 'enchant-target'
  | 'applied'
  | 'enchantment'
  | 'concentration'
  | 'uses'
  | 'short'
  | 'not-inspired'
  | 'inspired'
  | 'not-yours'
  | 'not-owner'
  | 'container'
  | 'nested'
  | 'members'
  | 'split'
  | 'changed'
  | 'critical'
  | 'charged'
  | 'follows'
  | 'not-started'
  | 'moved'
  | 'not-turn'
  | 'not-undoable'
  | 'effect'
  | 'form'
  | 'transformed'
  | 'incapacitated'
  | 'consume'
  | 'not-shaped'
  | 'full'
  | 'swap'
  | 'shaped'
  | 'prepare'
  | 'diceAsk'

/**
 * Why a roll wasn't taken, with the HTTP status that says so; for a move of items and coins, from
 * module 0.31.0, also that the seat has a move of the same on its way already (`moving`), and for
 * a removal, from module 0.33.0, a move or removal of the item, of anything in it, or of a
 * container it's in.
 */
export type RollRejection = {
  status: 409 | 422 | 429
  reason: RollRefusal | 'busy' | 'moving'
}

/**
 * What a roll reads of its campaign (`ROLL_CAMPAIGN`, src/db/roll-requests.ts): whether the
 * game takes it, how, and its roster. Tied to that select both ways there: a field added here
 * must be read there, and one read there must be added here.
 */
export type RollCampaign = {
  rollsEnabled: boolean
  rollKinds: string[]
  rollFeatures: string[]
  bridgePolledAt: Date | null
  characters: unknown
  companions: unknown
  companionKinds: string[]
  companionInitiative: string
}

/** A roll request as it's held: what to roll, and how far it has got. */
export type HeldRollRequest = {
  id: string
  actorId: string
  /** Who sent it: the character's player, or the campaign's Gamemaster as it (#156). */
  role: 'player' | 'gm'
  kind: string
  payload: unknown
  status: 'pending' | 'claimed' | 'done' | 'failed'
  result: unknown
  createdAt: Date
  claimedAt: Date | null
  /** For a companion's roll, from module 0.36.0: the character whose companion `actorId` is. */
  ofActorId?: string | null
}

/**
 * Dice the game asked for, as the module is sent them (module 0.45.0): the ask they answer, and the
 * values typed for each of its terms, as `dice`, by roll and term; typed, and thrown no other way.
 */
export type DiceAnswerCommand = Pick<
  RollRequestInput,
  'mode' | 'explicit' | 'extras'
> & {
  kind: 'dice'
  diceAsk: string
  dice: DiceAnswerTerm[]
  typed: true
}

/**
 * A roll as the module is sent it: whose, what, how, and the dice to make it with; and from module
 * 0.23.0, `by: 'gm'` for one the campaign's Gamemaster made as the character, which the module
 * marks as theirs. A player's has no `by`. From module 0.36.0, a companion's names its character,
 * `of`, its `actorId` being the companion's key. From module 0.45.0, dice the game asked for, as
 * their own command.
 */
export type RollCommand = (RollRequestInput | DiceAnswerCommand) & {
  id: string
  actorId: string
  of?: string
  by?: 'gm'
}

/**
 * What a typed roll's dice asks say of it, from module 0.45.0: how long, in milliseconds, they held
 * it, and whether one is waiting for its player now.
 */
export type RollAsks = { held: number; waiting: boolean }

/** An End Turn as it's held, for taking it back (module 0.36.0): how far it got, and when. */
export type HeldEndTurn = {
  status: string
  completedAt: Date | null
  payload: unknown
}
