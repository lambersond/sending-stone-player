/* eslint-disable unicorn/no-null -- a note written in Foundry has no author */
import { render, screen } from '@testing-library/react'
import {
  ChapterLine,
  LastChanged,
  lift,
  mayDelete,
  mayEdit,
  mayMove,
  mayRename,
  NoteText,
  StateMark,
  Written,
} from './note-lines'
import { noteChapter, noteEntry } from '@/mocks/notes-server'
import type { NoteState } from '@/types/notes'

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

describe('components/notes/note-lines', () => {
  describe('Written', () => {
    it('says who wrote a note and when', () => {
      const { container } = render(
        <Written entry={noteEntry({ createdAt: ago(0) })} />,
      )
      expect(container).toHaveTextContent('Written by Thorin, just now')
      expect(container.querySelector('time')).toHaveAttribute(
        'dateTime',
        expect.any(String),
      )
    })

    it('says a note was written in Foundry', () => {
      const { container } = render(
        <Written entry={noteEntry({ author: null, createdAt: ago(120) })} />,
      )
      expect(container).toHaveTextContent('Written in Foundry, 2 hours ago')
    })
  })

  describe('LastChanged', () => {
    it.each([
      ['app', 'Last changed by Vex, just now'],
      ['foundry', 'Last changed by Vex in Foundry, just now'],
    ] as const)('says who changed a note last, %s', (where, words) => {
      const { container } = render(
        <LastChanged
          entry={noteEntry({
            modifiedBy: 'Vex',
            modifiedIn: where,
            modifiedAt: ago(0),
          })}
        />,
      )
      expect(container).toHaveTextContent(words)
    })
  })

  describe('ChapterLine', () => {
    it.each([
      [{ createdAt: ago(0), modifiedAt: ago(0) }, 'Added by Thorin, just now'],
      [
        { createdAt: ago(9), modifiedAt: ago(0) },
        'Renamed by Thorin, just now',
      ],
      [
        { modifiedAt: ago(0), modifiedIn: 'foundry' as const },
        'Changed in Foundry by Thorin, just now',
      ],
    ])('says who added or renamed a chapter: %#', (fields, words) => {
      const { container } = render(
        <ChapterLine chapter={noteChapter(fields)} />,
      )
      expect(container).toHaveTextContent(words)
    })
  })

  describe('StateMark', () => {
    it.each([
      [
        'waiting',
        'Waiting for the game',
        'text-text-secondary',
        'lucide-clock',
      ],
      [
        'deleting',
        'Deleted here, waiting for the game',
        'text-text-secondary',
        'lucide-clock',
      ],
      ['saving', 'Saving to the game…', 'text-text-secondary', 'animate-spin'],
      [
        'conflict',
        'Changed in Foundry',
        'text-warning',
        'lucide-triangle-alert',
      ],
      ['gone', 'Deleted in Foundry', 'text-warning', 'lucide-triangle-alert'],
      [
        'failed',
        'Not saved to the game',
        'text-warning',
        'lucide-triangle-alert',
      ],
    ] as const)(
      'marks %s as an icon alone, its words its title and for a screen reader',
      (state, words, colour, icon) => {
        render(<StateMark state={state} />)
        const mark = screen.getByTitle(words)
        expect(mark).toHaveClass(colour)
        expect(mark.querySelector('svg')?.getAttribute('class')).toContain(icon)
        expect(mark.querySelector('.sr-only')).toHaveTextContent(words)
      },
    )

    it('marks nothing for a note in step', () => {
      const { container } = render(<StateMark state='synced' />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('NoteText', () => {
    it('draws a note at the reader’s size, its tables scrolling inside it', () => {
      render(<NoteText html='<h5>Loot</h5><p>30 gp</p>' />)
      const loot = screen.getByRole('heading', { name: 'Loot' })
      expect(loot.localName).toBe('h5')
      const text = loot.parentElement as HTMLElement
      expect(text).toHaveClass('sheet-text', 'note-text', 'reading')
      expect(text).not.toHaveClass('lifted')
      expect(text.parentElement).toHaveClass('overflow-x-auto')
    })

    it('lifts its headings a level, marked so for their sizes', () => {
      render(<NoteText html='<h5>Loot</h5><h6>Coins</h6><p>30 gp</p>' lifted />)
      expect(screen.getByRole('heading', { name: 'Loot' }).localName).toBe('h4')
      expect(screen.getByRole('heading', { name: 'Coins' }).localName).toBe(
        'h5',
      )
      expect(screen.getByText('30 gp').parentElement).toHaveClass('lifted')
    })

    it('draws nothing for no text', () => {
      const { container } = render(<NoteText html='' />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('lift', () => {
    it('raises each h5 to an h4 and each h6 to an h5, keeping what’s in them, and leaves the body read alone', () => {
      const body = new DOMParser().parseFromString(
        '<h5 class="a">One <em>two</em></h5><h6>Three</h6><h4>Four</h4>',
        'text/html',
      ).body
      const lifted = lift(body)
      expect(lifted.innerHTML).toBe(
        '<h4 class="a">One <em>two</em></h4><h5>Three</h5><h4>Four</h4>',
      )
      expect(body.innerHTML).toBe(
        '<h5 class="a">One <em>two</em></h5><h6>Three</h6><h4>Four</h4>',
      )
    })
  })

  describe('the rights', () => {
    it('offers Edit only in a book that takes changes, on a note the seat may change here, with no choice waiting', () => {
      expect(mayEdit(noteEntry(), true)).toBe(true)
      expect(mayEdit(noteEntry(), false)).toBe(false)
      expect(mayEdit(noteEntry({ canEdit: false }), true)).toBe(false)
      expect(mayEdit(noteEntry({ foundryOnly: 'long' }), true)).toBe(false)
      expect(mayEdit(noteEntry({ state: 'conflict' }), true)).toBe(false)
      expect(mayEdit(noteEntry({ state: 'gone' }), true)).toBe(false)
      expect(mayEdit(noteEntry({ state: 'failed' }), true)).toBe(true)
    })

    it('offers Delete only where the seat may, the note not being deleted, with no choice waiting', () => {
      expect(mayDelete(noteEntry(), true)).toBe(true)
      expect(mayDelete(noteEntry(), false)).toBe(false)
      expect(mayDelete(noteEntry({ canDelete: false }), true)).toBe(false)
      expect(mayDelete(noteEntry({ foundryOnly: 'html' }), true)).toBe(true)
      for (const state of ['deleting', 'conflict', 'gone'] as const) {
        expect(mayDelete(noteEntry({ state }), true)).toBe(false)
      }
    })

    it('offers Rename only where the seat may, with no choice waiting', () => {
      expect(mayRename(noteChapter(), true)).toBe(true)
      expect(mayRename(noteChapter(), false)).toBe(false)
      expect(mayRename(noteChapter({ canRename: false }), true)).toBe(false)
      expect(mayRename(noteChapter({ state: 'conflict' }), true)).toBe(false)
      expect(mayRename(noteChapter({ state: 'gone' }), true)).toBe(false)
    })

    it.each([
      ['synced', true],
      ['waiting', true],
      ['saving', true],
      ['failed', false],
      ['deleting', false],
      ['conflict', false],
      ['gone', false],
    ] as [NoteState, boolean][])(
      'offers Move with Edit, a chapter to go to, and a note %s: %s',
      (state, offered) => {
        expect(mayMove(noteEntry({ state }), true, [noteChapter()])).toBe(
          offered,
        )
      },
    )

    it('offers no Move with no chapter to go to, nor where Edit isn’t', () => {
      expect(mayMove(noteEntry(), true, [])).toBe(false)
      expect(
        mayMove(noteEntry({ canEdit: false }), true, [noteChapter()]),
      ).toBe(false)
      expect(mayMove(noteEntry(), false, [noteChapter()])).toBe(false)
    })
  })
})
