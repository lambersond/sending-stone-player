/* eslint-disable unicorn/no-null -- the view uses null for an absent value */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useCookbookEntry } from './cookbook-entry'
import { COOKBOOK_POLL_EVERY } from '@/constants/cookbook'
import { forgetCookbook } from '@/hooks/use-cookbook-view'
import type { CookbookPlace, CookbookView } from '@/types/cookbook'

const API = '/api/characters/char-1/cookbook'

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

/* The book's route, as the app answers it: the view it holds now, 204 while unchanged. */
let shown: CookbookView
let version = 0
const show = (fields: Partial<Omit<CookbookView, 'version'>> = {}) => {
  version += 1
  shown = {
    version: `v${version}`,
    enabled: true,
    live: true,
    link: null,
    dishes: [],
    ...fields,
  }
}
const reads = () =>
  jest.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith(API))

const PLACE: CookbookPlace = {
  characterId: 'char-1',
  make: async () => ({ code: 'sscb_x' }),
  revoke: async () => {},
}

/**
 * Where the book is offered, as the sheet's cog offers it: the cog, told as it opens and closes,
 * and Configure Magical Cookbook while the entry says to show it.
 */
function Cog({ place = PLACE }: Readonly<{ place?: CookbookPlace | null }>) {
  const entry = useCookbookEntry(place ?? undefined)
  return (
    <>
      <button type='button' onClick={() => entry.onCogOpenChange(true)}>
        Open the cog
      </button>
      <button type='button' onClick={() => entry.onCogOpenChange(false)}>
        Close the cog
      </button>
      {entry.shown && (
        <button type='button' onClick={entry.open}>
          Configure Magical Cookbook
        </button>
      )}
      {entry.modal}
    </>
  )
}

/** Every step of what's begun settled. */
const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0)
  })

describe('components/cookbook-card/cookbook-entry, the cog’s Configure Magical Cookbook (round 0.39.0)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    show()
    globalThis.fetch = jest.fn(async (url: string) => {
      const asked = new URL(url, 'https://app.test').searchParams.get('version')
      return asked === shown.version ? respond(204) : respond(200, shown)
    }) as typeof fetch
  })

  afterEach(() => {
    act(() => forgetCookbook())
    jest.useRealTimers()
  })

  it('reads the book once as it mounts, the modal closed, offering it once a read says the game takes dishes', async () => {
    render(<Cog />)
    await settle()
    expect(reads()).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeInTheDocument()
    // Not polled while the modal is closed.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(COOKBOOK_POLL_EVERY * 3)
    })
    expect(reads()).toHaveLength(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers it to a character with a link while the game takes no dishes, and none with neither', async () => {
    show({ enabled: false })
    const { unmount } = render(<Cog />)
    await settle()
    expect(
      screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeNull()
    unmount()
    act(() => forgetCookbook())

    show({
      enabled: false,
      link: {
        hint: 'U2d4',
        createdAt: '2026-10-24T18:00:00.000Z',
        lastUsedAt: null,
      },
    })
    render(<Cog />)
    await settle()
    expect(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeInTheDocument()
  })

  it('reads it again each time the cog opens, so dishes turned on mid-session show it then', async () => {
    show({ enabled: false })
    render(<Cog />)
    await settle()
    expect(reads()).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeNull()

    show({ enabled: true })
    // Closing the cog reads nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Close the cog' }))
    await settle()
    expect(reads()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open the cog' }))
    await settle()
    expect(reads()).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeInTheDocument()
  })

  it('polls it only while its modal is open', async () => {
    render(<Cog />)
    await settle()
    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Magical Recipe Book' }),
    ).toBeInTheDocument()
    await settle()
    const opened = reads().length
    await act(async () => {
      await jest.advanceTimersByTimeAsync(COOKBOOK_POLL_EVERY)
    })
    expect(reads()).toHaveLength(opened + 1)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(COOKBOOK_POLL_EVERY * 3)
    })
    expect(reads()).toHaveLength(opened + 1)
  })

  it('keeps its modal open whatever a read says meanwhile, as once the game stops taking dishes', async () => {
    render(<Cog />)
    await settle()
    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    )
    show({ enabled: false })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(COOKBOOK_POLL_EVERY)
    })
    // No longer offered in the cog, but the modal stays, saying why.
    expect(
      screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeNull()
    const book = screen.getByRole('dialog', { name: 'Magical Recipe Book' })
    expect(book).toHaveTextContent(
      'Your Gamemaster’s game isn’t taking dishes right now.',
    )
  })

  it('reads nothing and offers nothing where there is no place for it, as at the Gamemaster’s page', async () => {
    function Nowhere() {
      const entry = useCookbookEntry()
      return (
        <>
          <button type='button' onClick={() => entry.onCogOpenChange(true)}>
            Open the cog
          </button>
          {entry.shown && <p>Offered</p>}
          {entry.modal}
        </>
      )
    }
    render(<Nowhere />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the cog' }))
    await settle()
    expect(reads()).toEqual([])
    expect(screen.queryByText('Offered')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes for good once it has no place, as the no-sheet view once the sheet comes', async () => {
    const { rerender } = render(<Cog />)
    await settle()
    fireEvent.click(
      screen.getByRole('button', { name: 'Configure Magical Cookbook' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Magical Recipe Book' }),
    ).toBeInTheDocument()
    rerender(<Cog place={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    // Back, it doesn't open again by itself.
    rerender(<Cog />)
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Magical Recipe Book' }),
      ).toBeNull(),
    )
  })
})
