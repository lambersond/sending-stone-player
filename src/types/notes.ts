import type { TIDY_SOURCES } from '@/constants/notes'

/** Whose journal: a character's own notes, or a party's. From module 0.34.0. */
export type NoteBookKind = 'personal' | 'party'

/** Where a Tidy 5e Sheets journal entry is kept on its character (module 0.45.0). */
export type TidySource = (typeof TIDY_SOURCES)[number]

/** A chapter, a level 1 heading in Foundry's journal; or an entry under one, a level 2. */
export type NoteRole = 'chapter' | 'entry'

/**
 * Where a note stands between here and the game: the same in both; saved here and waiting for the
 * game; on its way to it; changed in Foundry while a change waited; deleted in Foundry while a
 * change waited; refused by the game; or deleted here and waiting to be deleted there.
 */
export type NoteState =
  'synced' | 'waiting' | 'saving' | 'conflict' | 'gone' | 'failed' | 'deleting'

/** Why the game refused a change (round 0.34.0 §3.6). */
export type NoteReason =
  | 'changed'
  | 'gone'
  | 'not-yours'
  | 'not-member'
  | 'private'
  | 'unknown'
  | 'headings'
  | 'full'
  | 'invalid'
  | 'foundry-only'
  | 'off'
  | 'error'

/** Who wrote or last changed a note, by name: a character, the Gamemaster, or a Foundry user. */
type NoteWho = { name: string }

export type NoteChapterView = {
  id: string
  title: string
  /** Text written under it in Foundry, sanitised: shown, never changed here. */
  html: string
  createdAt: string
  modifiedAt: string
  modifiedBy: string
  modifiedIn: 'app' | 'foundry'
  state: NoteState
  reason?: NoteReason
  canRename: boolean
  /**
   * What the page last saw of it, sent back with a change so that one made meanwhile is kept:
   * `w:<write id>.<seq>` while a change waits, else `n:<revision>`.
   */
  stamp: string
  /**
   * The change the game didn't take: the seat's own, or for the Gamemaster another seat's, whose
   * name `by` gives (left out where it's the viewer's own).
   */
  mine?: { title: string; by?: string }
}

export type NoteEntryView = {
  id: string
  chapterId: string | null
  title: string
  html: string
  /** Its Markdown: only for a seat that may change it. */
  body?: string
  createdAt: string
  /** Who wrote it; null for one written in Foundry. */
  author: NoteWho | null
  modifiedAt: string
  modifiedBy: string
  modifiedIn: 'app' | 'foundry'
  state: NoteState
  reason?: NoteReason
  canEdit: boolean
  canDelete: boolean
  /**
   * Why it's changed only in Foundry: written in its own editor; too long for the app to save back
   * (cut short, over 20,000 characters, or titled over 200); or a party page holding a secret.
   */
  foundryOnly?: 'html' | 'long' | 'secret'
  stamp: string
  /**
   * The change the game didn't take: the seat's own, or for the Gamemaster another seat's, whose
   * name `by` gives (left out where it's the viewer's own).
   */
  mine?: {
    title: string
    html: string
    body: string
    chapterId: string | null
    deleting?: true
    by?: string
  }
}

/**
 * Where a group's order stands between here and the game (module 0.35.0): the same in both; saved
 * here and waiting for the game; on its way to it; refused because the same notes were reordered
 * in Foundry meanwhile; or refused by the game otherwise.
 */
export type NoteOrderState =
  'synced' | 'waiting' | 'saving' | 'conflict' | 'failed'

/**
 * The notes of one chapter, or of none (module 0.35.0): where their order stands, and what the page
 * last saw of it. The notes themselves are in `entries`, in this order.
 */
export type NoteGroupView = {
  /** The chapter; null for the notes in no chapter. */
  chapterId: string | null
  state: NoteOrderState
  reason?: NoteReason
  /** Sent back with a new order or a choice, so that one made meanwhile is kept: `g:<16 hex>`. */
  stamp: string
  /**
   * The order the game didn't take, by the notes' ids: the seat's own, or for the Gamemaster
   * another seat's, whose name `by` gives (left out where it's the viewer's own).
   */
  mine?: { ids: string[]; by?: string }
}

/** The journal's last change, by anyone, to anything in it the seat sees (module 0.35.0). */
export type NoteLastChange = { by: string; at: string }

export type NotesView = {
  version: number
  kind: NoteBookKind
  /** The journal's name in Foundry, once it has one. */
  journal: string | null
  /** The game takes notes and is fetching them now. */
  live: boolean
  /** The campaign's module takes notes, 0.34.0 or later, as its latest hello said. */
  enabled: boolean
  /** The seat may add notes and chapters. */
  canAdd: boolean
  /** The book's actor is still in the campaign: else nothing here can be changed. */
  connected: boolean
  /** The seat may put the notes of a chapter, or of none, in order (module 0.35.0). */
  canReorder: boolean
  /** The campaign's module takes orders, 0.35.0 or later, as its latest hello said. */
  orders: boolean
  /** Who last changed anything in it the seat sees, and when; none in a journal never changed. */
  lastChange?: NoteLastChange
  /** Why Foundry sends none now: no player can see the party there, or too large to send. */
  withheld?:
    | { reason: 'private' }
    | { reason: 'tooLarge'; bytes?: number; limit?: number }
  /** Oldest first. */
  chapters: NoteChapterView[]
  /** The notes in no chapter first, then each chapter's, as `chapters` lists them. */
  groups: NoteGroupView[]
  /**
   * In reading order: the notes in no chapter first, then each chapter's, as `groups` lists them,
   * each group's notes in its order.
   */
  entries: NoteEntryView[]
  /**
   * A character's Tidy 5e Sheets journal, read only (module 0.45.0): only in a personal book whose
   * character holds entries of it, shown after everything else.
   */
  tidy?: NotesTidyView
}

/**
 * A character's Tidy 5e Sheets journal as a seat sees it (module 0.45.0): whether Tidy is active in
 * Foundry, so its entries can be changed there; whether it's installed; whether its Classic sheet's
 * boxes are shown anywhere in Foundry, which Tidy 14 and later no longer does; and its entries, in
 * the order Tidy shows them.
 */
export type NotesTidyView = {
  active: boolean
  installed: boolean
  classicGone: boolean
  entries: NoteTidyView[]
}

/** One of a character's Tidy 5e Sheets journal entries, shown read only (module 0.45.0). */
export type NoteTidyView = {
  /** Its key among the book's Tidy entries: `<from>:<Tidy's key>`. */
  key: string
  from: TidySource
  /** Its title, or for none the words Tidy shows it by. */
  title: string
  html: string
  /** Its secret sections were left out, as no player owns the character in Foundry. */
  secret: boolean
  /** When the app first saw it, and last saw it change; null where it can't say. */
  firstSeenAt: string | null
  changedAt: string | null
}

/** A note or chapter to add. A chapter has no body and no chapter. */
export type NoteInput = {
  role: NoteRole
  title: string
  body?: string
  chapterId?: string | null
}

/** A change to a note or chapter, from what the page last saw of it. */
export type NoteChange = {
  title: string
  body?: string
  chapterId?: string | null
  stamp: string
}

/** The seat's choice where the game didn't take its change. */
export type NoteResolve = { resolve: 'mine' | 'theirs'; stamp: string }

/** A new order of a group's notes, from what the page last saw of it (module 0.35.0). */
export type NoteOrder = {
  chapterId: string | null
  ids: string[]
  stamp: string
}

/** The seat's choice where the game didn't take a group's order (module 0.35.0). */
export type NoteOrderResolve = {
  chapterId: string | null
  resolve: 'mine' | 'theirs'
  stamp: string
}

/** Why the app refused a change at once. */
export type NoteRefusal =
  | 'invalid'
  | 'not-yours'
  | 'changed'
  | 'saving'
  | 'conflict'
  | 'chapter'
  | 'foundry-only'
  | 'private'
  | 'unknown'
  | 'headings'
  | 'gone'
  | 'full'
  | 'busy'

/** What a write answered: its id and stamp, or why not, with a field or the lines of headings. */
export type NoteWriteAnswer =
  | { ok: true; id?: string; stamp?: string }
  | {
      ok: false
      reason: NoteRefusal | 'network'
      field?: string
      lines?: number[]
    }

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

/** What a seat may do in a book, and with a note in it (§8.5). */
export type NoteRights = {
  canAdd: boolean
  canRename: boolean
  canEdit: boolean
  canDelete: boolean
  canReorder: boolean
}

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
