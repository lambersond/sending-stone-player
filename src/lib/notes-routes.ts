import { MAX_NOTE_BYTES } from '@/constants/notes'
import { getCharacter } from '@/db/characters'
import {
  changeNote,
  createNote,
  deleteNote,
  getNotesStatus,
  getNotesView,
  previewNote,
  resolveNote,
  type NoteAnswer,
  type NotesBook,
  type NotesSeat,
} from '@/db/notes'
import { partyNotesAccess, partySeat, type PartySeat } from '@/db/party'
import { notePlayersSeen } from '@/db/roll-requests'
import { getGmSeat, playerSeat } from '@/db/seats'
import { noting } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import {
  noteChangeSchema,
  noteInputSchema,
  notePreviewSchema,
  noteResolveSchema,
} from '@/schemas/notes'
import { NOTE_ID } from '@/utils/note-id'
import type { NextRequest } from 'next/server'
import type { z } from 'zod'

// What a book of journal notes' routes answer (round 0.34.0 §8.6), from module 0.34.0, once they
// know who is at it: a character's player, through their Character; the campaign's Gamemaster,
// through the campaign they own; and for a party's book, either of them while they may see the
// party now, checked on every request, the 204 one too. The book is the seat's, from the address
// alone, never from a request's body: anyone else is answered 404, saying no more. Writes are
// taken whatever Foundry's state: notes are kept here first, and reach Foundry once it takes them.

const headers = { 'Cache-Control': 'no-store' }

/** Who is at a book, and which book: as resolved from the session and the address. */
export type NotesPlace = { seat: NotesSeat; book: NotesBook }

/** A book's address, as each route's file names it. */
export type NotesAddress =
  | { kind: 'personal'; role: 'player'; character: string }
  | { kind: 'personal'; role: 'gm'; campaign: string; actor: string }
  | { kind: 'party'; role: 'player'; character: string; group: string }
  | { kind: 'party'; role: 'gm'; campaign: string; group: string }

/** The name the Gamemaster writes as. */
const GAMEMASTER = 'Gamemaster'

/** The campaign's Gamemaster at a book: as the Gamemaster, writing as no character. */
const gmSeat = (userId: string): NotesSeat => ({
  role: 'gm',
  userId,
  // eslint-disable-next-line unicorn/no-null -- the Gamemaster writes as no character
  actorId: null,
  name: GAMEMASTER,
})

/** An answer saying nothing more than its status. */
const bare = (status: number) => new Response(undefined, { status, headers })

/**
 * Who is at a book at this address, and which book (§8.5): 401 signed out, and 404 where it isn't
 * the signed-in user's to see: another player's character, another Gamemaster's campaign, a
 * character not in its campaign's roster at the Gamemaster's, or a party the seat may not see now.
 */
export async function notesSeat(
  address: NotesAddress,
): Promise<NotesPlace | Response> {
  const user = await getCurrentUser()
  if (!user) return bare(401)

  if (address.role === 'gm') {
    if (address.kind === 'personal') {
      const seat = await getGmSeat(user.id, address.campaign, address.actor)
      if (!seat?.campaignId || !seat.actorId) return bare(404)
      return {
        seat: gmSeat(user.id),
        book: {
          campaignId: seat.campaignId,
          kind: 'personal',
          actorId: seat.actorId,
          private: false,
        },
      }
    }
    const party: PartySeat = {
      role: 'gm',
      campaignId: address.campaign,
      userId: user.id,
    }
    const access = await partyNotesAccess(party, address.group)
    if (!access) return bare(404)
    return {
      seat: gmSeat(user.id),
      book: {
        campaignId: access.campaignId,
        kind: 'party',
        actorId: access.groupId,
        private: access.private,
      },
    }
  }

  const character = await getCharacter(user.id, address.character)
  if (!character?.campaignId || !character.actorId) return bare(404)
  const seat: NotesSeat = {
    role: 'player',
    userId: user.id,
    actorId: character.actorId,
    name: character.name,
  }
  if (address.kind === 'personal') {
    return {
      seat,
      book: {
        campaignId: character.campaignId,
        kind: 'personal',
        actorId: character.actorId,
        private: false,
      },
    }
  }
  const access = await partyNotesAccess(
    partySeat(playerSeat(character, user.id)),
    address.group,
  )
  if (!access) return bare(404)
  return {
    seat,
    book: {
      campaignId: access.campaignId,
      kind: 'party',
      actorId: access.groupId,
      private: access.private,
    },
  }
}

/**
 * A book as the seat sees it, for its page to poll. Pass the version and the liveness as last
 * seen, as `?version=7&live=1`, to get 204 No Content while neither has changed. A player at it is
 * noted present, so the Gamemaster's module holds its fetch open for their changes.
 */
export async function notesResponse(
  request: NextRequest,
  { seat, book }: NotesPlace,
): Promise<Response> {
  if (seat.role === 'player') {
    await noting(
      () => notePlayersSeen(book.campaignId),
      'Failed to note a player at their notes',
    )
  }
  const known = request.nextUrl.searchParams
  if (known.has('version')) {
    const status = await getNotesStatus(book)
    if (!status) return bare(404)
    if (
      Number(known.get('version')) === status.version &&
      (known.get('live') === '1') === status.live
    ) {
      return bare(204)
    }
  }
  const view = await getNotesView(seat, book)
  if (!view) return bare(404)
  return Response.json(view, { headers })
}

/** A request's JSON body, read within the limit; or why it can't be read. */
async function readBody(request: NextRequest): Promise<unknown> {
  // Asked for only as JSON, which a page on another site can't send without asking first.
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw bare(415)
  }
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_NOTE_BYTES) {
    throw refused(413, { reason: 'invalid' })
  }
  try {
    return JSON.parse(body)
  } catch {
    throw refused(400, { reason: 'invalid' })
  }
}

/** A body checked against a schema, or 400 with the first field it got wrong. */
function parsed<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const field = result.error.issues[0]?.path[0]
  throw refused(400, {
    reason: 'invalid',
    ...(typeof field === 'string' && { field }),
  })
}

/** A refusal: its status, and why as `{reason}`, with a field or the lines of headings. */
function refused(status: number, body: object): Response {
  return Response.json(body, { status, headers })
}

/** What a change answered, as its route answers it. */
function answered(answer: NoteAnswer, status: number): Response {
  if (!answer.ok) {
    const { status: refusal, reason, field, lines } = answer
    return refused(refusal, {
      reason,
      ...(field !== undefined && { field }),
      ...(lines !== undefined && { lines }),
    })
  }
  return Response.json(
    { ...(answer.id !== undefined && { id: answer.id }), stamp: answer.stamp },
    { status, headers },
  )
}

/** Run a route's body, answering with the response it threw where it couldn't go on. */
async function answering(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }
}

/**
 * Add a note or chapter: 201 Created with its id, made here, and its stamp; 415 for anything but
 * JSON, 413 for too much, 400 for what isn't a note; and for the app's own checks, 409, 422 or 429
 * with why as `{reason}`, the lines of headings with it.
 */
export async function notesPostResponse(
  request: NextRequest,
  { seat, book }: NotesPlace,
): Promise<Response> {
  return answering(async () => {
    const input = parsed(noteInputSchema, await readBody(request))
    return answered(await createNote(seat, book, input), 201)
  })
}

/**
 * Change a note or chapter, from the stamp the page last saw of it, or settle a change the game
 * didn't take, `{resolve, stamp}`: 200 with its stamp now, or why not.
 */
export async function notePatchResponse(
  request: NextRequest,
  { seat, book }: NotesPlace,
  noteId: string,
): Promise<Response> {
  return answering(async () => {
    if (!NOTE_ID.test(noteId)) return bare(404)
    const body = await readBody(request)
    if (typeof body === 'object' && body !== null && 'resolve' in body) {
      const choice = parsed(noteResolveSchema, body)
      return answered(await resolveNote(seat, book, noteId, choice), 200)
    }
    const change = parsed(noteChangeSchema, body)
    return answered(await changeNote(seat, book, noteId, change), 200)
  })
}

/** Delete an entry, from the stamp the page last saw of it, `?stamp=`: 200, or why not. */
export async function noteDeleteResponse(
  request: NextRequest,
  { seat, book }: NotesPlace,
  noteId: string,
): Promise<Response> {
  if (!NOTE_ID.test(noteId)) return bare(404)
  const stamp = request.nextUrl.searchParams.get('stamp')
  if (!stamp || stamp.length > 80) {
    return refused(400, { reason: 'invalid', field: 'stamp' })
  }
  return answered(await deleteNote(seat, book, noteId, stamp), 200)
}

/**
 * A note's Markdown as the book will draw it, `{html, headings}`, and the lines of any # or ##
 * heading: nothing is stored.
 */
export async function notePreviewResponse(
  request: NextRequest,
  { book }: NotesPlace,
): Promise<Response> {
  return answering(async () => {
    const { body } = parsed(notePreviewSchema, await readBody(request))
    const preview = await previewNote(book, body)
    if (!preview) return bare(404)
    return Response.json(preview, { headers })
  })
}
