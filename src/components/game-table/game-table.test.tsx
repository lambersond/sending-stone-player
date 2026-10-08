/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Character } from '@/types/character'
import type { TableCombat, TableMessage, TableView } from '@/types/table'

jest.mock('@/hooks/use-table-view', () => ({ useTableView: jest.fn() }))
// The 3D dice need WebGL; the sheet rolls without them.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const sheet = toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com')

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}
const chooseActor = jest.fn().mockResolvedValue({})
const deleteCharacter = jest.fn(async () => {})
const markChatRead = jest.fn<Promise<void>, [string]>(async () => {})
const choice = {
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  characters: [
    { id: 'actor-thorin', name: 'Thorin Oakenshield' },
    { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' as const },
  ],
}

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
  live: true,
  campaign: { title: 'The Lonely Mountain', worldTitle: 'Return to Erebor' },
  connected: true,
  messages: [message('m1', '2026-10-04T19:00:00.000Z')],
  combat: combat(),
  ...fields,
})

let current: { view: TableView; connection: Connection }
const showing = (next: Partial<typeof current>) => {
  current = { ...current, ...next }
}

const table = (
  initial: TableView,
  who: Character = character,
  options: { choice?: typeof choice } = {},
) => (
  <GameTable
    character={who}
    initialView={initial}
    choice={options.choice}
    chooseActor={chooseActor}
    deleteCharacter={deleteCharacter}
    markChatRead={markChatRead}
  />
)

const renderTable = (
  initial = view(),
  who: Character = character,
  options: { choice?: typeof choice } = {},
) => {
  current = { view: initial, connection: 'live' }
  jest.mocked(useTableView).mockImplementation(() => current)
  return render(table(initial, who, options))
}

const subtitle = () => screen.getByRole('heading', { level: 1 }).nextSibling

/** The chat's scrolling area, 1000 pixels of messages in a 400-pixel window. */
const chatScroller = () => {
  const scroller = screen
    .getByRole('region', { name: 'Chat' })
    .querySelector('.overflow-y-auto') as HTMLElement
  Object.defineProperty(scroller, 'scrollHeight', {
    value: 1000,
    configurable: true,
  })
  Object.defineProperty(scroller, 'clientHeight', {
    value: 400,
    configurable: true,
  })
  return scroller
}

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

    expect(subtitle()).toHaveTextContent('The Lonely Mountain · 1 message')
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
    rerender(table(view()))

    expect(
      screen.getByRole('button', { name: 'Chat 2 unread' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Chat/ }))

    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(subtitle()).toHaveTextContent('3 messages')
  })

  describe('unread messages', () => {
    const messages = [
      message('m1', '2026-10-04T19:00:00.000Z'),
      message('m2', '2026-10-04T19:01:00.000Z'),
      message('m3', '2026-10-04T19:02:00.000Z'),
    ]

    it('counts from where the player last read, on any visit or device', () => {
      renderTable(view({ messages, chatReadAt: '2026-10-04T19:00:00.000Z' }))

      expect(
        screen.getByRole('button', { name: 'Chat 2 unread' }),
      ).toBeInTheDocument()
      expect(markChatRead).not.toHaveBeenCalled()
    })

    it("leaves out the player's own messages", () => {
      renderTable(
        view({
          messages: [
            ...messages,
            { ...message('m4', '2026-10-04T19:03:00.000Z'), side: 'me' },
          ],
          chatReadAt: '2026-10-04T19:01:00.000Z',
        }),
      )

      expect(
        screen.getByRole('button', { name: 'Chat 1 unread' }),
      ).toBeInTheDocument()
    })

    it('counts everything already there as read until the player first reads the chat', () => {
      renderTable(view({ messages }))

      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
      expect(markChatRead).toHaveBeenCalledWith('2026-10-04T19:02:00.000Z')
    })

    it('counts every message as unread that reaches a chat empty on a first visit', () => {
      const { rerender } = renderTable(view({ messages: [] }))
      expect(markChatRead).toHaveBeenCalledWith('1970-01-01T00:00:00.000Z')

      showing({ view: view({ messages: messages.slice(0, 1) }) })
      rerender(table(view()))

      expect(
        screen.getByRole('button', { name: 'Chat 1 unread' }),
      ).toBeInTheDocument()
    })

    it('notes how far the player has read while the chat is in view', async () => {
      const user = userEvent.setup()
      const { rerender } = renderTable(
        view({ messages, chatReadAt: '2026-10-04T19:00:00.000Z' }),
      )

      await user.click(screen.getByRole('button', { name: /^Chat/ }))
      expect(markChatRead).toHaveBeenLastCalledWith('2026-10-04T19:02:00.000Z')

      showing({
        view: view({
          messages: [...messages, message('m4', '2026-10-04T19:03:00.000Z')],
        }),
      })
      rerender(table(view()))
      expect(markChatRead).toHaveBeenLastCalledWith('2026-10-04T19:03:00.000Z')

      await user.click(screen.getByRole('button', { name: /^Combat/ }))
      await user.click(screen.getByRole('button', { name: /^Chat/ }))
      expect(markChatRead).toHaveBeenCalledTimes(2)
    })

    it('clears what the player read on another device', () => {
      const { rerender } = renderTable(
        view({ messages, chatReadAt: '2026-10-04T19:00:00.000Z' }),
      )
      expect(
        screen.getByRole('button', { name: 'Chat 2 unread' }),
      ).toBeInTheDocument()

      showing({
        view: view({ messages, chatReadAt: '2026-10-04T19:02:00.000Z' }),
      })
      rerender(table(view()))

      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    })

    it('shows more than 99 as 99+', () => {
      const many = Array.from({ length: 120 }, (_, index) =>
        message(
          `m${index}`,
          new Date(
            Date.parse('2026-10-04T19:00:00.000Z') + index * 1000,
          ).toISOString(),
        ),
      )
      renderTable(
        view({ messages: many, chatReadAt: '2026-10-04T18:00:00.000Z' }),
      )

      expect(
        screen.getByRole('button', { name: 'Chat 99+ unread' }),
      ).toBeInTheDocument()
    })

    it('still counts messages as read when saving how far fails', async () => {
      markChatRead.mockRejectedValueOnce(new Error('offline'))
      renderTable(view({ messages, combat: undefined }))

      await Promise.resolve()
      expect(screen.getByText('message m3')).toBeInTheDocument()
    })
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

  it('marks the character tab while the game asks the player for a save', async () => {
    const user = userEvent.setup()
    const prompts = [
      {
        id: 'msg2-thorin',
        type: 'concentration' as const,
        abilities: ['con'],
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    ]
    renderTable(view({ prompts }))

    // It opens on combat, an encounter being under way.
    expect(
      screen.getByRole('button', {
        name: 'Character , your Gamemaster asks for a roll',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Character/ }))
    expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it("marks nothing while the character isn't one of the campaign's", () => {
    renderTable(
      view({
        connected: false,
        prompts: [
          {
            id: 'msg2-thorin',
            type: 'concentration',
            abilities: ['con'],
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        ],
      }),
    )

    expect(
      screen.getByRole('button', { name: 'Character' }),
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

  it('names the campaign as the Gamemaster now titles it', () => {
    renderTable(
      view({ campaign: { title: 'The Desolation' }, combat: undefined }),
    )

    expect(subtitle()).toHaveTextContent('The Desolation · 1 message')
  })

  it('shows when the game is connected, and when it has gone quiet', () => {
    const { rerender } = renderTable()
    expect(screen.getByRole('status')).toHaveTextContent(/^Live/)

    showing({ view: view({ live: false }) })
    rerender(table(view()))

    expect(screen.getByRole('status')).toHaveTextContent(/^Offline/)
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      "Your Gamemaster's game hasn't been heard from in the last two minutes.",
    )
  })

  it("asks a character in a campaign which of the campaign's characters it is", async () => {
    const user = userEvent.setup()
    renderTable(
      view({ connected: false }),
      { ...character, actorId: null },
      {
        choice,
      },
    )

    expect(
      screen.getByRole('heading', {
        name: 'Choose your character in The Lonely Mountain',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/^Waiting/)
    expect(screen.queryByText(/is no longer one of/)).toBeNull()

    await user.click(screen.getByRole('radio', { name: 'Thorin Oakenshield' }))
    await user.click(screen.getByRole('button', { name: 'Choose character' }))
    expect(chooseActor).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'in no campaign',
      { campaignId: null, actorId: null },
      view({ campaign: undefined }),
    ],
    ['whose campaign is gone', { actorId: null }, view()],
  ])('sends a character %s to an invite link', (_, fields, initial) => {
    renderTable(initial, { ...character, ...fields })

    expect(
      screen.getByRole('heading', { name: "Thorin isn't in a campaign" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Your characters' }),
    ).toHaveAttribute('href', '/characters')
  })

  it('names the game by its address while there is no campaign', () => {
    renderTable(view({ campaign: undefined }), {
      ...character,
      campaignTitle: '',
      campaignId: null,
    })

    expect(subtitle()).toHaveTextContent(/^my-game.forge-vtt.com$/)
  })

  it("explains when the character is no longer one of the campaign's", () => {
    renderTable(view({ connected: false }))

    expect(
      screen.getByText(
        /Thorin is no longer one of The Lonely Mountain's characters/,
      ),
    ).toBeInTheDocument()
  })

  it('deletes the character from its page, after asking', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'Delete Thorin' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Thorin?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteCharacter).toHaveBeenCalledTimes(1)
  })

  it('says when it is reconnecting', () => {
    const { rerender } = renderTable()

    showing({ connection: 'reconnecting' })
    rerender(table(view()))

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting')
  })

  it('keeps the chat at the newest message unless the player scrolls up', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTable(view({ combat: undefined }))
    const scroller = chatScroller()

    const arrive = (id: string) => {
      showing({
        view: view({
          combat: undefined,
          messages: [message(id, `2026-10-04T19:0${id.length}:00.000Z`)],
        }),
      })
      rerender(table(view()))
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
    await user.click(screen.getByRole('button', { name: 'Chat' }))
    expect(scroller.scrollTop).toBe(1000)
  })

  it('puts combat and chat in panes of their own', () => {
    renderTable()

    expect(screen.getByRole('region', { name: 'Combat' })).toContainElement(
      screen.getByRole('heading', { name: 'Goblin Boss is acting' }),
    )
    expect(screen.getByRole('region', { name: 'Chat' })).toContainElement(
      screen.getByText('message m1'),
    )
  })

  describe('on a wide screen', () => {
    beforeEach(() => {
      jest.spyOn(globalThis, 'matchMedia').mockImplementation(
        query =>
          ({
            matches: query === '(min-width: 64rem)',
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      )
    })
    afterEach(() => jest.restoreAllMocks())

    it('shares the column beside the sheet between combat and the chat', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet }))

      expect(subtitle()?.nextSibling).toHaveTextContent(
        'The Lonely Mountain · my-game.forge-vtt.com',
      )
      const sheetPane = screen.getByRole('region', { name: 'Character' })
      expect(sheetPane).toHaveClass('lg:flex')
      expect(sheetPane).toHaveTextContent(
        /^CharacterActionsInventoryFeaturesEffectsBiographyFighter 5 · Champion/,
      )
      const column = screen.getByRole('region', { name: 'Combat' })
        .parentElement as HTMLElement
      expect(column).toHaveClass('lg:w-[clamp(320px,40%,500px)]')

      const combatTab = screen.getByRole('tab', { name: 'Combat' })
      expect(combatTab).toHaveAttribute('aria-selected', 'true')
      expect(combatTab.parentElement?.nextSibling).toHaveTextContent(
        'Round 3 · Goblin Boss’s turn',
      )
      expect(screen.getByRole('region', { name: 'Chat' })).toHaveClass('hidden')

      await user.click(screen.getByRole('tab', { name: 'Chat' }))
      expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(combatTab.parentElement?.nextSibling).toHaveTextContent(
        '1 message',
      )
      expect(screen.getByRole('region', { name: 'Combat' })).toHaveClass(
        'hidden',
      )
      expect(screen.getByRole('region', { name: 'Chat' })).not.toHaveClass(
        'hidden',
      )
    })

    it('counts messages unread while combat sits beside the sheet', async () => {
      const user = userEvent.setup()
      const { rerender } = renderTable(view({ sheet }))
      const scroller = chatScroller()

      showing({
        view: view({
          sheet,
          messages: [
            message('m1', '2026-10-04T19:00:00.000Z'),
            message('m2', '2026-10-04T19:01:00.000Z'),
          ],
        }),
      })
      rerender(table(view()))
      expect(
        screen.getByRole('tab', { name: 'Chat 1 unread' }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: /^Chat/ }))
      expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument()
      expect(scroller.scrollTop).toBe(1000)
    })

    it('keeps the chat beside the sheet in view, pinned to the newest message', () => {
      const { rerender } = renderTable(view({ sheet, combat: undefined }))
      const scroller = chatScroller()

      showing({
        view: view({
          sheet,
          combat: undefined,
          messages: [
            message('m1', '2026-10-04T19:00:00.000Z'),
            message('m2', '2026-10-04T19:01:00.000Z'),
          ],
        }),
      })
      rerender(table(view()))

      expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(scroller.scrollTop).toBe(1000)
    })

    it('flags combat beside the sheet when it is the player’s turn', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet, combat: combat({ currentId: 'me' }) }))
      expect(
        screen.queryByRole('tab', { name: 'Combat , your turn' }),
      ).toBeNull()

      await user.click(screen.getByRole('tab', { name: 'Chat' }))

      expect(
        screen.getByRole('tab', { name: 'Combat , your turn' }),
      ).toBeInTheDocument()
    })

    it('gives combat and the chat the whole width until a sheet arrives', () => {
      renderTable()

      expect(screen.getByRole('region', { name: 'Character' })).toHaveClass(
        'lg:hidden',
      )
      const column = screen.getByRole('region', { name: 'Combat' })
        .parentElement as HTMLElement
      expect(column).not.toHaveClass('lg:w-[clamp(320px,40%,500px)]')
    })
  })

  describe('the character tab', () => {
    it('opens on the sheet when there is no fight under way', () => {
      renderTable(view({ sheet, combat: undefined }))

      expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(subtitle()).toHaveTextContent('Fighter 5 · Champion')
      const pane = screen.getByRole('region', { name: 'Character' })
      expect(
        within(pane).getByRole('button', { name: 'Strength check, +4' }),
      ).toBeInTheDocument()
      expect(
        within(pane).getByRole('region', { name: 'Your rolls' }),
      ).toHaveTextContent('Tap an ability, skill or attack to roll it.')
    })

    it('opens on combat during a fight, and switches to the sheet', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet }))
      const sheetPane = screen.getByRole('region', { name: 'Character' })
      const column = screen.getByRole('region', { name: 'Combat' })
        .parentElement as HTMLElement

      expect(sheetPane).toHaveClass('hidden')
      expect(column).not.toHaveClass('hidden')
      await user.click(screen.getByRole('button', { name: 'Character' }))

      expect(sheetPane).not.toHaveClass('hidden')
      expect(column).toHaveClass('hidden')
    })

    it("explains a sheet that hasn't arrived", async () => {
      const user = userEvent.setup()
      renderTable(view({ combat: undefined }))

      expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await user.click(screen.getByRole('button', { name: 'Character' }))

      expect(subtitle()).toHaveTextContent('The Lonely Mountain')
      expect(
        screen.getByRole('heading', { name: "Thorin's sheet hasn't arrived" }),
      ).toBeInTheDocument()
    })
  })
})
