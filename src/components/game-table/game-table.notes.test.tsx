/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { GameTable } from './game-table'
import { forgetNotes } from '@/hooks/use-notes'
import {
  POLL_INTERVAL,
  useTableView,
  type Connection,
} from '@/hooks/use-table-view'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import { characterSheet } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { CampaignChoice } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { PartyView, TableGroup } from '@/types/party'
import type { TableView } from '@/types/table'

// The character's own journal notes at its table (module 0.34.0): on the sheet's Biography tab,
// or under why there's no sheet, and polled only while in view.

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
const company: TableGroup = {
  id: 'company',
  name: 'The Company',
  primary: true,
}

/** Thorin's view: with his sheet, or without, as one not yet arrived or held back as too large. */
const view = (
  sheet: 'sheet' | 'none' | 'tooLarge' = 'sheet',
  groups?: TableGroup[],
): TableView => ({
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  ...(sheet === 'sheet' && {
    sheet: toTableSheet(characterSheet(), GAME),
    sheetVersion: 'v1',
  }),
  ...(sheet === 'tooLarge' && {
    sheetWithheld: {
      reason: 'tooLarge' as const,
      bytes: 5_000_000,
      limit: 4_000_000,
    },
  }),
  ...(groups && { groups }),
})

const party: PartyView = {
  version: 1,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: company,
  sheet: {
    members: [],
    inventory: {
      sections: [],
      containers: [],
      currency: [],
      encumbrance: null,
      attunement: null,
    },
    description: null,
  },
}

const respond = (status: number, body?: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)

let current: { view: TableView; connection: Connection }
const renderTable = (
  initial: TableView,
  {
    seat,
    who = character,
    choice,
  }: { seat?: TableSeat; who?: Character; choice?: CampaignChoice } = {},
) => {
  current = { view: initial, connection: 'live' }
  jest.mocked(useTableView).mockImplementation(() => current)
  const table = () => (
    <GameTable
      character={who}
      initialView={initial}
      seat={seat}
      choice={choice}
    />
  )
  const rendered = render(table())
  return {
    ...rendered,
    showing: (next: TableView) => {
      current = { ...current, view: next }
      rendered.rerender(table())
    },
  }
}

/** The book's reads, at its API. */
const reads = (api = API) =>
  jest
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) =>
        String(url).startsWith(`${api}/notes`) &&
        (!init?.method || init.method === 'GET'),
    )

const notesRegion = () => screen.getByRole('region', { name: 'Notes' })
/** Does b come after a in the page? */
const follows = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
/** Lets what's waiting on the timers and the fetches run, as far as the time given. */
const pass = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
/** The note being written, by its label. */
const noteField = () =>
  screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement
const pane = () => document.querySelector('#character-pane') as HTMLElement
const column = () => pane().nextElementSibling as HTMLElement

describe('components/game-table, notes', () => {
  let server: ReturnType<typeof serveNotes>

  beforeEach(() => {
    forgetNotes()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as any)
    server = serveNotes(
      { [API]: emptyBook(), [GM_API]: emptyBook() },
      async url =>
        url.includes('/party/') && !url.includes('/texts/')
          ? respond(200, party)
          : new Promise<Response>(() => {}),
    )
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it.each([
    ['the player', undefined, API, 'Only you and your Gamemaster see these.'],
    [
      'the Gamemaster',
      { role: 'gm' as const, api: GM_API, key: 'gm:c1:thorin' },
      GM_API,
      'Only Thorin’s player and you see these.',
    ],
  ])(
    'gives the sheet’s Biography tab the notes through the seat’s API, for %s',
    async (_, seat, api, words) => {
      const user = userEvent.setup()
      renderTable(view(), { seat })
      expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull()
      await user.click(screen.getByRole('tab', { name: 'Biography' }))

      expect(await within(notesRegion()).findByText(words)).toBeInTheDocument()
      expect(reads(api)[0][0]).toBe(`${api}/notes`)
    },
  )

  it.each([
    ['not yet arrived', 'none' as const, "Thorin's sheet hasn't arrived"],
    [
      'held back as too large',
      'tooLarge' as const,
      "Thorin's sheet is too large to send",
    ],
  ])(
    'shows the notes under why there’s no sheet, %s, after the party list',
    async (_, sheet, title) => {
      renderTable(view(sheet, [company]))
      const why = screen.getByRole('heading', { name: title })
      const parties = screen.getByRole('region', { name: 'Party' })
      const notes = notesRegion()
      expect(follows(why, parties)).toBe(true)
      expect(follows(parties, notes)).toBe(true)
      expect(notes.parentElement).toHaveClass('max-w-2xl', 'px-4', 'pb-8')
      expect(
        await within(notes).findByRole('button', { name: 'New note' }),
      ).toBeInTheDocument()
    },
  )

  it('shows the Character pane on a wide screen with neither a sheet nor parties, beside a narrow column', () => {
    renderTable(view('none'))
    expect(pane()).toHaveClass('lg:flex')
    expect(column()).toHaveClass(
      'lg:w-[clamp(320px,40%,500px)]',
      'lg:flex-none',
    )
  })

  it('shows no notes under why there’s no sheet for a character with no actor', () => {
    const choice: CampaignChoice = {
      id: 'c1',
      title: 'The Lonely Mountain',
      gameUrl: GAME,
      characters: [{ id: 'thorin', name: 'Thorin' }],
    }
    renderTable(view('none'), { who: { ...character, actorId: null }, choice })
    expect(
      screen.getByRole('heading', { name: "Thorin's sheet hasn't arrived" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull()
    expect(reads()).toEqual([])
  })

  it('keeps the table’s tabs as they were, and its one status the live state', () => {
    renderTable(view('none'))
    const nav = screen.getByRole('navigation', { name: 'Table' })
    expect(
      within(nav)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Character', 'Combat', 'Chat'])
    expect(
      screen.getByRole('tablist', { name: 'Combat or chat' }),
    ).toBeInTheDocument()
    expect(notesRegion()).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Live')
  })

  describe('while in view, and not', () => {
    let wideScreen = false

    beforeEach(() => {
      jest.useFakeTimers()
      wideScreen = false
      jest.spyOn(globalThis, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: query === '(min-width: 64rem)' && wideScreen,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      )
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.mocked(globalThis.matchMedia).mockRestore()
    })

    it('polls on the Character tab, and not behind combat or the chat on one pane', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderTable(view('none'))
      await pass(0)
      expect(reads()).toHaveLength(1)
      await pass(POLL_INTERVAL)
      expect(reads()).toHaveLength(2)

      await user.click(
        within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
          'button',
          { name: 'Combat' },
        ),
      )
      // Still mounted, hidden, behind combat.
      expect(document.querySelector('#character-pane')).toContainElement(
        notesRegion(),
      )
      jest.mocked(fetch).mockClear()
      await pass(POLL_INTERVAL * 4)
      expect(reads()).toEqual([])

      await user.click(
        within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
          'button',
          { name: 'Character' },
        ),
      )
      await pass(POLL_INTERVAL)
      expect(reads()).toHaveLength(1)
    })

    it('polls side by side, whatever the tab', async () => {
      wideScreen = true
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderTable(view('none'))
      await pass(0)
      await user.click(
        within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
          'button',
          { name: 'Chat' },
        ),
      )
      jest.mocked(fetch).mockClear()
      await pass(POLL_INTERVAL)
      expect(reads()).toHaveLength(1)
    })

    it('doesn’t poll while a party sheet is open over it', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      renderTable(view('none', [company]))
      await pass(0)
      await user.click(
        within(screen.getByRole('region', { name: 'Party' })).getByRole(
          'button',
          { name: 'The Company Primary party' },
        ),
      )
      expect(
        screen.getByRole('dialog', { name: 'The Company' }),
      ).toBeInTheDocument()
      jest.mocked(fetch).mockClear()
      await pass(POLL_INTERVAL * 4)
      expect(reads()).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Close' }))
      await pass(POLL_INTERVAL)
      expect(reads()).toHaveLength(1)
    })
  })

  it('keeps a note half written under why there’s no sheet as the sheet arrives, and as it’s held back again, the caret where it was', async () => {
    const user = userEvent.setup()
    const { showing } = renderTable(view('none'))
    await user.click(
      await within(notesRegion()).findByRole('button', { name: 'New note' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    const typed = noteField()
    await user.click(typed)
    await user.keyboard('Three of them.')
    act(() => typed.setSelectionRange(6, 8))

    showing(view())

    // The sheet opens on Biography, where the note is.
    expect(screen.getByRole('tab', { name: 'Biography' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const note = noteField()
    expect(note).not.toBe(typed)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Wolves')
    expect(note).toHaveValue('Three of them.')
    expect(note).toHaveFocus()
    expect([note.selectionStart, note.selectionEnd]).toEqual([6, 8])
    // Keys typed next go on its text, in place of what was chosen.
    await user.keyboard('!')
    expect(note).toHaveValue('Three ! them.')

    showing(view('tooLarge'))

    expect(
      screen.getByRole('heading', {
        name: "Thorin's sheet is too large to send",
      }),
    ).toBeInTheDocument()
    const again = noteField()
    expect(again).toHaveValue('Three ! them.')
    expect(again).toHaveFocus()
    expect(again.selectionStart).toBe(7)
    expect(server.sent).toEqual([])
  })

  it('saves a note under why there’s no sheet', async () => {
    const user = userEvent.setup()
    renderTable(view('tooLarge'))
    await user.click(
      await within(notesRegion()).findByRole('button', { name: 'New note' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(within(notesRegion()).getByText('Saved.')).toBeInTheDocument(),
    )
    expect(server.sent).toEqual([
      {
        url: `${API}/notes`,
        method: 'POST',
        body: { role: 'entry', title: 'Wolves', body: '', chapterId: null },
      },
    ])
  })
})
