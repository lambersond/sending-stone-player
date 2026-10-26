/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { GameTable } from './game-table'
import { forgetCookbook } from '@/hooks/use-cookbook-view'
import { forgetNotes } from '@/hooks/use-notes'
import { useTableView } from '@/hooks/use-table-view'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import { characterSheet } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { CampaignChoice } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { CookbookView } from '@/types/cookbook'
import type { TableView } from '@/types/table'

// The player's Magical Recipe Book at their table (module 0.38.0): since round 0.39.0 offered in
// the sheet's cog, Configure Magical Cookbook, or, with no sheet yet, by a button under why there's
// none, after the journal's card; at their own seat alone, while their character plays, given both
// of its actions. Changed on purpose (round 0.39.0 §2.10) from the card on the Biography tab.

jest.mock('@/hooks/use-table-view', () => ({
  ...jest.requireActual('@/hooks/use-table-view'),
  useTableView: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: jest.fn(),
}))
// The 3D dice need WebGL; the sheet rolls without them.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const API = '/api/characters/char-1'
const GM_API = '/api/campaigns/c1/characters/thorin'
const GAME = 'https://my-game.forge-vtt.com'

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}

/** Thorin's view, with his sheet or without. */
const view = (sheet = true): TableView => ({
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  ...(sheet && {
    sheet: toTableSheet(characterSheet(), GAME),
    sheetVersion: 'v1',
  }),
})

/** The card, as the app answers it: dishes on, Thorin not linked. */
const CARD: CookbookView = {
  version: 'abcdef012345',
  enabled: true,
  live: true,
  link: null,
  dishes: [],
}

const respond = (status: number, body?: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)

const actions = () => ({
  makeCookbookCode: jest.fn(async () => ({ code: 'sscb_x' })),
  revokeCookbookCode: jest.fn(async () => {}),
})

const renderTable = (
  shown: TableView,
  {
    seat,
    who = character,
    choice,
    given = actions(),
  }: {
    seat?: TableSeat
    who?: Character
    choice?: CampaignChoice
    given?: Partial<ReturnType<typeof actions>>
  } = {},
) => {
  jest.mocked(useTableView).mockReturnValue({ view: shown, connection: 'live' })
  return render(
    <GameTable
      character={who}
      initialView={shown}
      seat={seat}
      choice={choice}
      {...given}
    />,
  )
}

/** The card's route answering with the book as the test holds it at each read, in place of CARD. */
const serveBook = (book: () => CookbookView) =>
  serveNotes({ [API]: emptyBook(), [GM_API]: emptyBook() }, async url =>
    url === `${API}/cookbook` || url.startsWith(`${API}/cookbook?`)
      ? respond(200, book())
      : new Promise<Response>(() => {}),
  )

/** The card's reads, at any character's route. */
const cardReads = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes('/cookbook'))

/** Does b come after a in the page? */
const follows = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/** Opens the sheet's cog, its settings, as shown. */
const openCog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  return screen.getByRole('dialog', { name: 'Settings' })
}

describe('components/game-table, the Magical Recipe Book (module 0.38.0), from the cog since round 0.39.0', () => {
  beforeEach(() => {
    forgetNotes()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as any)
    serveNotes({ [API]: emptyBook(), [GM_API]: emptyBook() }, async url =>
      url === `${API}/cookbook` || url.startsWith(`${API}/cookbook?`)
        ? respond(200, CARD)
        : new Promise<Response>(() => {}),
    )
  })

  afterEach(() => {
    act(() => {
      forgetNotes()
      forgetCookbook()
    })
  })

  it('offers it in the self pane’s cog for the playing player, read as the pane mounts, opening it with their actions; never on the Biography tab', async () => {
    const user = userEvent.setup()
    const given = actions()
    renderTable(view(), { given })
    await waitFor(() => expect(cardReads()).toHaveLength(1))
    expect(cardReads()[0][0]).toBe('/api/characters/char-1/cookbook')
    await user.click(screen.getByRole('tab', { name: 'Biography' }))
    await screen.findByRole('region', { name: 'Journal' })
    expect(
      screen.queryByRole('region', { name: 'Magical Recipe Book' }),
    ).toBeNull()

    const settings = await openCog(user)
    await user.click(
      await within(settings).findByRole('button', {
        name: 'Configure Magical Cookbook',
      }),
    )
    const book = await screen.findByRole('dialog', {
      name: 'Magical Recipe Book',
    })
    await user.click(
      await within(book).findByRole('button', { name: 'Make a link code' }),
    )
    expect(given.makeCookbookCode).toHaveBeenCalledTimes(1)
  })

  it('offers it under why there’s no sheet, after the journal’s card, in a column of its own, opening the same modal', async () => {
    const user = userEvent.setup()
    renderTable(view(false))
    const button = await screen.findByRole('button', {
      name: 'Configure Magical Cookbook',
    })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveClass('min-h-11')
    const journal = screen.getByRole('region', { name: 'Journal' })
    expect(follows(journal, button)).toBe(true)
    expect(button.parentElement).toHaveClass(
      'mx-auto',
      'w-full',
      'max-w-2xl',
      'px-4',
      'pb-8',
    )
    expect(button.parentElement?.previousElementSibling).toBe(
      journal.parentElement,
    )
    await user.click(button)
    const book = await screen.findByRole('dialog', {
      name: 'Magical Recipe Book',
    })
    expect(
      await within(book).findByRole('button', { name: 'Make a link code' }),
    ).toBeInTheDocument()
  })

  it('offers no button under why there’s no sheet while the game takes no dishes and the character has no link', async () => {
    serveBook(() => ({ ...CARD, enabled: false }))
    renderTable(view(false))
    await screen.findByRole('region', { name: 'Journal' })
    await waitFor(() => expect(cardReads()).toHaveLength(1))
    // Its answer read, and drawn.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(
      screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeNull()
  })

  it('keeps the modal the no-sheet button opens open after a revoke while the game takes no dishes, on its off line with no Make button', async () => {
    const user = userEvent.setup()
    // Linked while the game takes no dishes: offered, for the link.
    let book: CookbookView = {
      ...CARD,
      enabled: false,
      link: {
        hint: 'U2d4',
        createdAt: '2026-10-24T18:00:00.000Z',
        lastUsedAt: null,
      },
    }
    serveBook(() => book)
    const given = {
      ...actions(),
      revokeCookbookCode: jest.fn(async () => {
        book = { ...book, version: 'bcdef0123456', link: null }
      }),
    }
    renderTable(view(false), { given })
    await user.click(
      await screen.findByRole('button', { name: 'Configure Magical Cookbook' }),
    )
    const modal = await screen.findByRole('dialog', {
      name: 'Magical Recipe Book',
    })
    await user.click(
      await within(modal).findByRole('button', { name: 'Revoke' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Revoke this link code?' }),
      ).getByRole('button', { name: 'Revoke' }),
    )
    expect(given.revokeCookbookCode).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(modal).not.toHaveTextContent('Linked with'))
    expect(screen.getByRole('dialog', { name: 'Magical Recipe Book' })).toBe(
      modal,
    )
    expect(modal).toHaveTextContent(
      'Your Gamemaster’s game isn’t taking dishes right now.',
    )
    expect(
      within(modal).queryByRole('button', { name: 'Make a link code' }),
    ).toBeNull()
  })

  it('never offers it at the Gamemaster’s seat, given the actions or not, reading nothing', async () => {
    const user = userEvent.setup()
    renderTable(view(), {
      seat: { role: 'gm', api: GM_API, key: 'gm:c1:thorin' },
    })
    await user.click(screen.getByRole('tab', { name: 'Biography' }))
    await screen.findByRole('region', { name: 'Journal' })
    const settings = await openCog(user)
    expect(
      within(settings).queryByRole('button', {
        name: 'Configure Magical Cookbook',
      }),
    ).toBeNull()
    expect(cardReads()).toEqual([])
  })

  it.each([
    ['neither', {}],
    ['only making one', { makeCookbookCode: actions().makeCookbookCode }],
    ['only revoking one', { revokeCookbookCode: actions().revokeCookbookCode }],
  ])(
    'never offers it without both actions: %s',
    async (_name, given: Partial<ReturnType<typeof actions>>) => {
      renderTable(view(false), { given })
      await screen.findByRole('region', { name: 'Journal' })
      expect(
        screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
      ).toBeNull()
      expect(cardReads()).toEqual([])
    },
  )

  it('never offers it for a character not playing one of its campaign’s characters', async () => {
    const choice: CampaignChoice = {
      id: 'c1',
      title: 'The Lonely Mountain',
      gameUrl: GAME,
      characters: [{ id: 'thorin', name: 'Thorin' }],
    }
    renderTable(view(false), {
      who: { ...character, actorId: null },
      choice,
    })
    expect(
      screen.getByRole('heading', { name: "Thorin's sheet hasn't arrived" }),
    ).toBeInTheDocument()
    await waitFor(() => expect(cardReads()).toEqual([]))
    expect(
      screen.queryByRole('button', { name: 'Configure Magical Cookbook' }),
    ).toBeNull()
  })

  it('reads it once as the pane mounts and again as the cog opens, polling it only while its modal is open', async () => {
    jest.useFakeTimers()
    try {
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      })
      renderTable(view())
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
      })
      expect(cardReads()).toHaveLength(1)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000)
      })
      expect(cardReads()).toHaveLength(1)

      const settings = await openCog(user)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
      })
      expect(cardReads()).toHaveLength(2)

      await user.click(
        within(settings).getByRole('button', {
          name: 'Configure Magical Cookbook',
        }),
      )
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000)
      })
      const open = cardReads().length
      expect(open).toBeGreaterThan(2)

      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Magical Recipe Book' }),
        ).getByRole('button', { name: 'Close' }),
      )
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000)
      })
      expect(cardReads()).toHaveLength(open)
    } finally {
      jest.useRealTimers()
    }
  })
})
