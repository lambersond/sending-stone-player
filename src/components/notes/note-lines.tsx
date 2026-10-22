'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { NoteTime } from './note-time'
import {
  drawDescription,
  readDescription,
} from '@/components/character-sheet/description-html'
import { noteStateWords } from '@/utils/note-words'
import type { NoteChapterView, NoteEntryView, NoteState } from '@/types/notes'

/*
 * What the journal says of a note or chapter in a line (round 0.35.0 §8.8-§8.9): who wrote it and
 * who changed it last, where it stands as a mark, and its text as the book draws it.
 */

/** Why a note is changed only in Foundry, said where its Edit would be. */
export const FOUNDRY_ONLY: Record<
  NonNullable<NoteEntryView['foundryOnly']>,
  string
> = {
  html: 'Written in Foundry’s own editor: change it there.',
  long: 'Too long to change here: change it in Foundry.',
  secret: 'It holds a Gamemaster’s secret: change it in Foundry.',
}

/** Who wrote a note and when, or that it was written in Foundry: said whoever changed it last. */
export function Written({ entry }: Readonly<{ entry: NoteEntryView }>) {
  const { author, createdAt } = entry
  return (
    <>
      {author ? `Written by ${author.name}` : 'Written in Foundry'},{' '}
      <NoteTime value={createdAt} />
    </>
  )
}

/** Who changed a note last and when, here or in Foundry: "Last changed by Vex in Foundry, …". */
export function LastChanged({ entry }: Readonly<{ entry: NoteEntryView }>) {
  const { modifiedBy, modifiedIn, modifiedAt } = entry
  return (
    <>
      Last changed by {modifiedBy}
      {modifiedIn === 'foundry' && ' in Foundry'},{' '}
      <NoteTime value={modifiedAt} />
    </>
  )
}

/**
 * Who added a chapter, or renamed it last, and when, here or in Foundry: a chapter made here is
 * changed only by a rename, and is as it was made while it was last changed when made.
 */
export function ChapterLine({
  chapter,
}: Readonly<{ chapter: NoteChapterView }>) {
  const { modifiedIn, modifiedAt, createdAt, modifiedBy } = chapter
  let what = 'Renamed by'
  if (modifiedIn === 'foundry') what = 'Changed in Foundry by'
  else if (modifiedAt === createdAt) what = 'Added by'
  return (
    <>
      {what} {modifiedBy}, <NoteTime value={modifiedAt} />
    </>
  )
}

/** The states a note's mark warns of: its change didn't reach Foundry, and it waits on a choice. */
const WARNS = new Set<NoteState>(['conflict', 'gone', 'failed'])

/**
 * Where a note stands, as an icon alone, in the contents and on a card: its chip's words are its
 * title and what a screen reader says. A delete waiting is waiting, not a choice. Nothing for a
 * note the same here and in Foundry.
 */
export function StateMark({ state }: Readonly<{ state: NoteState }>) {
  const words = noteStateWords(state)
  if (!words) return
  const warns = WARNS.has(state)
  let icon = <Clock aria-hidden className='size-3.5' />
  if (state === 'saving') {
    icon = (
      <LoaderCircle aria-hidden className='size-3.5 motion-safe:animate-spin' />
    )
  } else if (warns) {
    icon = <TriangleAlert aria-hidden className='size-3.5' />
  }
  return (
    <span
      title={words}
      className={clsx(
        'inline-flex shrink-0',
        warns ? 'text-warning' : 'text-text-secondary',
      )}
    >
      {icon}
      <span className='sr-only'>{words}</span>
    </span>
  )
}

/**
 * A note's text, or a chapter's, as the book draws it, at the reader's size, its tables scrolling
 * inside it. Lifted, its own headings come a level up, so under a note's h3 a ### is an h4 and
 * nothing skips a level; on a card, under its h4, they stay as the server drew them.
 */
export function NoteText({
  html,
  lifted = false,
}: Readonly<{ html: string; lifted?: boolean }>) {
  const body = useMemo(() => {
    const read = html ? readDescription(html) : undefined
    return read && lifted ? lift(read) : read
  }, [html, lifted])
  if (!body) return
  return (
    <div className='overflow-x-auto'>
      <div className={clsx('sheet-text note-text reading', lifted && 'lifted')}>
        {drawDescription(body)}
      </div>
    </div>
  )
}

/**
 * A note's headings a level up: the server draws a note's own headings two levels down, h1-h3 as
 * h5 and h4-h6 as h6, under the h4 a note had in v0.34; under the reader's h3 they're one level
 * down, so each h5 becomes an h4 and each h6 an h5, their content and attributes kept.
 */
export function lift(body: HTMLElement): HTMLElement {
  const lifted = body.cloneNode(true) as HTMLElement
  const document = lifted.ownerDocument
  for (const heading of lifted.querySelectorAll('h5, h6')) {
    const raised = document.createElement(
      heading.localName === 'h5' ? 'h4' : 'h5',
    )
    for (const { name, value } of heading.attributes) {
      raised.setAttribute(name, value)
    }
    raised.append(...heading.childNodes)
    heading.replaceWith(raised)
  }
  return lifted
}

/*
 * What the seat may do to a note or chapter, offered only where the server would take it (round
 * 0.35.0 §8.13): nothing in a book that takes no change (`canAdd` false), and nothing that would
 * be refused while a change refused by the game waits on a choice.
 */

/** Edit: the seat may change it, here, and no choice waits on it. */
export function mayEdit(entry: NoteEntryView, canAdd: boolean): boolean {
  return (
    canAdd &&
    entry.canEdit &&
    !entry.foundryOnly &&
    entry.state !== 'conflict' &&
    entry.state !== 'gone'
  )
}

/** Delete: the seat may delete it, it isn't being deleted, and no choice waits on it. */
export function mayDelete(entry: NoteEntryView, canAdd: boolean): boolean {
  return (
    canAdd &&
    entry.canDelete &&
    entry.state !== 'deleting' &&
    entry.state !== 'conflict' &&
    entry.state !== 'gone'
  )
}

/** Rename: the seat may rename the chapter, and no choice waits on it. */
export function mayRename(chapter: NoteChapterView, canAdd: boolean): boolean {
  return (
    canAdd &&
    chapter.canRename &&
    chapter.state !== 'conflict' &&
    chapter.state !== 'gone'
  )
}

/** The states a note may be moved in: as the game has it, or its change waiting or on its way. */
const SETTLED = new Set<NoteState>(['synced', 'waiting', 'saving'])

/**
 * Move to a chapter: Edit's rights, for it's the change Edit's Chapter field makes; a note settled
 * with the game or on its way to it, as a move folded into a refused change would send that
 * change's title; and a chapter to go to.
 */
export function mayMove(
  entry: NoteEntryView,
  canAdd: boolean,
  chapters: readonly NoteChapterView[],
): boolean {
  return (
    mayEdit(entry, canAdd) && SETTLED.has(entry.state) && chapters.length > 0
  )
}
