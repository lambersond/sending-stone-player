import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteCard } from './note-card'
import { noteChapter, noteEntry } from '@/mocks/notes-server'

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

describe('components/notes/note-card', () => {
  const scrollHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollHeight',
  )
  const clientHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientHeight',
  )
  /** Every box this tall inside, and this tall as shown. */
  const measured = (inside: number, shown: number) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => inside,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => shown,
    })
  }

  /** The ResizeObserver a card makes: what it watches, and its call as that changes size. */
  const original = globalThis.ResizeObserver
  const watching = () => {
    const seen = {
      targets: [] as Element[],
      resized: () => {},
      disconnect: jest.fn(),
    }
    globalThis.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      seen.resized = () => callback([], {} as ResizeObserver)
      return {
        observe: (target: Element) => seen.targets.push(target),
        unobserve: jest.fn(),
        disconnect: seen.disconnect,
      } as unknown as ResizeObserver
    }) as unknown as typeof ResizeObserver
    return seen
  }

  afterEach(() => {
    globalThis.ResizeObserver = original
    if (scrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight)
    }
    if (clientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight)
    }
  })

  it('heads itself with the note’s title, an h4 whose button covers the card and opens the note', async () => {
    const user = userEvent.setup()
    const onOpen = jest.fn()
    render(<NoteCard entry={noteEntry()} onOpen={onOpen} />)
    const heading = screen.getByRole('heading', {
      level: 4,
      name: 'The goblin cave',
    })
    const button = within(heading).getByRole('button')
    expect(button).toHaveClass('after:absolute', 'after:inset-0')
    expect(button.closest('article')).toHaveClass('relative')
    await user.click(button)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('says who wrote it and who changed it last', () => {
    render(
      <NoteCard
        entry={noteEntry({
          author: { name: 'Vex' },
          createdAt: ago(0),
          modifiedAt: ago(0),
          modifiedBy: 'Gamemaster',
          modifiedIn: 'foundry',
        })}
        onOpen={jest.fn()}
      />,
    )
    expect(screen.getByText(/^Written by Vex/).closest('p')).toHaveTextContent(
      'Written by Vex, just now · Last changed by Gamemaster in Foundry, just now',
    )
  })

  it('marks where it stands, and nothing for a note in step', () => {
    const { rerender } = render(
      <NoteCard entry={noteEntry({ state: 'waiting' })} onOpen={jest.fn()} />,
    )
    expect(screen.getByTitle('Waiting for the game')).toBeInTheDocument()
    rerender(<NoteCard entry={noteEntry()} onOpen={jest.fn()} />)
    expect(screen.queryByTitle(/game/)).toBeNull()
  })

  it('offers Move to chapter where it may be moved, above the card’s button', async () => {
    const user = userEvent.setup()
    const onMove = jest.fn()
    render(
      <NoteCard
        entry={noteEntry()}
        move={{ chapters: [noteChapter()], busy: false, onMove }}
        onOpen={jest.fn()}
      />,
    )
    const move = screen.getByRole('button', { name: 'Move to chapter' })
    expect(move.parentElement).toHaveClass('relative', 'z-10')
    await user.click(move)
    await user.click(screen.getByRole('menuitemradio', { name: 'Session 1' }))
    expect(onMove).toHaveBeenCalledWith('sessionChapter01')
  })

  it('offers no Move where it may not be moved, nor Edit, Delete or choices', () => {
    render(
      <NoteCard
        entry={noteEntry({ state: 'failed', reason: 'full' })}
        onOpen={jest.fn()}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('draws its text at the reader’s size, its headings as the server drew them under its h4', () => {
    render(
      <NoteCard
        entry={noteEntry({ html: '<h5>Loot</h5><p>30 gp</p>' })}
        onOpen={jest.fn()}
      />,
    )
    const loot = screen.getByRole('heading', { name: 'Loot' })
    expect(loot.localName).toBe('h5')
    expect(loot.parentElement).toHaveClass('sheet-text', 'note-text', 'reading')
    expect(loot.parentElement).not.toHaveClass('lifted')
    expect(loot.closest('.max-h-52')).toHaveClass('overflow-hidden')
  })

  it('says Continue reading, with a fade, only where its text is cut short', () => {
    measured(400, 208)
    const { unmount } = render(
      <NoteCard entry={noteEntry()} onOpen={jest.fn()} />,
    )
    const more = screen.getByText('Continue reading')
    expect(more).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.bg-linear-to-t')).not.toBeNull()
    unmount()

    measured(210, 208)
    render(<NoteCard entry={noteEntry()} onOpen={jest.fn()} />)
    expect(screen.queryByText('Continue reading')).toBeNull()
    expect(document.querySelector('.bg-linear-to-t')).toBeNull()
  })

  it('says Continue reading once its text grows past the clip after it’s drawn, as an image in it loads, and not once it fits again', () => {
    const seen = watching()
    measured(59, 59)
    const { unmount } = render(
      <NoteCard
        entry={noteEntry({
          html: '<p>The map:</p><p><img src="https://foundry.example/map.webp" alt="The map"></p>',
        })}
        onOpen={jest.fn()}
      />,
    )
    expect(screen.queryByText('Continue reading')).toBeNull()
    // It watches its text, which grows, not the clip, whose height stops at the clip's.
    const box = document.querySelector('.max-h-52') as HTMLElement
    expect(seen.targets).toEqual([box.firstElementChild])

    // The image loads: the text reaches past the clip.
    measured(246, 208)
    act(() => seen.resized())
    expect(screen.getByText('Continue reading')).toBeInTheDocument()
    expect(document.querySelector('.bg-linear-to-t')).not.toBeNull()

    // The card drawn wider: it all fits again.
    measured(194, 194)
    act(() => seen.resized())
    expect(screen.queryByText('Continue reading')).toBeNull()
    expect(document.querySelector('.bg-linear-to-t')).toBeNull()

    unmount()
    expect(seen.disconnect).toHaveBeenCalled()
  })

  it('draws no text box for a note with no text', () => {
    render(<NoteCard entry={noteEntry({ html: '' })} onOpen={jest.fn()} />)
    expect(document.querySelector('.max-h-52')).toBeNull()
  })
})
