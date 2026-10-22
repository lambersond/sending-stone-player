/** Whose journal: a character's own notes, or a party's. From module 0.34.0. */
export type NoteBookKind = 'personal' | 'party'

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
export type NoteWho = { name: string }

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
  /** Why Foundry sends none now: no player can see the party there, or too large to send. */
  withheld?:
    | { reason: 'private' }
    | { reason: 'tooLarge'; bytes?: number; limit?: number }
  /** Oldest first. */
  chapters: NoteChapterView[]
  /** Oldest first. */
  entries: NoteEntryView[]
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
