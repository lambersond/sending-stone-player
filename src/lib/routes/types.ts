import type { NotesSeat, NotesBook } from '@/db/types'
import type { RefusalReason } from '@/types/sending-stone'

/** What a page last saw, by its query's key, as `seenAs` compares it with what's current. */
export type Seen = Record<string, number | boolean | string>

/** The headers of a seat route's 404, and of its 401 where they differ (`seatAnswer`). */
export type SeatHeaders = { headers?: HeadersInit; signedOut?: HeadersInit }

/** How a route reads its JSON body (`readBody`). */
export type BodyRules = {
  /** The largest body taken, in bytes. */
  limit: number
  /** Whether it must be sent as JSON, its type read as sent or lower-cased; unchecked if not. */
  type?: 'exact' | 'lower'
  /** Whether a declared size over the limit is refused before reading. */
  declared?: boolean
  /** Each value as it's read, as `JSON.parse`'s reviver. */
  reviver?: (key: string, value: unknown) => unknown
}

/** A body as read, or why it can't be. */
export type BodyRead =
  | { ok: true; text: string; value: unknown }
  | { ok: false; why: 'type' | 'size' | 'json' }

/** Who is at a book, and which book: as resolved from the session and the address. */
export type NotesPlace = { seat: NotesSeat; book: NotesBook }

/** A book's address, as each route's file names it. */
export type NotesAddress =
  | { kind: 'personal'; role: 'player'; character: string }
  | { kind: 'personal'; role: 'gm'; campaign: string; actor: string }
  | { kind: 'party'; role: 'player'; character: string; group: string }
  | { kind: 'party'; role: 'gm'; campaign: string; group: string }

/**
 * Why a request from the module is refused, as its JSON body says: a `reason` the module words
 * itself, a `message` for a module that doesn't know the reason, and what more there is to say.
 */
export type Refusal = {
  reason: RefusalReason
  message: string
  /** The largest body taken, in bytes. */
  limit?: number
  /** The protocol taken. */
  protocol?: number
  /** The event type refused. */
  type?: string
  /** What was wrong with it. */
  detail?: string
}
