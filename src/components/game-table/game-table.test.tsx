/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import { characterSheet } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
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

/** The character's name, at the top of the page. */
const nameOf = () => screen.getByRole('heading', { level: 1 })
/** The line under the character's name. */
const subtitle = () => nameOf().parentElement?.nextSibling
/** What follows the character's name on its line: the class line, on a wide screen. */
const besideName = () => nameOf().nextSibling
/** What a sheet held back as too large says beneath its heading. */
const explanation = () =>
  screen.getByRole('heading', { name: /sheet is too large to send$/ })
    .nextSibling

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
  it('opens on the character while an encounter is under way, marking the player’s turn on Combat', () => {
    renderTable(view({ combat: combat({ currentId: 'me' }) }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Thorin',
    )
    expect(subtitle()).toHaveTextContent(/^The Lonely Mountain$/)
    expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('button', { name: 'Combat , your turn' }),
    ).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('status')).toHaveTextContent('Live')
    expect(useTableView).toHaveBeenCalledWith(
      '/api/characters/char-1',
      expect.anything(),
    )
  })

  it('opens on the character otherwise, and switches tabs', async () => {
    const user = userEvent.setup()
    renderTable(view({ combat: undefined }))

    expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('button', { name: 'Chat' }))

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
    await user.click(screen.getByRole('button', { name: 'Combat' }))

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
      const user = userEvent.setup()
      markChatRead.mockRejectedValueOnce(new Error('offline'))
      renderTable(view({ messages, combat: undefined }))
      await user.click(screen.getByRole('button', { name: 'Chat' }))

      await Promise.resolve()
      expect(screen.getByText('message m3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    })
  })

  it("flags the player's turn on the combat tab while they read chat", async () => {
    const user = userEvent.setup()
    renderTable(view({ combat: combat({ currentId: 'me' }) }))

    await user.click(screen.getByRole('button', { name: /^Combat/ }))
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
    // The character's own tab, shown, has no mark.
    expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('button', { name: 'Combat' }))
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

  it("marks nothing while the character isn't one of the campaign's", async () => {
    const user = userEvent.setup()
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
    await user.click(screen.getByRole('button', { name: 'Combat' }))

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

  it('names the campaign as the Gamemaster now titles it', async () => {
    const user = userEvent.setup()
    renderTable(
      view({ campaign: { title: 'The Desolation' }, combat: undefined }),
    )
    expect(subtitle()).toHaveTextContent(/^The Desolation$/)

    await user.click(screen.getByRole('button', { name: 'Chat' }))
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
    await user.click(screen.getByRole('button', { name: 'Chat' }))

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

  it('fills the viewport, a character’s page having no app bar', () => {
    const { container } = renderTable()

    expect(container.firstElementChild).toHaveClass('h-dvh')
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
        /^CharacterActionsInventoryFeaturesEffectsBiography/,
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

    it("names the class and subclass after the character's name, cut short before it is", () => {
      renderTable(view({ sheet }))

      expect(nameOf()).toHaveTextContent(/^Thorin$/)
      expect(nameOf()).toHaveClass('shrink-0', 'max-w-full', 'truncate')
      // Their line keeps what's cut short within it, rather than under the header's buttons.
      expect(nameOf().parentElement).toHaveClass(
        'flex',
        'items-baseline',
        'overflow-hidden',
      )
      expect(besideName()).toHaveTextContent(/^Fighter 5 · Champion$/)
      expect(besideName()).toHaveClass(
        'hidden',
        'lg:block',
        'min-w-0',
        'truncate',
        'text-text-secondary',
      )
      // The line under the name is the phone's, and the campaign and game stay under it here.
      expect(subtitle()).toHaveClass('lg:hidden')
      expect(subtitle()?.nextSibling).toHaveTextContent(
        /^The Lonely Mountain · my-game.forge-vtt.com$/,
      )
      // And it's no longer beside the sheet's tabs.
      expect(
        screen.getByRole('tablist', { name: 'Character sheet' }).parentElement,
      ).not.toHaveTextContent('Fighter 5 · Champion')
    })

    it('shows nothing after the name until the sheet arrives', () => {
      renderTable()

      expect(nameOf()).toHaveTextContent(/^Thorin$/)
      expect(besideName()).toBeNull()
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

  describe('as the screen narrows and widens', () => {
    let wideScreen = true
    const listeners = new Set<() => void>()
    /** The window resized, wide enough for the sheet beside combat or the chat, or not. */
    const resize = (wide: boolean) =>
      act(() => {
        wideScreen = wide
        for (const listener of listeners) listener()
      })

    beforeEach(() => {
      wideScreen = true
      listeners.clear()
      jest.spyOn(globalThis, 'matchMedia').mockImplementation(
        query =>
          ({
            get matches() {
              return query === '(min-width: 64rem)' && wideScreen
            },
            addEventListener: (_: string, listener: () => void) =>
              listeners.add(listener),
            removeEventListener: (_: string, listener: () => void) =>
              listeners.delete(listener),
          }) as unknown as MediaQueryList,
      )
    })
    afterEach(() => jest.restoreAllMocks())

    it('shows the character when it narrows to one pane, and keeps the tab chosen as it widens', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet }))
      const character = () => screen.getByRole('button', { name: 'Character' })

      // Choosing the chat beside the sheet chooses its tab too.
      await user.click(screen.getByRole('tab', { name: 'Chat' }))
      expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute(
        'aria-current',
        'page',
      )

      resize(false)
      expect(character()).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('region', { name: 'Character' })).toHaveClass(
        'flex',
      )
      // The chat stays the one beside the sheet, for when it widens again.
      expect(screen.getByRole('region', { name: 'Chat' })).not.toHaveClass(
        'hidden',
      )

      await user.click(screen.getByRole('button', { name: 'Combat' }))
      resize(true)
      expect(screen.getByRole('button', { name: 'Combat' })).toHaveAttribute(
        'aria-current',
        'page',
      )

      resize(false)
      expect(character()).toHaveAttribute('aria-current', 'page')
    })

    it('keeps the part of the sheet shown as it narrows', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet, combat: undefined }))
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(screen.getByRole('tab', { name: 'Chat' }))

      resize(false)

      expect(screen.getByRole('tab', { name: 'Actions' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })
  })

  describe('the character tab', () => {
    afterEach(() => localStorage.removeItem(TOASTS_KEY))

    it('opens on the sheet when there is no fight under way', () => {
      // With the rolls in the banner, as the player may have them.
      localStorage.setItem(TOASTS_KEY, 'off')
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

    it('opens on the sheet with the rolls a button away, where they pop up as toasts', () => {
      renderTable(view({ sheet, combat: undefined }))

      const pane = screen.getByRole('region', { name: 'Character' })
      expect(
        within(pane).getByRole('button', { name: 'Strength check, +4' }),
      ).toBeInTheDocument()
      expect(
        within(pane).queryByRole('region', { name: 'Your rolls' }),
      ).toBeNull()
      expect(
        within(pane).getByRole('button', { name: /^Your rolls/ }),
      ).toBeInTheDocument()
    })

    it('opens on the sheet during a fight too, with Combat marked on the player’s turn, and switches to combat', async () => {
      const user = userEvent.setup()
      renderTable(view({ sheet, combat: combat({ currentId: 'me' }) }))
      const sheetPane = screen.getByRole('region', { name: 'Character' })
      const column = screen.getByRole('region', { name: 'Combat' })
        .parentElement as HTMLElement

      expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(subtitle()).toHaveTextContent('Fighter 5 · Champion')
      expect(sheetPane).not.toHaveClass('hidden')
      expect(column).toHaveClass('hidden')
      await user.click(
        screen.getByRole('button', { name: 'Combat , your turn' }),
      )

      expect(sheetPane).toHaveClass('hidden')
      expect(column).not.toHaveClass('hidden')
      expect(screen.getByRole('button', { name: 'Combat' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    it("explains a sheet that hasn't arrived, opening on it", () => {
      renderTable(view({ combat: undefined }))

      expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(subtitle()).toHaveTextContent('The Lonely Mountain')
      expect(
        screen.getByRole('heading', { name: "Thorin's sheet hasn't arrived" }),
      ).toBeInTheDocument()
    })

    describe('a sheet the module held back, from module 0.22.0', () => {
      it('says it was too large to send, by how much, in megabytes', () => {
        renderTable(
          view({
            combat: undefined,
            sheetWithheld: {
              reason: 'tooLarge',
              bytes: 5_200_000,
              limit: 4_000_000,
            },
          }),
        )

        expect(
          screen.getByRole('heading', {
            name: "Thorin's sheet is too large to send",
          }),
        ).toBeInTheDocument()
        expect(explanation()).toHaveTextContent(
          'It came to 5.2 MB, more than the 4.0 MB this app takes. Your Gamemaster has been told.',
        )
      })

      it('rounds its size up and the limit down, so that it never reads as within it', () => {
        renderTable(
          view({
            combat: undefined,
            sheetWithheld: {
              reason: 'tooLarge',
              bytes: 1_000_001,
              limit: 1_000_000,
            },
          }),
        )

        expect(explanation()).toHaveTextContent(
          'It came to 1.1 MB, more than the 1.0 MB this app takes.',
        )
      })

      it("rounds down a limit that isn't a round number, such as 4 MiB", () => {
        renderTable(
          view({
            combat: undefined,
            sheetWithheld: {
              reason: 'tooLarge',
              bytes: 4_194_305,
              limit: 4_194_304,
            },
          }),
        )

        expect(explanation()).toHaveTextContent(
          'It came to 4.2 MB, more than the 4.1 MB this app takes.',
        )
      })

      it('says only that the Gamemaster has been told, where its sizes are unknown', () => {
        renderTable(
          view({
            combat: undefined,
            sheetWithheld: {
              reason: 'tooLarge',
              bytes: null,
              limit: 4_000_000,
            },
          }),
        )

        expect(
          screen.getByRole('heading', {
            name: "Thorin's sheet is too large to send",
          }),
        ).toBeInTheDocument()
        expect(explanation()).toHaveTextContent(
          /^Your Gamemaster has been told\.$/,
        )
      })

      it("says it hasn't arrived, for any other reason", () => {
        renderTable(
          view({
            combat: undefined,
            sheetWithheld: { reason: 'later', bytes: 5, limit: 4 },
          }),
        )

        expect(
          screen.getByRole('heading', {
            name: "Thorin's sheet hasn't arrived",
          }),
        ).toBeInTheDocument()
        expect(screen.queryByText(/has been told/)).not.toBeInTheDocument()
      })
    })
  })
})

/** What a message is, read: the Gamemaster's own roll, or the player's. */
const theirs = (id: string, sentAt: string): TableMessage => ({
  ...message(id, sentAt),
  speaker: 'Thorin',
  side: 'me',
  byGm: true,
})
const mine = (id: string, sentAt: string): TableMessage => ({
  ...message(id, sentAt),
  speaker: 'Thorin',
  side: 'me',
})

describe("components/game-table/game-table, the Gamemaster's seat (#156)", () => {
  const thorin: Character = {
    id: 'gm:c1:thorin',
    name: 'Thorin',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'thorin',
  }
  const seat = {
    role: 'gm' as const,
    api: '/api/campaigns/c1/characters/thorin',
    key: 'gm:c1:thorin',
  }
  // Handed in to show the Gamemaster's page never calls it, though its own page never hands it.
  const gmTable = (initial: TableView) => (
    <GameTable
      character={thorin}
      initialView={initial}
      seat={seat}
      markChatRead={markChatRead}
    />
  )
  const renderGm = (initial = view({ gm: { rolls: 'made' } })) => {
    current = { view: initial, connection: 'live' }
    jest.mocked(useTableView).mockImplementation(() => current)
    return render(gmTable(initial))
  }
  it('shows the sheet through the seat’s own API, marked GM, with a way back to the campaigns and none to delete it', () => {
    renderGm()

    expect(useTableView).toHaveBeenCalledWith(seat.api, expect.anything())
    expect(nameOf()).toHaveTextContent(/^Thorin$/)
    const pill = besideName() as HTMLElement
    expect(pill).toHaveTextContent('GM, Gamemaster view')
    expect(within(pill).getByText(', Gamemaster view')).toHaveClass('sr-only')
    expect(
      screen.getByRole('link', { name: 'Your campaigns' }),
    ).toHaveAttribute('href', '/campaigns')
    expect(screen.queryByRole('link', { name: 'All characters' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
  })

  it('cuts a long name short before the GM pill, which stays in view on a phone', () => {
    renderGm()
    const pill = besideName() as HTMLElement

    // The name gives way within the pair, which stands where a player's name alone does.
    expect(nameOf()).toHaveClass('min-w-0', 'truncate')
    expect(nameOf()).not.toHaveClass('shrink-0')
    expect(pill).toHaveClass('shrink-0')
    expect(nameOf().parentElement).toHaveClass('max-w-full', 'shrink-0')

    renderTable()
    expect(screen.getAllByRole('heading', { level: 1 })[1]).toHaveClass(
      'max-w-full',
      'shrink-0',
      'truncate',
    )
  })

  it.each([
    [
      'made',
      "You're at Thorin's sheet as the Gamemaster. What you roll here is made in your game as Thorin's, marked as yours.",
    ],
    [
      'update',
      "You're at Thorin's sheet as the Gamemaster. Your rolls stay here: update Sending Stone in Foundry to 0.23.0 to make them in your game as Thorin's.",
    ],
    [
      'off',
      "You're at Thorin's sheet as the Gamemaster. Your rolls stay here while your game isn't taking rolls from Sending Stone.",
    ],
  ] as const)('says where the Gamemaster’s rolls go: %s', (rolls, note) => {
    renderGm(view({ gm: { rolls } }))

    expect(screen.getByText(note)).toBeInTheDocument()
  })

  it("follows where the rolls go as the view changes, and says nothing of it on the player's page", () => {
    const { rerender } = renderGm(view({ gm: { rolls: 'update' } }))
    showing({ view: view({ gm: { rolls: 'made' } }) })
    rerender(gmTable(view()))
    expect(screen.getByText(/marked as yours\.$/)).toBeInTheDocument()

    renderTable()
    expect(screen.getAllByText(/as the Gamemaster\./)).toHaveLength(1)
  })

  it("counts unread all but the Gamemaster's own rolls, from what was there when they came, never moving the player's place", async () => {
    const user = userEvent.setup()
    const { rerender } = renderGm(
      view({
        messages: [message('m1', '2026-10-04T19:00:00.000Z')],
        chatReadAt: '2026-10-04T18:00:00.000Z',
        gm: { rolls: 'made' },
      }),
    )
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()

    showing({
      view: view({
        messages: [
          message('m1', '2026-10-04T19:00:00.000Z'),
          theirs('m2', '2026-10-04T19:01:00.000Z'),
          mine('m3', '2026-10-04T19:02:00.000Z'),
          message('m4', '2026-10-04T19:03:00.000Z'),
        ],
        gm: { rolls: 'made' },
      }),
    })
    rerender(gmTable(view()))
    // The player's own roll counts: the Gamemaster didn't make it.
    expect(
      screen.getByRole('button', { name: 'Chat 2 unread' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Chat/ }))
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(markChatRead).not.toHaveBeenCalled()
  })

  it("counts the Gamemaster's rolls as a player's character unread for its player", () => {
    renderTable(
      view({
        messages: [
          message('m1', '2026-10-04T19:00:00.000Z'),
          theirs('m2', '2026-10-04T19:01:00.000Z'),
          mine('m3', '2026-10-04T19:02:00.000Z'),
        ],
        chatReadAt: '2026-10-04T19:00:00.000Z',
      }),
    )

    expect(
      screen.getByRole('button', { name: 'Chat 1 unread' }),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'with the sheet, a save asked for and the game offline',
      {
        sheet,
        live: false,
        prompts: [
          {
            id: 'msg1-thorin',
            type: 'save' as const,
            abilities: ['dex'],
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        ],
        rollsToTable: ['save' as const],
        rollFeatures: ['prompts' as const],
      },
    ],
    ['without a sheet, nor a combat', { combat: undefined }],
    [
      'with a sheet held back',
      {
        combat: undefined,
        sheetWithheld: {
          reason: 'tooLarge',
          bytes: 5_000_000,
          limit: 4_000_000,
        },
      },
    ],
    ['with a combat not yet begun', { combat: combat({ started: false }) }],
  ])('never names the Gamemaster as someone else, %s', (_name, fields) => {
    const { container } = renderGm(view({ gm: { rolls: 'made' }, ...fields }))

    expect(container.textContent).not.toMatch(/your Gamemaster/i)
    expect(container.textContent).not.toMatch(/The Gamemaster is/)
  })

  it('names the game as theirs: its saves asked for, its liveness, its sheets and combat', () => {
    renderGm(
      view({
        combat: undefined,
        live: false,
        gm: { rolls: 'made' },
        sheetWithheld: { reason: 'later', bytes: 5, limit: 4 },
      }),
    )

    expect(
      screen.getByText(
        'Your Sending Stone module sends it under D&D Fifth Edition, from version 0.5.0. It arrives the next time your game connects.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      "Offline. Your game hasn't been heard from in the last two minutes.",
    )
  })
})
