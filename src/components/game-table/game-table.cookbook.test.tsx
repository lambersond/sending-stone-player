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

// The player's Magical Recipe Book card at their table (module 0.38.0): on the sheet's Biography
// tab after the journal's card, or under why there's no sheet after the journal's there; at their
// own seat alone, while their character plays, given both of its actions.

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

/** The card's reads, at any character's route. */
const cardReads = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).includes('/cookbook'))

/** Does b come after a in the page? */
const follows = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('components/game-table, the Magical Recipe Book card (module 0.38.0)', () => {
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

  it('puts it on the sheet’s Biography tab, right after the journal’s card, for the playing player, with their actions', async () => {
    const user = userEvent.setup()
    const given = actions()
    renderTable(view(), { given })
    expect(
      screen.queryByRole('region', { name: 'Magical Recipe Book' }),
    ).toBeNull()
    expect(cardReads()).toEqual([])
    await user.click(screen.getByRole('tab', { name: 'Biography' }))

    const card = await screen.findByRole('region', {
      name: 'Magical Recipe Book',
    })
    const journal = screen.getByRole('region', { name: 'Journal' })
    expect(card.previousElementSibling).toBe(journal)
    expect(cardReads()[0][0]).toBe('/api/characters/char-1/cookbook')

    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    expect(given.makeCookbookCode).toHaveBeenCalledTimes(1)
  })

  it('puts it under why there’s no sheet, after the journal’s card, in a column of its own', async () => {
    renderTable(view(false))
    const card = await screen.findByRole('region', {
      name: 'Magical Recipe Book',
    })
    const journal = screen.getByRole('region', { name: 'Journal' })
    expect(follows(journal, card)).toBe(true)
    expect(card.parentElement).toHaveClass(
      'mx-auto',
      'w-full',
      'max-w-2xl',
      'px-4',
      'pb-8',
    )
    expect(card.parentElement?.previousElementSibling).toBe(
      journal.parentElement,
    )
  })

  it('never draws it at the Gamemaster’s seat, given the actions or not', async () => {
    const user = userEvent.setup()
    renderTable(view(), {
      seat: { role: 'gm', api: GM_API, key: 'gm:c1:thorin' },
    })
    await user.click(screen.getByRole('tab', { name: 'Biography' }))
    await screen.findByRole('region', { name: 'Journal' })
    expect(
      screen.queryByRole('region', { name: 'Magical Recipe Book' }),
    ).toBeNull()
    expect(cardReads()).toEqual([])
  })

  it.each([
    ['neither', {}],
    ['only making one', { makeCookbookCode: actions().makeCookbookCode }],
    ['only revoking one', { revokeCookbookCode: actions().revokeCookbookCode }],
  ])(
    'never draws it without both actions: %s',
    async (_name, given: Partial<ReturnType<typeof actions>>) => {
      renderTable(view(false), { given })
      await screen.findByRole('region', { name: 'Journal' })
      expect(
        screen.queryByRole('region', { name: 'Magical Recipe Book' }),
      ).toBeNull()
      expect(cardReads()).toEqual([])
    },
  )

  it('never draws it for a character not playing one of its campaign’s characters', async () => {
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
      screen.queryByRole('region', { name: 'Magical Recipe Book' }),
    ).toBeNull()
  })

  it('polls it only while in view, as the journal is: not behind combat on one pane', async () => {
    jest.useFakeTimers()
    try {
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      })
      renderTable(view(false))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
      })
      expect(cardReads()).toHaveLength(1)

      await user.click(
        within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
          'button',
          { name: 'Combat' },
        ),
      )
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000)
      })
      expect(cardReads()).toHaveLength(1)
    } finally {
      jest.useRealTimers()
    }
  })
})
