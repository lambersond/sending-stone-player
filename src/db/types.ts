import type { BRIDGE_SWITCHES } from '@/constants/features'
import type { SheetSeat } from '@/types/character'
import type { NoteBookKind, NoteRole } from '@/types/notes'
import type { RollKindInfo, RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/requests/types'
import type { Prisma } from '@prisma/client'

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
