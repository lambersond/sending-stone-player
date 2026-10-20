import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import { characterSheet, movingPartyView } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
import type { PartyView, TableGroup } from '@/types/party'
import type { TableView } from '@/types/table'

// The party sheets a character's table opens (module 0.30.0): from a button in its header, in a
// side panel over the sheet, through the seat's own way in.

jest.mock('@/hooks/use-table-view', () => ({ useTableView: jest.fn() }))
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

const company: TableGroup = {
  id: 'company',
  name: 'The Company',
  primary: true,
}
const scouts: TableGroup = { id: 'scouts', name: 'Scouts', primary: false }

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}
const view = (groups?: TableGroup[]): TableView => ({
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  sheet: toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com'),
  sheetVersion: 'v1',
  ...(groups && { groups }),
})
const party: PartyView = {
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: company,
  sheet: {
    members: [{ id: 'thorin', name: 'Thorin Oakenshield', own: true }],
    inventory: {
      sections: [],
      containers: [],
      currency: [],
      // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
      encumbrance: null,
      // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
      attunement: null,
    },
    // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
    description: null,
  },
}

let current: { view: TableView; connection: Connection }
const renderTable = (
  initial: TableView,
  seat?: TableSeat,
  fields: Partial<Character> = {},
) => {
  current = { view: initial, connection: 'live' }
  jest.mocked(useTableView).mockImplementation(() => current)
  const who: Character = {
    ...character,
    ...(seat?.role === 'gm' && { id: 'gm:c1:thorin' }),
    ...fields,
  }
  const element = (
    <GameTable character={who} initialView={initial} seat={seat} />
  )
  const rendered = render(element)
  return {
    ...rendered,
    showing: (next: TableView) => {
      current = { ...current, view: next }
      rendered.rerender(
        <GameTable character={who} initialView={initial} seat={seat} />,
      )
    },
  }
}

const respond = (status: number, body?: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)

/** What was posted to be moved, and where. */
const posted = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

describe('components/game-table, party sheets', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() => respond(200, party)) as typeof fetch
    jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as any)
  })

  it('offers no party sheet without a group to open', () => {
    renderTable(view())

    expect(screen.queryByRole('button', { name: /^Part(y|ies)/ })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('puts the Party button right after whether the game is live', () => {
    renderTable(view([company]))

    const live = screen.getByText('Live').closest('[role=status]')
    expect(live?.nextElementSibling).toBe(
      screen.getByRole('button', { name: 'Party: The Company' }),
    )
  })

  it("opens a player's party sheet over their character's, through their character, and its page", async () => {
    const user = userEvent.setup()
    renderTable(view([company]))

    await user.click(screen.getByRole('button', { name: 'Party: The Company' }))

    const panel = screen.getByRole('dialog', { name: 'The Company' })
    expect(
      await within(panel).findByRole('heading', { name: 'Members · 1' }),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/party/company',
      expect.anything(),
    )
    expect(
      within(panel).getByRole('link', { name: 'Open as page: The Company' }),
    ).toHaveAttribute('href', '/characters/char-1/party/company')
    expect(
      within(panel).getByRole('link', { name: 'Thorin Oakenshield' }),
    ).toHaveAttribute('href', '/characters/char-1')
    // It's never part of the character's sheet.
    expect(
      screen.getByRole('region', { name: 'Character' }),
    ).not.toContainElement(panel)

    await user.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("opens the Gamemaster's through their campaign", async () => {
    const user = userEvent.setup()
    renderTable(view([company, scouts]), {
      role: 'gm',
      api: '/api/campaigns/c1/characters/thorin',
      key: 'gm:c1:thorin',
    })

    await user.click(screen.getByRole('button', { name: 'Parties' }))
    await user.click(screen.getByRole('menuitem', { name: 'Scouts' }))

    const panel = screen.getByRole('dialog', { name: 'Scouts' })
    expect(panel).toHaveTextContent(/^ScoutsParty/)
    await within(panel).findByRole('heading', { name: 'Members · 1' })
    expect(fetch).toHaveBeenCalledWith(
      '/api/campaigns/c1/party/scouts',
      expect.anything(),
    )
    expect(
      within(panel).getByRole('link', { name: 'Open as page: Scouts' }),
    ).toHaveAttribute('href', '/campaigns/c1/party/scouts')
    // The Gamemaster has no character of their own among its members.
    expect(
      within(panel).queryByRole('link', { name: 'Thorin Oakenshield' }),
    ).toBeNull()
  })

  it('stays open, saying so, once the group is no longer the player’s to see', async () => {
    const user = userEvent.setup()
    const { showing } = renderTable(view([company]))
    await user.click(screen.getByRole('button', { name: 'Party: The Company' }))
    await screen.findByRole('heading', { name: 'Members · 1' })

    // The table hears first that its access was taken away: the group leaves its list.
    showing(view())
    const panel = screen.getByRole('dialog', { name: 'The Company' })
    expect(screen.queryByRole('button', { name: /^Part(y|ies)/ })).toBeNull()

    // Then the party sheet's own poll is refused.
    jest.mocked(fetch).mockImplementation(() => respond(404))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3100))
    })
    expect(
      within(panel).getByRole('heading', {
        name: "This party sheet isn't available",
      }),
    ).toBeInTheDocument()
    expect(panel).toHaveTextContent(
      "It's no longer shared with your character in Foundry.",
    )
  }, 10_000)

  it('speaks to the Gamemaster as the Gamemaster, once the group has left their campaign', async () => {
    const user = userEvent.setup()
    jest.mocked(fetch).mockImplementation(() => respond(404))
    renderTable(view([company]), {
      role: 'gm',
      api: '/api/campaigns/c1/characters/thorin',
      key: 'gm:c1:thorin',
    })

    await user.click(screen.getByRole('button', { name: 'Party: The Company' }))

    const panel = screen.getByRole('dialog', { name: 'The Company' })
    expect(
      await within(panel).findByRole('heading', {
        name: "This party sheet isn't available",
      }),
    ).toBeInTheDocument()
    expect(panel).toHaveTextContent(
      "It's no longer in this campaign in Foundry.",
    )
    expect(panel).not.toHaveTextContent('your character')
  })
})

describe('components/game-table, taking from a party, from module 0.31.0', () => {
  const gmSeat: TableSeat = {
    role: 'gm',
    api: '/api/campaigns/c1/characters/thorin',
    key: 'gm:c1:thorin',
  }
  /** The Company's sheet, as a seat that may take from it is sent it. */
  const moving = movingPartyView({ group: company })

  beforeEach(() => {
    // Its polls are answered with the sheet, and a move posted is taken.
    globalThis.fetch = jest.fn(
      (url: string | URL | Request, init?: RequestInit) =>
        init?.method === 'POST' && String(url).endsWith('/rolls')
          ? respond(202, { id: 'req-move' })
          : respond(200, moving),
    ) as typeof fetch
    jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as any)
  })

  it.each([
    [
      'a player, into their character, through its own way in',
      undefined,
      '/api/characters/char-1/rolls',
      {},
    ],
    [
      'the Gamemaster, into the character whose page it is, through their seat at it',
      gmSeat,
      '/api/campaigns/c1/characters/thorin/rolls',
      { label: 'Take 1 Rope from The Company' },
    ],
  ])('lets %s take from its stash', async (_name, seat, rolls, labelled) => {
    const user = userEvent.setup()
    renderTable(view([company]), seat)

    await user.click(screen.getByRole('button', { name: 'Party: The Company' }))
    const panel = screen.getByRole('dialog', { name: 'The Company' })
    await user.click(
      await within(panel).findByRole('button', { name: 'Take Rope' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Take Rope' })
    expect(dialog).toHaveTextContent('From The Company')
    await user.click(within(dialog).getByRole('button', { name: 'Take' }))

    // Its dialog closes, and the party sheet stays open, saying where the move stands.
    expect(screen.queryByRole('dialog', { name: 'Take Rope' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'The Company' })).toBe(panel)
    expect(within(panel).getByRole('status')).toHaveTextContent(
      /^Sending to your (Gamemaster’s )?game…$/,
    )

    expect(posted()).toEqual([
      {
        url: rolls,
        body: {
          kind: 'transfer',
          transfer: {
            from: 'company',
            to: 'thorin',
            items: [{ id: 'rope00000001', quantity: 1 }],
          },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
          ...labelled,
        },
      },
    ])
  })

  it("lets no one take from it for a character not in the campaign's roster", async () => {
    const user = userEvent.setup()
    // eslint-disable-next-line unicorn/no-null -- a character with no actor has null
    renderTable(view([company]), undefined, { actorId: null })

    await user.click(screen.getByRole('button', { name: 'Party: The Company' }))
    const panel = screen.getByRole('dialog', { name: 'The Company' })
    await within(panel).findByRole('heading', { name: 'Members · 0' })
    expect(within(panel).getByText('Rope')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /^Take/ })).toBeNull()
  })
})
