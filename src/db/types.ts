import type { BRIDGE_SWITCHES } from '@/constants/features'
import type { SheetSeat } from '@/types/character'
import type { NoteBookKind, NoteRole, NoteRefusal } from '@/types/notes'
import type {
  RollKindInfo,
  RollRequestInput,
  RollKind,
  RollFeature,
} from '@/types/roll'
import type {
  CharacterSheet,
  DishApplied,
  DishDismissed,
} from '@/types/sending-stone'
import type { GmRolls } from '@/types/table'
import type { RollRefusal } from '@/utils/requests/types'
import type { Prisma, CookbookDishStatus } from '@prisma/client'

/** A note command, as the module fetches it (round 0.34.0 §3.4): a change to one page. */
export type NotePageCommand = {
  id: string
  actorId: string
  kind: 'note'
  by?: 'gm'
  note: {
    book: NoteBookKind
    op: 'create' | 'update' | 'delete'
    id: string
    role: NoteRole
    base: string | null
    writer: string | null
    at: number
    title?: string
    markdown?: string
    chapter?: string | null
    createdAt?: number
  }
  mode: 0
  explicit: false
  extras: []
  dice: []
}

/**
 * Whose rolls are asked after: a seat's (#156), as a sheet's routes resolve it; or, from module
 * 0.36.0, one following the rolls it sent for one of its character's companions, which needs only
 * whose companion that is, so that a roll sent a moment before the module stopped listing it is
 * still answered (`companionRollSeat`, APP src/db/companions.ts).
 */
export type RollSeat = Pick<
  SheetSeat,
  'role' | 'userId' | 'campaignId' | 'actorId' | 'characterId'
> & { companion?: Pick<NonNullable<SheetSeat['companion']>, 'of'> }

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
 * A command a seat sends that rides to the game as a roll does but is none, each with a switch of
 * the campaign's own, as `createCommand` takes it: an item removed, a favorite, an effect changed,
 * Wild Shape. A move has gates of its own.
 */
export type CommandKind = 'remove' | 'favorite' | 'effect' | 'wildShape'

/** What a command does, as its input holds it under its kind. */
export type CommandValue<K extends CommandKind> = NonNullable<
  RollRequestInput[K]
>

/** One of a seat's rows on its way, as a command is checked against it. */
export type WaitingRow = { kind?: string; payload: Prisma.JsonValue }

/** What `createCommand` reads of a campaign: the kind's switch, its last fetch, its roster. */
export type CommandCampaign = Partial<
  Record<NonNullable<RollKindInfo['own']>, boolean>
> & { bridgePolledAt: Date | null; characters: Prisma.JsonValue }

/** How `createCommand` takes one kind of command. */
export type CommandSpec<K extends CommandKind> = {
  /** The kind, and the input's field that holds what to do. */
  kind: K
  /**
   * Which of the seat's rows on their way it's checked against, and what of them is read; none
   * where `skip` says it needs none.
   */
  waiting: {
    kind: Prisma.RollRequestWhereInput['kind']
    select: { kind?: true; payload: true }
    skip?: (value: CommandValue<K>) => boolean
  }
  /** Why the sheet, as last sent, refuses it, if it does. */
  check: (
    value: CommandValue<K>,
    sheet: CharacterSheet | undefined,
  ) => RollRefusal | undefined
  /** Whether a row on its way would have the game make it twice, or on what that one left. */
  clashes: (
    waiting: WaitingRow[],
    value: CommandValue<K>,
    sheet: CharacterSheet | undefined,
    actorId: string,
  ) => boolean
}

/**
 * A row held for the module, but who sent it and when: its campaign and actor, then the rest, in
 * the order it's written.
 */
export type CommandRow = Omit<
  Prisma.RollRequestUncheckedCreateInput,
  'characterId' | 'role' | 'requestedById' | 'createdAt'
>

/** One of the campaign's switches the module's fetches are answered by (`BRIDGE_SWITCHES`). */
export type BridgeSwitch = (typeof BRIDGE_SWITCHES)[number]

/**
 * What a fetch of the module's says of its campaign: each of its switches, and whether any of its
 * players have their table open, so that a roll may be coming.
 */
export type BridgePolled = Record<BridgeSwitch, boolean> & {
  playersPresent: boolean
}

/** A creator of a kind of command, past every roll's gates. */
export type CommandCreator = (
  seat: SheetSeat,
  input: RollRequestInput,
) => Promise<{ id: string } | RollRejection>

/**
 * Who is at a book of notes, as its route resolved them from the session and the address alone:
 * the character's player, as their character, or the campaign's Gamemaster, as no character.
 */
export type NotesSeat = {
  role: 'player' | 'gm'
  userId: string
  /** The player's character's actor, which they write as; null for the Gamemaster. */
  actorId: string | null
  /** The character's name, as their seat knows it; the Gamemaster's is "Gamemaster". */
  name: string
}

/** The book a seat is at: a character's or a party's, in one campaign. */
export type NotesBook = {
  campaignId: string
  kind: NoteBookKind
  /** The character's actor, or the party's Group actor. */
  actorId: string
  /** A party no campaign character may see in Foundry, which only its Gamemaster reaches. */
  private: boolean
}

/** What a change answered: done, with the note's id and stamp now, or why not, with a status. */
export type NoteAnswer =
  | { ok: true; id?: string; stamp: string }
  | {
      ok: false
      status: 400 | 403 | 404 | 409 | 422 | 429
      reason: NoteRefusal
      field?: string
      lines?: number[]
    }

/** What a seat may do in a book, and with a note in it (§8.5). */
export type NoteRights = {
  canAdd: boolean
  canRename: boolean
  canEdit: boolean
  canDelete: boolean
  canReorder: boolean
}

/** A link as the cookbook's post is checked against it. */
export type CookbookLinkFound = {
  id: string
  campaignId: string
  actorId: string
  characterId: string
  /** Its seat now: the link holds only while these are still the link's. */
  character: { campaignId: string | null; actorId: string | null }
  campaign: { dishesEnabled: boolean; dishVersions: number[] }
}

/** What became of a dish posted: taken, held already, or why not. */
export type DishAccepted =
  | { kind: 'new' | 'repeat'; id: string; status: CookbookDishStatus }
  | { kind: 'off' | 'update' | 'busy' | 'daily' | 'full' }

/** Why no link code was made. */
export type CookbookLinkProblem = 'missing' | 'not-playing'

/** A Gamemaster's choice of what became of a dish, as the module's bridge tells of it. */
export type DishDecision =
  | { type: 'dish.applied'; data: DishApplied }
  | { type: 'dish.dismissed'; data: DishDismissed }

/** A player's character playing in a campaign, whose card is drawn. */
export type CookbookSeat = { id: string; campaignId: string; actorId: string }

/** The campaign an event is for, with the module session whose state it holds, if any. */
export type EventCampaign =
  { id: string; helloSession?: string } | 'unknown' | 'refused'

/** Who is at a party sheet: a player, through their character, or the campaign's Gamemaster. */
export type PartySeat =
  | {
      role: 'player'
      campaignId: string | null
      actorId: string | null
      characterId: string
      name: string
    }
  | { role: 'gm'; campaignId: string; userId: string }

/**
 * What tells a companion's pane whether anything is new: as a character's view, the campaign's
 * version, whether it's live, the rolls the game takes for it and what else it does with them,
 * where the Gamemaster's rolls go at their seat, what changes whenever any of the Gamemaster's
 * rolls as it does, at its player's, and whether its player types in their own dice. A change of
 * how companions enter initiative comes in a hello, which moves the version.
 */
export type CompanionStatus = {
  version: number
  live: boolean
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
  gm?: { rolls: GmRolls }
  gmRollsKey?: string
  typed: boolean
}

/**
 * What tells a viewer whether anything is new: the campaign's version, whether it is live, and
 * which rolls its game takes from players, and what else it does with them; for the Gamemaster at
 * a character's sheet (#156), where their rolls go; and for its player, what changes whenever any
 * of the rolls the Gamemaster made as their character lately does, `TableView`'s `gmRollsKey`; and
 * from module 0.31.0, whether the seat may move its character's items and coins, which its game's
 * taking moves or not changes with no new version; and from module 0.32.0, whether the player
 * types in their own dice for it, which another of their devices may change; and from module
 * 0.33.0 whether the seat may remove its character's items, which its module's fetching or not
 * changes with no new version; and from module 0.37.0 whether the player may change its
 * character's favorites, which likewise changes with no new version; and from module 0.39.0
 * whether the player may change its character's own effects, which likewise changes with no new
 * version; and from module 0.40.0 whether the player may use Wild Shape, which likewise changes
 * with no new version.
 */
export type CampaignStatus = {
  version: number
  live: boolean
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
  gm?: { rolls: GmRolls }
  gmRollsKey?: string
  moves: boolean
  typed: boolean
  removes: boolean
  favorites: boolean
  effects: boolean
  wildShape: boolean
}

/**
 * An order of a group's notes, as the module fetches it (round 0.35.0 §3.4): the group's notes'
 * ids in the new order, and in Foundry's order it was made from.
 */
export type NoteOrderCommand = Omit<NotePageCommand, 'note'> & {
  note: {
    book: NoteBookKind
    op: 'order'
    /** The group: a chapter's page, or null for the notes in no chapter. */
    chapter: string | null
    ids: string[]
    was: string[]
    writer: string | null
    at: number
  }
}

/** A note command, as the module fetches it: a change to one page, or from 0.35.0 an order. */
export type NoteCommand = NotePageCommand | NoteOrderCommand

/** A book's notes drawn ahead of the transaction that keeps them, by note, for one origin. */
export type JournalDrawings = { origin: string; html: Map<string, string> }

/** A database transaction's client, as the writes made in one take it. */
export type Tx = Prisma.TransactionClient

/** Why a character could not be chosen. */
export type ChoiceProblem = 'invalid-invite' | 'unknown-character' | 'taken'
