import type { FavoriteTarget } from '@/types/roll'

/** What a row's favorites entry was chosen for, as `offeringFavorites` notes it. */
export type ChosenFavorite = {
  target: FavoriteTarget
  name: string
  op: 'add' | 'remove'
}

/** A write the journal notes' routes were sent, as `serveNotes` notes it. */
export type Sent = { url: string; method: string; body?: unknown }

/** An answer of the journal notes' routes: its status, and its body, where it has one. */
export type Answer = { status: number; body?: unknown }

/** A sheet's part, written out by hand as JSON is. */
export type Json = Record<string, unknown>
