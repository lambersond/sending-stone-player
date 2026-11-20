import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CHECK_EVERY } from '@/constants/lifecycle'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import { GameTable } from '@/features/table/components/game-table/game-table'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  fullerSheet,
  purse,
  sheetItem,
  tableMoves,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { advance, respond } from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { TableMoves } from '@/types/party'
import type { CharacterSheet, SheetCurrency } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)
// The table's view, as a test gives it.
jest.mock('@/features/table/hooks/use-table-view', () => ({
  ...jest.requireActual('@/features/table/hooks/use-table-view'),
  useTableView: jest.fn(),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** Thorin's things: a handaxe that rolls, his plain ring and backpack, and a torch burnt out. */
const movingSheet = (currency?: SheetCurrency[]): CharacterSheet => {
  const fuller = fullerSheet()
  const [weapons, equipment] = fuller.inventory.sections
  return fullerSheet({
    inventory: {
      ...fuller.inventory,
      ...(currency && { currency }),
      sections: [
        {
          ...weapons,
          items: [
            {
              ...weapons.items[1],
              activation: '1 Action',
              toHit: 7,
              attackId: 'handaxeAttack',
              damage: [
                { formula: '1d6 + 4', type: 'Slashing', healing: false },
              ],
            },
          ],
        },
        {
          ...equipment,
          items: [
            ...equipment.items,
            sheetItem({ id: 'torch', name: 'Torch', quantity: 0 }),
          ],
        },
      ],
    },
  })
}

const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actorThorin1',
  key: 'gm:c1:actorThorin1',
}

const pane = (
  moves: TableMoves | undefined,
  sheet: CharacterSheet,
  seat?: TableSeat,
) => {
  const sheetPane = (
    <CharacterPane
      characterId={seat?.key ?? 'char-1'}
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet, GAME)}
      moves={moves}
      actorId='actorThorin1'
    />
  )
  return seat ? (
    <TableApiContext value={seat}>{sheetPane}</TableApiContext>
  ) : (
    sheetPane
  )
}

/** Thorin's sheet on its Inventory tab, giving where it may: by default, where tableMoves says. */
const renderGive = async ({
  moves = tableMoves(),
  sheet = movingSheet(),
  seat,
  user = userEvent.setup(),
}: {
  /** Null while the game takes no moves. */
  moves?: TableMoves | null
  sheet?: CharacterSheet
  seat?: TableSeat
  /** One that moves fake timers on, where a test uses them. */
  user?: ReturnType<typeof userEvent.setup>
} = {}) => {
  const view = render(pane(moves ?? undefined, sheet, seat))
  await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
  return {
    user,
    ...view,
    rerenderWith: (next?: TableMoves) => view.rerender(pane(next, sheet, seat)),
  }
}

/**
 * The Currency row's Give, the button that gives coins: Send to from module 0.32.0's feedback, and
 * Give again since Send to and Hand out are one (item 89).
 */
const coinsButton = () =>
  within(screen.getByRole('group', { name: 'Currency' })).getByRole('button', {
    name: 'Give',
  })
const queryCoinsButton = () => screen.queryByRole('group', { name: 'Currency' })

/** What was posted, and where, of moves: never a description an opened row loads. */
const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))
const posted = () => posts()[0]

/** A move's body, as a page posts it: the transfer, and no dice. */
const body = (transfer: object) => ({
  kind: 'transfer',
  transfer,
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
})
const giveButton = (name: string) =>
  screen.getByRole('button', { name: `Give ${name}` })

/**
 * Has a dialog give focus back as the browser's does, which jsdom's doesn't: to what had it as the
 * dialog opened, once it's closed. A dialog removed while still open is never closed, and gives
 * focus to no one.
 */
const focusingDialogs = () => {
  const dialog = HTMLDialogElement.prototype
  const was = { showModal: dialog.showModal, close: dialog.close }
  const opener = new WeakMap<HTMLDialogElement, Element | null>()
  class Focusing extends HTMLDialogElement {
    override showModal() {
      opener.set(this, document.activeElement)
      this.open = true
    }

    override close() {
      this.open = false
      const before = opener.get(this)
      if (before instanceof HTMLElement) before.focus()
      this.dispatchEvent(new Event('close'))
    }
  }
  dialog.showModal = Focusing.prototype.showModal
  dialog.close = Focusing.prototype.close
  return () => {
    dialog.showModal = was.showModal
    dialog.close = was.close
  }
}

describe('components/transfers/give-controls', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    // The tray, not the toasts, which would say the same again.
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    // Nothing answers, unless a test says.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it('gives each item from inside it, once opened: a row that rolls, and one that doesn’t', async () => {
    const { user } = await renderGive()

    // Not in the row itself, which a row that rolls has no room for on a phone.
    expect(screen.queryByRole('button', { name: 'Give Handaxe' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: /^Handaxe/, expanded: false }),
    )
    const handaxe = giveButton('Handaxe')
    expect(handaxe).toHaveTextContent(/^Give…$/)
    expect(handaxe).toHaveAttribute('aria-haspopup', 'dialog')
    expect(handaxe).toHaveClass('self-start', 'rounded-full', 'text-xs')

    const ring = screen
      .getByText('Plain Ring')
      .closest('summary') as HTMLElement
    expect(within(ring).queryByRole('button', { name: /^Give/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Give Plain Ring' })).toBeNull()
    await user.click(screen.getByText('Plain Ring'))
    expect(giveButton('Plain Ring').closest('summary')).toBeNull()
    expect(giveButton('Plain Ring').closest('details')).toBe(ring.parentElement)

    // A container, and what's inside it, each its own.
    await user.click(screen.getByText('Backpack'))
    expect(giveButton('Backpack').closest('summary')).toBeNull()
    await user.click(screen.getByText('Hempen Rope'))
    expect(giveButton('Hempen Rope')).toBeInTheDocument()
  })

  it('gives none of an item there are none of', async () => {
    const { user } = await renderGive()
    await user.click(screen.getByText('Torch'))
    expect(screen.queryByRole('button', { name: 'Give Torch' })).toBeNull()
  })

  // Changed on purpose (item 89): below them, where they were beside them.
  it('gives coins from below them, while there’s a whole one to give', async () => {
    const { unmount } = await renderGive()
    const coins = coinsButton()
    expect(coins).toHaveTextContent(/^Give$/)
    expect(coins.closest('dd')).not.toBeNull()
    expect(screen.getByText('Currency')).toHaveTextContent(/^Currency$/)
    unmount()

    await renderGive({
      sheet: movingSheet([
        { id: 'gp', label: 'Gold', abbreviation: 'GP', value: 0.5 },
      ]),
    })
    expect(queryCoinsButton()).toBeNull()
  })

  it('gives nothing while the game takes no moves, or there’s no one to give to', async () => {
    const { user, unmount } = await renderGive({ moves: null })
    await user.click(screen.getByText('Plain Ring'))
    expect(screen.queryByRole('button', { name: /^Give/ })).toBeNull()
    unmount()

    const none = await renderGive({
      moves: { parties: [], characters: [] },
    })
    await none.user.click(screen.getByText('Plain Ring'))
    expect(screen.queryByRole('button', { name: /^Give/ })).toBeNull()
    none.unmount()

    // Another character alone is enough, with no party.
    const other = await renderGive({ moves: tableMoves({ parties: [] }) })
    await other.user.click(screen.getByText('Plain Ring'))
    expect(giveButton('Plain Ring')).toBeInTheDocument()
  })

  it('gives through the seat’s API, from its character, to the one chosen, shown in the tray', async () => {
    const { user } = await renderGive()
    await user.click(screen.getByText('Plain Ring'))
    await user.click(giveButton('Plain Ring'))

    const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
    // The primary party, chosen as it opens; the other character beside it.
    expect(
      within(dialog).getByRole('radio', { name: 'The Iron Company Primary' }),
    ).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'Vex' })).toBeVisible()
    expect(
      within(dialog).getByText('It arrives unequipped and unattuned.'),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('radio', { name: 'Vex' }))
    expect(
      within(dialog).getByText('You give 1 Plain Ring to Vex.'),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Give' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posts()).toHaveLength(1)
    const { url, body } = posted()
    expect(url).toBe('/api/characters/char-1/rolls')
    // A player's move is called nothing, as their page needs no name for it.
    expect(body).toEqual({
      kind: 'transfer',
      transfer: {
        from: 'actorThorin1',
        to: 'actorVex0001',
        items: [{ id: 'ring', quantity: 1 }],
      },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    expect(
      screen.getByText('Sending to your Gamemaster’s game…'),
    ).toBeInTheDocument()
  })

  it('waits while an item is on its way, and coins while theirs are', async () => {
    const { user } = await renderGive()
    await user.click(
      screen.getByRole('button', { name: /^Handaxe/, expanded: false }),
    )
    await user.click(giveButton('Handaxe'))
    // Two handaxes: one, as it opens.
    const dialog = screen.getByRole('dialog', { name: 'Give Handaxe' })
    await user.click(within(dialog).getByRole('button', { name: 'Give' }))

    const handaxe = giveButton('Handaxe')
    expect(handaxe).toHaveAttribute('aria-disabled', 'true')
    expect(handaxe).toHaveAttribute('aria-busy', 'true')
    expect(handaxe.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
    // The rest stay as they were.
    const coins = coinsButton()
    expect(coins).not.toHaveAttribute('aria-disabled')
    expect(coins).not.toHaveAttribute('aria-busy')

    await user.click(coins)
    const giving = screen.getByRole('dialog', { name: 'Give coins' })
    await user.type(within(giving).getByRole('textbox', { name: 'Gold' }), '5')
    await user.click(within(giving).getByRole('button', { name: 'Give coins' }))
    expect(coinsButton()).toHaveAttribute('aria-disabled', 'true')
    expect(posts()).toHaveLength(2)
    expect(posts()[1].body.transfer).toEqual({
      from: 'actorThorin1',
      to: 'groupIronCo01',
      currency: { gp: 5 },
    })
  })

  it('keeps the spinner on Give where it’s the row’s only button, none by the Currency label, unlike a party’s sheet (module 0.33.0)', async () => {
    const { user } = await renderGive()

    await user.click(coinsButton())
    const giving = screen.getByRole('dialog', { name: 'Give coins' })
    await user.type(within(giving).getByRole('textbox', { name: 'Gold' }), '5')
    await user.click(within(giving).getByRole('button', { name: 'Give coins' }))

    const coins = coinsButton()
    expect(coins).toHaveAttribute('aria-disabled', 'true')
    expect(coins.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
    const group = screen.getByRole('group', { name: 'Currency' })
    expect(group).not.toHaveAttribute('aria-busy')
    const term = screen.getByText('Currency').closest('dt') as HTMLElement
    expect(term.querySelector('svg')).toBeNull()
    // The item rows too: no spinner by a name, nor a row busy.
    for (const row of screen.getAllByRole('listitem')) {
      expect(row).not.toHaveAttribute('aria-busy')
    }
  })

  // Moved from coin-controls (item 89): Hand out's coins are Give's, to one or several.
  it('with module 0.49.0, gives coins to the characters ticked as a hand-out through the seat’s API, to one and then to two, the tray saying what each got and what else the game used', async () => {
    const done = (id: string, each: string[], gp: number) =>
      respond(200, {
        id,
        status: 'done',
        visible: true,
        rolls: [],
        transfer: {
          from: 'actorThorin1',
          to: null,
          items: [],
          currency: { gp },
          each,
          used: { pp: 1 },
        },
      })
    const VEX = 'actorVex0001'
    const BRAM = 'actorBram001'
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(done('req-1', [VEX], 5))
    const { user } = await renderGive({
      moves: tableMoves({
        handOut: { change: true },
        characters: [
          { id: VEX, name: 'Vex' },
          { id: BRAM, name: 'Bram' },
        ],
      }),
      sheet: movingSheet(purse({ pp: 2, gp: 3 })),
    })

    await user.click(coinsButton())
    let dialog = within(screen.getByRole('dialog', { name: 'Give coins' }))
    await user.click(dialog.getByRole('checkbox', { name: 'Vex' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
    expect(
      dialog.getByText(
        'You give 5 gp to Vex. You hold only 3 gp, so other coins pay for the rest.',
      ),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Give coins' }))
    expect(posts()).toEqual([
      {
        url: '/api/characters/char-1/rolls',
        body: body({ from: 'actorThorin1', each: [VEX], currency: { gp: 5 } }),
      },
    ])
    expect(
      await screen.findByText(
        'Gave 5 gp to Vex, using 1 pp',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()

    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      .mockResolvedValue(done('req-2', [VEX, BRAM], 2))
    await user.click(coinsButton())
    dialog = within(screen.getByRole('dialog', { name: 'Give coins' }))
    await user.click(dialog.getByRole('checkbox', { name: 'Select all' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '2')
    expect(
      dialog.getByText(
        'You give 2 gp each to Vex and Bram: 4 gp in all. You hold only 3 gp, so other coins pay for the rest.',
      ),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Give coins' }))
    expect(posts()[1]).toEqual({
      url: '/api/characters/char-1/rolls',
      body: body({
        from: 'actorThorin1',
        each: [VEX, BRAM],
        currency: { gp: 2 },
      }),
    })
    expect(
      await screen.findByText(
        'Gave 2 gp each to Vex and Bram, using 1 pp',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  // Review round 1 (item 89): a give rolls nothing, so the give itself shows the tray on a tab
  // that shows it only once something's been done there, as Effects: sent to characters as the
  // game hands coins out (`onGive`), or to the party (`onMove`). This sheet writes its gold GP.
  it.each([
    [
      'coins to a character, as the game hands them out',
      'Vex',
      { to: null, each: ['actorVex0001'] },
      'Gave 5 GP to Vex',
    ],
    [
      'coins to the party',
      undefined,
      { to: 'groupIronCo01' },
      'Gave 5 GP to The Iron Company',
    ],
  ])(
    'with module 0.49.0, shows the tray on Effects once it has given %s, as giving rolls nothing',
    async (_what, tick, ends, line) => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValue(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
            transfer: {
              from: 'actorThorin1',
              items: [],
              currency: { gp: 5 },
              ...ends,
            },
          }),
        )
      const { user } = await renderGive({
        moves: tableMoves({ handOut: { change: true } }),
      })
      const show = (tab: RegExp) =>
        user.click(screen.getByRole('tab', { name: tab }))
      await show(/^Effects/)
      expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()

      await show(/^Inventory/)
      await user.click(coinsButton())
      const dialog = within(screen.getByRole('dialog', { name: 'Give coins' }))
      if (tick) await user.click(dialog.getByRole('checkbox', { name: tick }))
      await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
      await user.click(dialog.getByRole('button', { name: 'Give coins' }))
      await show(/^Effects/)
      const tray = screen.getByRole('region', { name: 'Your rolls' })
      expect(
        await within(tray).findByText(line, {}, { timeout: 3000 }),
      ).toBeVisible()
    },
  )

  it('with module 0.51.0, gives coins to a party and a character ticked together, one hand-out through the seat’s API, the tray naming both', async () => {
    const PARTY = 'groupIronCo01'
    const VEX = 'actorVex0001'
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          transfer: {
            from: 'actorThorin1',
            to: null,
            items: [],
            currency: { gp: 2 },
            each: [PARTY, VEX],
            used: null,
          },
        }),
      )
    const { user } = await renderGive({
      moves: tableMoves({ handOut: { change: true, parties: true } }),
      sheet: movingSheet(purse({ gp: 30 })),
    })

    await user.click(coinsButton())
    const dialog = within(screen.getByRole('dialog', { name: 'Give coins' }))
    await user.click(
      dialog.getByRole('checkbox', { name: 'The Iron Company Primary' }),
    )
    await user.click(dialog.getByRole('checkbox', { name: 'Vex' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '2')
    await user.click(dialog.getByRole('button', { name: 'Give coins' }))
    expect(posts()).toEqual([
      {
        url: '/api/characters/char-1/rolls',
        body: body({
          from: 'actorThorin1',
          each: [PARTY, VEX],
          currency: { gp: 2 },
        }),
      },
    ])
    expect(
      await screen.findByText(
        'Gave 2 gp each to The Iron Company and Vex',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  // Moved from coin-controls (item 89).
  it('gives to characters by what the game says of moves paying with other coins, whatever the coins’ own switch is', async () => {
    // No coins' switch, so the page has no word of its own on other coins: the moves' says none.
    const { user } = await renderGive({
      moves: tableMoves({ handOut: { change: false } }),
      sheet: movingSheet(purse({ pp: 2, gp: 3 })),
    })
    await user.click(coinsButton())
    const dialog = within(screen.getByRole('dialog', { name: 'Give coins' }))
    await user.click(dialog.getByRole('checkbox', { name: 'Vex' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')

    expect(
      dialog.getByText(
        'You hold only 3 gp, and your Gamemaster’s game doesn’t pay with other coins.',
      ),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Give coins' }))
    expect(posts()).toEqual([])
  })

  it('waits while the game is giving it, until it’s given', async () => {
    jest.useFakeTimers()
    try {
      const given = {
        id: 'req-1',
        status: 'done',
        visible: true,
        rolls: [],
        transfer: {
          from: 'actorThorin1',
          to: 'groupIronCo01',
          items: [
            { id: 'ring', quantity: 1, created: 'ringParty001', stacked: null },
          ],
          currency: null,
        },
      }
      // Claimed by the game at once, which takes two checks to give it.
      const answers = [
        { id: 'req-1', status: 'rolling' },
        { id: 'req-1', status: 'rolling' },
        given,
      ]
      jest.mocked(fetch).mockImplementation(async (url, init) => {
        if (init?.method === 'POST') return respond(202, { id: 'req-1' })
        if (url === '/api/characters/char-1/rolls/req-1') {
          return respond(200, answers.length > 1 ? answers.shift() : answers[0])
        }
        // An opened row's description, which never comes.
        return new Promise<Response>(() => {})
      })
      const { user } = await renderGive({
        user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime }),
      })
      await user.click(screen.getByText('Plain Ring'))
      // The row opens on its toggle, which comes a moment after.
      await advance(0)
      await user.click(giveButton('Plain Ring'))
      const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
      await user.click(within(dialog).getByRole('button', { name: 'Give' }))

      for (let poll = 0; poll < 2; poll++) {
        await advance(CHECK_EVERY)
        expect(
          screen.getByText('Giving it in your Gamemaster’s game…'),
        ).toBeInTheDocument()
        const ring = giveButton('Plain Ring')
        expect(ring).toHaveAttribute('aria-disabled', 'true')
        expect(ring).toHaveAttribute('aria-busy', 'true')
      }

      await advance(CHECK_EVERY)
      expect(
        screen.getByText('Gave 1 Plain Ring to The Iron Company'),
      ).toBeInTheDocument()
      const ring = giveButton('Plain Ring')
      expect(ring).not.toHaveAttribute('aria-disabled')
      expect(ring).not.toHaveAttribute('aria-busy')
    } finally {
      jest.useRealTimers()
    }
  })

  it('keeps focus on an item’s Give… as it is sent by Enter, waiting there till it’s given, and hands it to the row beside once it’s gone (item 85)', async () => {
    const restore = focusingDialogs()
    jest.useFakeTimers()
    try {
      const given = {
        id: 'req-1',
        status: 'done',
        visible: true,
        rolls: [],
        transfer: {
          from: 'actorThorin1',
          to: 'groupIronCo01',
          items: [
            { id: 'ring', quantity: 1, created: 'ringParty001', stacked: null },
          ],
          currency: null,
        },
      }
      // Claimed by the game at once, which takes two checks to give it.
      const answers = [
        { id: 'req-1', status: 'rolling' },
        { id: 'req-1', status: 'rolling' },
        given,
      ]
      jest.mocked(fetch).mockImplementation(async (url, init) => {
        if (init?.method === 'POST') return respond(202, { id: 'req-1' })
        if (url === '/api/characters/char-1/rolls/req-1') {
          return respond(200, answers.length > 1 ? answers.shift() : answers[0])
        }
        // An opened row's description, which never comes.
        return new Promise<Response>(() => {})
      })
      const { user, rerender } = await renderGive({
        user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime }),
      })
      await user.click(screen.getByText('Plain Ring'))
      await advance(0)
      giveButton('Plain Ring').focus()
      await user.keyboard('{Enter}')
      const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
      within(dialog).getByRole('button', { name: 'Give' }).focus()
      await user.keyboard('{Enter}')

      // Sent: the dialog gives focus back to Give…, which waits for the game, doing nothing.
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(giveButton('Plain Ring'))
      expect(giveButton('Plain Ring')).toHaveAttribute('aria-disabled', 'true')
      await user.keyboard('{Enter}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posts()).toHaveLength(1)

      // Given, it's ready again, focus still on it.
      await advance(CHECK_EVERY)
      await advance(CHECK_EVERY)
      await advance(CHECK_EVERY)
      expect(
        screen.getByText('Gave 1 Plain Ring to The Iron Company'),
      ).toBeInTheDocument()
      expect(document.activeElement).toBe(giveButton('Plain Ring'))
      expect(giveButton('Plain Ring')).not.toHaveAttribute('aria-disabled')

      // Given whole, its row goes from the sheet, and focus with it to the row beside.
      const sheet = movingSheet()
      const [weapons, equipment] = sheet.inventory.sections
      rerender(
        pane(tableMoves(), {
          ...sheet,
          inventory: {
            ...sheet.inventory,
            sections: [
              weapons,
              {
                ...equipment,
                items: equipment.items.filter(({ id }) => id !== 'ring'),
              },
            ],
          },
        }),
      )
      await advance(0)
      expect(screen.queryByText('Plain Ring')).toBeNull()
      expect(document.activeElement).toBe(
        screen.getByText('Cloak of Protection').closest('summary'),
      )
    } finally {
      jest.useRealTimers()
      restore()
    }
  })

  it('gives focus back to its Give… as it closes by Cancel, Close or a tap beside it', async () => {
    const restore = focusingDialogs()
    try {
      const { user } = await renderGive()
      await user.click(screen.getByText('Plain Ring'))
      const ring = giveButton('Plain Ring')
      const closers: Record<string, (dialog: HTMLElement) => Promise<void>> = {
        Cancel: dialog =>
          user.click(within(dialog).getByRole('button', { name: 'Cancel' })),
        Close: dialog =>
          user.click(within(dialog).getByRole('button', { name: 'Close' })),
        // A tap on the backdrop is one on the dialog itself.
        backdrop: async dialog => {
          fireEvent.click(dialog)
        },
      }
      for (const [how, closeIt] of Object.entries(closers)) {
        await user.click(ring)
        const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
        // Focus is inside it, as the browser's would be.
        within(dialog).getByRole('radio', { name: 'Vex' }).focus()
        await closeIt(dialog)
        expect(screen.queryByRole('dialog')).toBeNull()
        expect({ how, focused: document.activeElement }).toEqual({
          how,
          focused: ring,
        })
      }

      // Each time it opens afresh, as what's chosen in it isn't kept.
      await user.click(ring)
      const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
      expect(
        within(dialog).getByRole('radio', { name: 'The Iron Company Primary' }),
      ).toBeChecked()
    } finally {
      restore()
    }
  })

  it('gives as the Gamemaster in the character’s name, called as their page calls it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          transfer: {
            from: 'actorThorin1',
            to: 'actorVex0001',
            items: [],
            currency: { gp: 5 },
          },
        }),
      )
    const { user } = await renderGive({ seat: GM_SEAT })
    await user.click(coinsButton())
    const dialog = screen.getByRole('dialog', { name: 'Give coins' })
    await user.click(within(dialog).getByRole('radio', { name: 'Vex' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Gold' }), '5')
    expect(
      within(dialog).getByText('Thorin Oakenshield gives 5 GP to Vex.'),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Give coins' }))

    const { url, body } = posted()
    expect(url).toBe('/api/campaigns/c1/characters/actorThorin1/rolls')
    expect(body).toMatchObject({
      kind: 'transfer',
      label: 'Give 5 GP to Vex',
      transfer: {
        from: 'actorThorin1',
        to: 'actorVex0001',
        currency: { gp: 5 },
      },
    })
    expect(
      await screen.findByText(
        'Thorin Oakenshield gave 5 GP to Vex',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  it('keeps its dialog open as the game stops taking moves, and says so of what’s sent', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(409, { reason: 'unavailable' }))
    const { user, rerenderWith } = await renderGive()
    await user.click(screen.getByText('Plain Ring'))
    await user.click(giveButton('Plain Ring'))
    expect(
      screen.getByRole('dialog', { name: 'Give Plain Ring' }),
    ).toBeVisible()

    rerenderWith()
    // Its row's Give is gone; the dialog isn't.
    expect(screen.queryByRole('button', { name: 'Give Plain Ring' })).toBeNull()
    const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
    expect(
      within(dialog).getByRole('radio', { name: 'The Iron Company Primary' }),
    ).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Give' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      await screen.findByText(
        'Not given: your Gamemaster’s game isn’t taking moves now',
      ),
    ).toBeInTheDocument()
  })

  describe('at the table', () => {
    const thorin: Character = {
      id: 'char-1',
      name: 'Thorin Oakenshield',
      gameUrl: GAME,
      campaignTitle: 'The Lonely Mountain',
      campaignId: 'c1',
      actorId: 'actorThorin1',
    }
    const tableView = (fields: Partial<TableView> = {}): TableView => ({
      version: 3,
      live: true,
      campaign: { title: 'The Lonely Mountain' },
      connected: true,
      messages: [],
      sheet: toTableSheet(movingSheet(), GAME),
      sheetVersion: 'v1',
      moves: tableMoves(),
      ...fields,
    })
    const renderTable = async (shown: TableView, seat?: TableSeat) => {
      jest.mocked(useTableView).mockReturnValue({
        view: shown,
        connection: 'live',
        readAgain: () => {},
      })
      const user = userEvent.setup()
      render(
        <GameTable
          character={seat ? { ...thorin, id: seat.key } : thorin}
          initialView={shown}
          seat={seat}
        />,
      )
      await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
      return user
    }

    it('gives from the character at the table, through its seat, while it’s in the game', async () => {
      const user = await renderTable(tableView())
      await user.click(coinsButton())
      const dialog = screen.getByRole('dialog', { name: 'Give coins' })
      await user.click(within(dialog).getByRole('button', { name: 'All Gold' }))
      await user.click(
        within(dialog).getByRole('button', { name: 'Give coins' }),
      )
      expect(posted()).toEqual({
        url: '/api/characters/char-1/rolls',
        body: expect.objectContaining({
          kind: 'transfer',
          transfer: {
            from: 'actorThorin1',
            to: 'groupIronCo01',
            currency: { gp: 41 },
          },
        }),
      })
    })

    it('gives nothing from a character no longer in the game', async () => {
      await renderTable(tableView({ connected: false }))
      expect(queryCoinsButton()).toBeNull()
    })

    it('gives through the Gamemaster’s seat at the character, in its name', async () => {
      const user = await renderTable(tableView(), GM_SEAT)
      await user.click(coinsButton())
      const dialog = screen.getByRole('dialog', { name: 'Give coins' })
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Platinum' }),
        '1',
      )
      expect(
        within(dialog).getByText(
          'Thorin Oakenshield gives 1 PP to The Iron Company.',
        ),
      ).toBeVisible()
      await user.click(
        within(dialog).getByRole('button', { name: 'Give coins' }),
      )
      expect(posted().url).toBe(
        '/api/campaigns/c1/characters/actorThorin1/rolls',
      )
      expect(posted().body.label).toBe('Give 1 PP to The Iron Company')
    })
  })
})
