/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import type { TableCombat, TableMessage, TableView } from '@/types/table'

jest.mock('@/hooks/use-table-view', () => ({ useTableView: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
}
const listenerUrl = 'https://stone.example/api/sending-stone'

const message = (id: string, sentAt: string): TableMessage => ({
  id,
  sentAt,
  speaker: 'Gamemaster',
  side: 'other',
  whisper: false,
  kind: 'text',
  text: `message ${id}`,
  rolls: [],
  targets: [],
})

const combat = (fields: Partial<TableCombat> = {}): TableCombat => ({
  id: 'cmbt1',
  name: null,
  started: true,
  round: 3,
  currentId: 'boss',
  combatants: [
    {
      id: 'boss',
      name: 'Goblin Boss',
      initiative: 19,
      defeated: false,
      side: 'other',
    },
    { id: 'me', name: 'Thorin', initiative: 17, defeated: false, side: 'me' },
  ],
  ...fields,
})

const view = (fields: Partial<TableView> = {}): TableView => ({
  version: 3,
  game: { worldTitle: 'Return to Erebor' },
  connected: true,
  messages: [message('m1', '2026-10-04T19:00:00.000Z')],
  combat: combat(),
  ...fields,
})

let current: { view: TableView; connection: Connection }
const showing = (next: Partial<typeof current>) => {
  current = { ...current, ...next }
}

const renderTable = (initial = view()) => {
  current = { view: initial, connection: 'live' }
  jest.mocked(useTableView).mockImplementation(() => current)
  return render(
    <GameTable
      character={character}
      initialView={initial}
      listenerUrl={listenerUrl}
    />,
  )
}

const subtitle = () => screen.getByRole('heading', { level: 1 }).nextSibling

describe('components/game-table/game-table', () => {
  it('opens on combat while an encounter is under way', () => {
    renderTable()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Thorin',
    )
    expect(subtitle()).toHaveTextContent('Round 3 · Goblin Boss’s turn')
    expect(screen.getByRole('button', { name: 'Combat' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Live')
    expect(useTableView).toHaveBeenCalledWith('char-1', expect.anything())
  })

  it('opens on chat otherwise, and switches tabs', async () => {
    const user = userEvent.setup()
    renderTable(view({ combat: undefined }))

    expect(subtitle()).toHaveTextContent('Return to Erebor · 1 message')
    expect(screen.getByText('message m1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Combat' }))

    expect(subtitle()).toHaveTextContent('No combat')
    expect(
      screen.getByRole('heading', { name: 'No combat right now' }),
    ).toBeInTheDocument()
  })

  it('counts messages that arrive while on combat as unread', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTable()

    showing({
      view: view({
        messages: [
          message('m1', '2026-10-04T19:00:00.000Z'),
          message('m2', '2026-10-04T19:01:00.000Z'),
          message('m3', '2026-10-04T19:02:00.000Z'),
        ],
      }),
    })
    rerender(
      <GameTable
        character={character}
        initialView={view()}
        listenerUrl={listenerUrl}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Chat 2 unread' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Chat/ }))

    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(subtitle()).toHaveTextContent('3 messages')
  })

  it("flags the player's turn on the combat tab while they read chat", async () => {
    const user = userEvent.setup()
    renderTable(view({ combat: combat({ currentId: 'me' }) }))

    expect(subtitle()).toHaveTextContent('Round 3 · Your turn')
    await user.click(screen.getByRole('button', { name: 'Chat' }))

    expect(
      screen.getByRole('button', { name: 'Combat , your turn' }),
    ).toBeInTheDocument()
  })

  it.each([
    [combat({ started: false, currentId: undefined }), 'Getting ready'],
    [combat({ currentId: undefined }), 'Round 3'],
  ])('describes the encounter', async (encounter, text) => {
    const user = userEvent.setup()
    renderTable(view({ combat: encounter }))
    await user.click(screen.getByRole('button', { name: 'Combat' }))

    expect(subtitle()).toHaveTextContent(new RegExp(`^${text}$`))
  })

  it('names the game by its address when the world has no title yet', async () => {
    const user = userEvent.setup()
    renderTable(view({ game: {}, combat: undefined }))

    await user.click(screen.getByRole('button', { name: 'Chat' }))

    expect(subtitle()).toHaveTextContent('my-game.forge-vtt.com · 1 message')
  })

  it('waits for the table, showing the Gamemaster what to do', () => {
    renderTable({ version: 0, connected: false, messages: [] })

    expect(
      screen.getByRole('heading', { name: 'Waiting for the table' }),
    ).toBeInTheDocument()
    expect(screen.getByText(listenerUrl)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Waiting')
    expect(subtitle()).toHaveTextContent('my-game.forge-vtt.com')
  })

  it("explains when the character isn't connected in the game", () => {
    renderTable(view({ connected: false }))

    expect(
      screen.getByText(/Thorin is not one of this game's connected characters/),
    ).toBeInTheDocument()
  })

  it('says when it is reconnecting', () => {
    const { rerender } = renderTable()

    showing({ connection: 'reconnecting' })
    rerender(
      <GameTable
        character={character}
        initialView={view()}
        listenerUrl={listenerUrl}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting')
  })

  it('keeps the chat at the newest message unless the player scrolls up', async () => {
    const user = userEvent.setup()
    const { container, rerender } = renderTable(view({ combat: undefined }))
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    Object.defineProperty(scroller, 'scrollHeight', {
      value: 1000,
      configurable: true,
    })
    Object.defineProperty(scroller, 'clientHeight', {
      value: 400,
      configurable: true,
    })

    const arrive = (id: string) => {
      showing({
        view: view({
          combat: undefined,
          messages: [message(id, `2026-10-04T19:0${id.length}:00.000Z`)],
        }),
      })
      rerender(
        <GameTable
          character={character}
          initialView={view()}
          listenerUrl={listenerUrl}
        />,
      )
    }

    arrive('m2')
    expect(scroller.scrollTop).toBe(1000)

    scroller.scrollTop = 100
    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })
    arrive('m33')
    expect(scroller.scrollTop).toBe(100)

    await user.click(screen.getByRole('button', { name: 'Combat' }))
    expect(scroller.scrollTop).toBe(0)
  })
})
