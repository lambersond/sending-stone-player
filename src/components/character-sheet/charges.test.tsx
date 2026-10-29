/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsTab } from './actions-tab'
import { CharacterPane } from './character-pane'
import { briefOf, RollTray, type TableRolls } from './roll-tray'
import { Charging } from './uses-button'
import { COMPANION_UNTAKEN, ROLL_KINDS } from '@/constants/sending-stone'
import { TableApiContext } from '@/hooks/use-table-api'
import { SEND_KEY, type TableRollState } from '@/hooks/use-table-rolls'
import {
  chargingSheet,
  counted,
  druidSheet,
  enchantUse,
  shapedSheet,
  sheetAction,
  sheetSpell,
  utilityUse,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { LocalGmRoll, LocalUse } from '@/hooks/use-sheet-roller'
import type { TableSeat } from '@/types/character'
import type { GmRollView, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  SheetAction,
  SheetConcentration,
} from '@/types/sending-stone'

/*
 * Ember's concentration ended, her counters' charges spent and her Heroic Inspiration used or
 * gained from the sheet, from module 0.29.0; and what the tray and toasts say of each.
 */

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** Every kind from module 0.29.0, and a use. */
const KINDS: RollKind[] = ['use', 'endConcentration', 'spend', 'inspiration']

/** What each of them throws: nothing. */
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }

/** The Gamemaster's seat at Ember's sheet (#156). */
const GM: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/ember',
  key: 'gm:c1:ember',
}

/**
 * The game, which makes each request as it answers it by its id: everything posted, in order. One
 * it hasn't answered is still on its way.
 */
const answering = (answers: Record<string, Record<string, unknown>> = {}) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = String(url).split('/').at(-1) ?? ''
    const answer = answers[id] ?? { status: 'pending' }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...answer }),
    } as Response
  }) as typeof fetch
  return posted
}

/** Done in the game, with no card. */
const DONE = { status: 'done', visible: true, rolls: [] }

const pane = (
  sheet: CharacterSheet = chargingSheet(),
  kinds: RollKind[] = KINDS,
  seat?: TableSeat,
) => (
  <TableApiContext value={seat}>
    <CharacterPane
      characterId='char-ember'
      name='Ember'
      sheet={toTableSheet(sheet, GAME)}
      rollsToTable={kinds}
    />
  </TableApiContext>
)

type User = ReturnType<typeof userEvent.setup>

/** A tab of the sheet, shown. */
const show = (user: User, name: string) =>
  user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

/** Ember concentrating on Bless and Hex, as dnd5e's limit 2 lets her. */
const twoConcentrations: SheetConcentration = {
  effects: [
    { id: 'concBless0001', name: 'Bless', item: 'bless' },
    { id: 'concHex000001', name: 'Hex', item: null },
  ],
}

// The game is asked after a request once a second, which a busy machine may be slow to get to.
jest.setTimeout(20_000)

beforeEach(() => {
  globalThis.localStorage.clear()
  // These test the tray, whose words a roll's toast would say again.
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
})

describe('ending concentration, from module 0.29.0', () => {
  it('ends Bless from its open row in Effects, once asked, never from the row itself', async () => {
    const user = userEvent.setup()
    const posted = answering({ 'req-1': DONE })
    render(pane())
    await show(user, 'Effects')

    const row = screen.getByText('Concentrating: Bless').closest('li')!
    expect(within(row).queryByRole('button', { name: /^End/ })).toBeNull()
    await user.click(within(row).getByText('Concentrating: Bless'))
    expect(within(row).getByText('Concentrating on Bless')).toBeVisible()
    const end = within(row).getByRole('button', {
      name: 'End concentration on Bless',
    })
    expect(end).toHaveTextContent('End')
    // In the opened row, not its summary, which opens it.
    expect(end.closest('summary')).toBeNull()

    await user.click(end)
    const asked = screen.getByRole('dialog', {
      name: 'End concentration on Bless?',
    })
    expect(asked).toHaveTextContent('What it keeps up on your allies ends too.')
    // Rendered beside its button, its dialog, with its heading, is in no paragraph, which HTML
    // never lets hold one.
    expect(asked.closest('p')).toBeNull()
    await user.click(within(asked).getByRole('button', { name: 'Keep' }))
    expect(posted).toEqual([])

    await user.click(end)
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'End concentration on Bless?' }),
      ).getByRole('button', { name: 'End' }),
    )
    expect(posted).toEqual([
      {
        kind: 'endConcentration',
        concentration: { effect: 'concBless0001' },
        ...PLAIN,
      },
    ])
    // The tray shows on Effects too, once it's ended from there.
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Concentration on BlessEnded at the table',
        ),
      { timeout: 5000 },
    )
  })

  it('keeps End alone, by its exact name, on a concentration’s row with the player’s own effects offered (module 0.39.0)', async () => {
    const user = userEvent.setup()
    answering()
    const [temporary] = chargingSheet().effects
    const sheet = chargingSheet({
      effects: [
        {
          ...temporary,
          effects: [
            // A concentration: no `ops`, as the module gives none, End ending it.
            { ...temporary.effects[0], ops: [] },
            {
              id: 'mageArmor001',
              name: 'Mage Armor',
              img: null,
              source: 'Mage Armor',
              duration: '8 Hours',
              disabled: false,
              ops: ['disable', 'delete'],
              text: null,
            },
          ],
        },
      ],
    })
    render(
      <CharacterPane
        characterId='char-ember'
        name='Ember'
        sheet={toTableSheet(sheet, GAME)}
        rollsToTable={KINDS}
        effects
      />,
    )
    await show(user, 'Effects')
    const row = screen.getByText('Concentrating: Bless').closest('li')!
    await user.click(within(row).getByText('Concentrating: Bless'))
    expect(
      within(row)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['End concentration on Bless'])
    // Another effect, beside it, has its own.
    const armor = screen.getByText('Mage Armor').closest('li')!
    await user.click(within(armor).getByText('Mage Armor'))
    expect(
      within(armor)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['Turn off Mage Armor', 'Delete Mage Armor'])
    // In the opened row, as End is, never on its summary.
    for (const button of within(armor).getAllByRole('button')) {
      expect(button.closest('summary')).toBeNull()
    }
  })

  it('gives a favorite of the effect the same End', async () => {
    const user = userEvent.setup()
    answering()
    render(
      pane(
        chargingSheet({
          favorites: [
            {
              type: 'effect',
              id: 'concBless0001',
              name: 'Concentrating: Bless',
              img: null,
              disabled: false,
              suppressed: false,
            },
          ],
        }),
      ),
    )
    await show(user, 'Effects')

    const [favorite] = screen
      .getAllByText('Concentrating: Bless')
      .map(name => name.closest('li')!)
    await user.click(within(favorite).getByText('Concentrating: Bless'))
    expect(
      within(favorite).getByRole('button', {
        name: 'End concentration on Bless',
      }),
    ).toBeVisible()
  })

  it('asks to end the one concentration from the header chip', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane())

    await user.click(
      screen.getByRole('button', { name: 'Concentrating Bless' }),
    )
    const asked = screen.getByRole('dialog', {
      name: 'End concentration on Bless?',
    })
    await user.click(within(asked).getByRole('button', { name: 'End' }))
    expect(posted).toEqual([
      expect.objectContaining({
        kind: 'endConcentration',
        concentration: { effect: 'concBless0001' },
      }),
    ])
  })

  it('offers a menu of each concentration from the chip, with two, each asking to end it', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane(chargingSheet({ concentration: twoConcentrations })))

    await user.click(
      screen.getByRole('button', { name: 'Concentrating Bless' }),
    )
    const menu = screen.getByRole('menu', { name: 'Concentrating' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['End concentration on Bless', 'End concentration on Hex'])
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(
      within(menu).getByRole('menuitem', { name: 'End concentration on Hex' }),
    )
    expect(screen.queryByRole('menu')).toBeNull()
    const asked = screen.getByRole('dialog', {
      name: 'End concentration on Hex?',
    })
    await user.click(within(asked).getByRole('button', { name: 'End' }))
    expect(posted).toEqual([
      expect.objectContaining({
        kind: 'endConcentration',
        concentration: { effect: 'concHex000001' },
      }),
    ])
  })

  it.each<[string, CharacterSheet, RollKind[], TableSeat | undefined]>([
    ['while the game takes no ending', chargingSheet(), ['use'], undefined],
    [
      'from a module before 0.29.0, which names none',
      chargingSheet({ concentration: undefined }),
      KINDS,
      undefined,
    ],
    [
      "on the Gamemaster's page, which is never offered it",
      chargingSheet(),
      ['use', 'spend', 'inspiration'],
      GM,
    ],
  ])(
    'jumps from the chip to Effects, with no End there, %s',
    async (_name, sheet, kinds, seat) => {
      const user = userEvent.setup()
      answering()
      render(pane(sheet, kinds, seat))

      await user.click(
        screen.getByRole('button', { name: 'Concentrating Bless' }),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('tab', { name: /^Effects/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await user.click(screen.getByText('Concentrating: Bless'))
      expect(screen.queryByText('Concentrating on Bless')).toBeNull()
      expect(
        screen.queryByRole('button', { name: /^End concentration/ }),
      ).toBeNull()
    },
  )
})

/** A count's button, by what it spends and how many are left. */
const counter = (name: string, value: number, max: number) =>
  screen.getByRole('button', {
    name: `Spend ${name}: ${value} of ${max} left`,
  })

/** A Use chip, by what it uses. */
const useOf = (name: string) =>
  screen.getByRole('button', { name: `Use ${name}` })

/** Something done in the game that uses nothing, as the page keeps it. */
const use = (fields: Partial<LocalUse>): LocalUse => ({
  kind: 'use',
  id: 'u1',
  label: 'Sorcery Points',
  spell: false,
  at: 0,
  ...fields,
})

describe('spending charges, from module 0.29.0', () => {
  it('opens a popover from a feature’s count, spending nothing until asked, from 1 to as many as are left', async () => {
    const user = userEvent.setup()
    const posted = answering({
      'req-1': DONE,
    })
    const { container } = render(pane())
    await show(user, 'Features')

    const count = counter('Replicate Magic Item', 3, 3)
    // In its row's summary, it opens its popover, not the row: its click is cancelled, which a
    // browser would take as the summary's, and goes no further than the page's own handlers.
    const row = count.closest('details')!
    const cancelled: boolean[] = []
    const onPage = (event: Event) => cancelled.push(event.defaultPrevented)
    const beyond = jest.fn()
    container.addEventListener('click', onPage)
    document.addEventListener('click', beyond)
    await user.click(count)
    container.removeEventListener('click', onPage)
    document.removeEventListener('click', beyond)
    expect(cancelled).toEqual([true])
    expect(beyond).not.toHaveBeenCalled()
    expect(row).not.toHaveAttribute('open')
    expect(posted).toEqual([])
    const popover = screen.getByRole('dialog', {
      name: 'Spend Replicate Magic Item',
    })
    const fewer = within(popover).getByRole('button', { name: 'One fewer' })
    const more = within(popover).getByRole('button', { name: 'One more' })
    expect(popover).toHaveTextContent('1 of 3')
    expect(fewer).toHaveAttribute('aria-disabled', 'true')
    await user.click(fewer)
    expect(popover).toHaveTextContent('1 of 3')
    await user.click(more)
    await user.click(more)
    expect(popover).toHaveTextContent('3 of 3')
    expect(more).toHaveAttribute('aria-disabled', 'true')
    await user.click(more)
    expect(popover).toHaveTextContent('3 of 3')
    await user.click(fewer)
    // Nothing else uses it, so nothing else spends it.
    expect(popover).not.toHaveTextContent('Use spends this too')

    await user.click(within(popover).getByRole('button', { name: 'Spend 2' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posted).toEqual([
      { kind: 'spend', counter: { item: 'replicate' }, count: 2, ...PLAIN },
    ])
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Replicate Magic ItemSpent 2 at the table',
        ),
      { timeout: 5000 },
    )
  })

  it('says where using the row spends the same counter, and spends it beside Use', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane())
    await show(user, 'Features')

    await user.click(counter('Sorcery Points', 8, 20))
    const popover = screen.getByRole('dialog', { name: 'Spend Sorcery Points' })
    expect(popover).toHaveTextContent('Use spends this too')
    expect(popover).toHaveTextContent('1 of 8')
    await user.click(within(popover).getByRole('button', { name: 'Spend 1' }))
    expect(posted).toEqual([
      { kind: 'spend', counter: { item: 'sorcery' }, count: 1, ...PLAIN },
    ])
  })

  it('says nothing of a Use that spends another counter', async () => {
    const user = userEvent.setup()
    answering()
    const sheet = chargingSheet()
    sheet.actions[0].actions[0] = sheetAction({
      id: 'sorcery',
      name: 'Sorcery Points',
      activation: 'Special',
      activity: utilityUse('spUtility', [
        { counter: { resource: 'primary' }, amount: 1 },
      ]),
      uses: counted(8, 20, { item: 'sorcery' }),
    })
    render(pane(sheet))
    await show(user, 'Actions')

    await user.click(counter('Sorcery Points', 8, 20))
    expect(
      screen.getByRole('dialog', { name: 'Spend Sorcery Points' }),
    ).not.toHaveTextContent('Use spends this too')
  })

  it.each([[-1], [0]])(
    'says nothing of a Use that costs %p of the same counter, none or less, as Spell Absorption gives a staff a charge back',
    async amount => {
      const user = userEvent.setup()
      answering()
      const sheet = chargingSheet()
      sheet.actions[0].actions[0].activity = utilityUse('spUtility', [
        { counter: { item: 'sorcery' }, amount },
      ])
      render(pane(sheet))
      await show(user, 'Actions')

      await user.click(counter('Sorcery Points', 8, 20))
      expect(
        screen.getByRole('dialog', { name: 'Spend Sorcery Points' }),
      ).not.toHaveTextContent('Use spends this too')
    },
  )

  it("spends an item's charges, and an old-style resource's among the favorites, but never a potion's", async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane())
    await show(user, 'Inventory')

    await user.click(counter('Wand of Secrets', 2, 3))
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    expect(
      screen.queryByRole('button', { name: /^Spend Potion of Healing/ }),
    ).toBeNull()
    expect(screen.getByText('1 of 1 uses left')).toBeInTheDocument()

    await user.click(counter('Superiority Dice', 3, 4))
    await user.click(screen.getByRole('button', { name: 'One more' }))
    await user.click(screen.getByRole('button', { name: 'Spend 2' }))
    expect(posted).toEqual([
      { kind: 'spend', counter: { item: 'wand' }, count: 1, ...PLAIN },
      { kind: 'spend', counter: { resource: 'primary' }, count: 2, ...PLAIN },
    ])
  })

  it('spends the resource a favorite feature stands for, whose count it shows', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(
      pane(
        chargingSheet({
          favorites: [
            {
              type: 'resource',
              id: 'primary',
              name: 'Sorcery Points',
              uses: counted(5, 20, { resource: 'primary' }),
              itemId: 'sorcery',
            },
          ],
        }),
      ),
    )
    await show(user, 'Actions')

    // The favorite row, standing for the resource, shows its count; the action's row its own.
    await user.click(counter('Sorcery Points', 5, 20))
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    expect(posted).toEqual([
      { kind: 'spend', counter: { resource: 'primary' }, count: 1, ...PLAIN },
    ])
  })

  it('shows what a spend from the favorites on Effects comes to, though they roll nothing', async () => {
    const user = userEvent.setup()
    answering({ 'req-1': { status: 'failed', reason: 'short' } })
    render(pane())
    await show(user, 'Effects')
    expect(screen.queryByRole('status')).toBeNull()

    await user.click(counter('Superiority Dice', 3, 4))
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Superiority DiceNot spent at the table: you haven’t that many left',
        ),
      { timeout: 5000 },
    )
  })

  it.each<[string, CharacterSheet, RollKind[]]>([
    ['with none left', chargingSheet(), KINDS],
    ['while the game takes no spending', chargingSheet(), ['use']],
  ])('offers no spending %s', async (_name, sheet, kinds) => {
    const user = userEvent.setup()
    answering()
    render(pane(sheet, kinds))
    await show(user, 'Features')

    expect(screen.queryByRole('button', { name: /^Spend Lucky/ })).toBeNull()
    expect(screen.getAllByText('0 of 3 uses left').length).toBeGreaterThan(0)
    if (!kinds.includes('spend')) {
      expect(screen.queryByRole('button', { name: /^Spend / })).toBeNull()
    }
  })

  it("offers no spending of uses the sheet doesn't say may be spent, as from a module before 0.29.0", async () => {
    const user = userEvent.setup()
    answering()
    const sheet = chargingSheet()
    sheet.features[0].features[2].uses = { value: 3, max: 3, recovery: null }
    render(pane(sheet))
    await show(user, 'Features')

    expect(
      screen.queryByRole('button', { name: /^Spend Replicate Magic Item/ }),
    ).toBeNull()
    expect(screen.getByText('3 of 3 uses left')).toBeInTheDocument()
  })

  it('spends from the Actions table, an action’s count and its activity’s own', async () => {
    const user = userEvent.setup()
    const spend = jest.fn()
    const own = counted(2, 2, { item: 'staff', activity: 'staffWisp001' })
    const wisp = {
      id: 'staffWisp001',
      name: 'Starry Wisp',
      type: 'utility',
      activation: 'Action',
      range: null,
      target: null,
      toHit: null,
      save: null,
      damage: [],
      uses: own,
    }
    const sheet = chargingSheet()
    sheet.actions[0].actions.push(
      sheetAction({
        id: 'staff',
        name: 'Staff of Stars',
        uses: counted(4, 10, { item: 'staff' }),
        activities: [{ ...wisp, id: 'staffFirst01', uses: null }, wisp],
      }),
    )
    render(
      <Charging actions={{ spend }}>
        <ActionsTab
          characterId='char-ember'
          sheet={toTableSheet(sheet, GAME)}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          layout='table'
        />
      </Charging>,
    )
    const table = screen.getByRole('table', { name: 'Special' })

    await user.click(
      within(table).getByRole('button', {
        name: 'Spend Sorcery Points: 8 of 20 left',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    await user.click(
      within(table).getByRole('button', { name: /^Staff of Stars/ }),
    )
    await user.click(
      within(table).getByRole('button', {
        name: 'Spend Staff of Stars (Starry Wisp): 2 of 2 left',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    expect(spend.mock.calls).toEqual([
      [{ item: 'sorcery' }, 1, 'Sorcery Points'],
      [
        { item: 'staff', activity: 'staffWisp001' },
        1,
        'Staff of Stars (Starry Wisp)',
      ],
    ])
  })

  it("spends an activity's own beneath its item, in a list", async () => {
    const user = userEvent.setup()
    const spend = jest.fn()
    const wisp = {
      id: 'staffWisp001',
      name: 'Starry Wisp',
      type: 'utility',
      activation: 'Action',
      range: null,
      target: null,
      toHit: null,
      save: null,
      damage: [],
      uses: counted(2, 2, { item: 'staff', activity: 'staffWisp001' }),
    }
    const sheet = chargingSheet()
    sheet.actions[0].actions = [
      sheetAction({
        id: 'staff',
        name: 'Staff of Stars',
        uses: counted(4, 10, { item: 'staff' }),
        activities: [{ ...wisp, id: 'staffFirst01', uses: null }, wisp],
      }),
    ]
    render(
      <Charging actions={{ spend }}>
        <ActionsTab
          characterId='char-ember'
          sheet={toTableSheet(sheet, GAME)}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
        />
      </Charging>,
    )

    await user.click(
      screen.getByRole('button', { name: /^Staff of Stars/, expanded: false }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Spend Staff of Stars (Starry Wisp): 2 of 2 left',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'One more' }))
    await user.click(screen.getByRole('button', { name: 'Spend 2' }))
    expect(spend).toHaveBeenCalledWith(
      { item: 'staff', activity: 'staffWisp001' },
      2,
      'Staff of Stars (Starry Wisp)',
    )
  })

  it('keeps the count beside a plain Use however narrow the list, as with any module', async () => {
    const user = userEvent.setup()
    answering()
    const sheet = chargingSheet()
    // As from a module before 0.29.0.
    sheet.actions[0].actions[0].uses = { value: 8, max: 20, recovery: null }
    render(pane(sheet, ['use']))
    await show(user, 'Actions')

    const row = screen
      .getByRole('button', { name: 'Use Sorcery Points' })
      .closest('li')!
    const count = within(row).getByText('8 of 20 uses left')
    expect(count.closest('.hidden')).toBeNull()
  })

  it.each<[string, Partial<SheetAction>]>([
    ['an attack', { toHit: 5, attackId: 'boltAttack01' }],
    [
      'an enchantment',
      {
        activity: enchantUse('boltCoat0001', {
          self: true,
          profiles: [
            { id: 'venomProfile01', name: 'Venom', min: null, max: null },
          ],
        }),
      },
    ],
  ])(
    'still folds the count away in a narrow list beside %s',
    async (_name, rolls) => {
      const user = userEvent.setup()
      answering()
      const sheet = chargingSheet()
      sheet.actions[0].actions.push(
        sheetAction({
          id: 'bolt',
          name: 'Fire Bolt',
          uses: counted(1, 2, { item: 'bolt' }),
          ...rolls,
        }),
      )
      render(pane(sheet, ['use', 'attack']))
      await show(user, 'Actions')

      const row = screen
        .getByRole('button', { name: /^Fire Bolt/, expanded: false })
        .closest('li')!
      expect(
        within(row).getByText('1 of 2 uses left').closest('.hidden'),
      ).not.toBeNull()
    },
  )

  it('spends a count folded away beside an attack from its open row, however narrow the list', async () => {
    const user = userEvent.setup()
    const posted = answering()
    const sheet = chargingSheet()
    sheet.actions[0].actions.push(
      sheetAction({
        id: 'bolt',
        name: 'Fire Bolt',
        toHit: 5,
        attackId: 'boltAttack01',
        uses: counted(1, 2, { item: 'bolt' }),
      }),
    )
    render(pane(sheet))
    await show(user, 'Actions')

    await user.click(
      screen.getByRole('button', { name: /^Fire Bolt/, expanded: false }),
    )
    const row = screen
      .getByRole('button', { name: /^Fire Bolt/, expanded: true })
      .closest('li')!
    const [beside, open] = within(row).getAllByRole('button', {
      name: 'Spend Fire Bolt: 1 of 2 left',
    })
    expect(beside.closest('.hidden')).not.toBeNull()
    // Among its facts, where the count beside it is folded away, and only there.
    expect(open.closest('dd')).toHaveTextContent('1 of 2 left, Long Rest')
    expect(open.closest('.hidden')).toBeNull()
    expect(open).toHaveClass('@md:hidden')
    await user.click(open)
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    expect(posted).toEqual([
      { kind: 'spend', counter: { item: 'bolt' }, count: 1, ...PLAIN },
    ])

    // A count beside a plain Use is never folded away, so its facts spend nothing.
    await user.click(
      screen.getByRole('button', { name: /^Sorcery Points/, expanded: false }),
    )
    expect(
      screen.getAllByRole('button', {
        name: 'Spend Sorcery Points: 8 of 20 left',
      }),
    ).toHaveLength(1)
  })

  it('says a folded count only once among its facts where the game takes no spending', async () => {
    const user = userEvent.setup()
    answering()
    const sheet = chargingSheet()
    sheet.actions[0].actions.push(
      sheetAction({
        id: 'bolt',
        name: 'Fire Bolt',
        toHit: 5,
        attackId: 'boltAttack01',
        uses: counted(1, 2, { item: 'bolt' }),
      }),
    )
    render(pane(sheet, ['use', 'attack']))
    await show(user, 'Actions')

    await user.click(
      screen.getByRole('button', { name: /^Fire Bolt/, expanded: false }),
    )
    const row = screen
      .getByRole('button', { name: /^Fire Bolt/, expanded: true })
      .closest('li')!
    expect(within(row).getByText('1 of 2 left, Long Rest')).toBeInTheDocument()
    // Beside it, folded away; never again among the facts.
    expect(within(row).getAllByText('1 of 2 uses left')).toHaveLength(1)
    expect(within(row).queryByRole('button', { name: /^Spend / })).toBeNull()
  })

  it.each([
    ['a list', undefined],
    ['the Actions table', 'table'],
  ] as const)(
    "names an item's own count by the item in %s, whichever of its activities the row is for",
    async (_name, layout) => {
      const user = userEvent.setup()
      const spend = jest.fn()
      const sheet = chargingSheet()
      sheet.actions[0].actions = [
        sheetAction({
          id: 'staff',
          name: 'Staff',
          activityName: 'Silvery Barbs',
          activation: 'Reaction',
          activity: utilityUse('staffBarbs01'),
          uses: counted(4, 10, { item: 'staff' }),
        }),
      ]
      render(
        <Charging actions={{ spend }}>
          <ActionsTab
            characterId='char-ember'
            sheet={toTableSheet(sheet, GAME)}
            onRoll={jest.fn()}
            onRollDamage={jest.fn()}
            layout={layout}
          />
        </Charging>,
      )

      await user.click(counter('Staff', 4, 10))
      await user.click(
        within(screen.getByRole('dialog', { name: 'Spend Staff' })).getByRole(
          'button',
          { name: 'Spend 1' },
        ),
      )
      expect(spend).toHaveBeenCalledWith({ item: 'staff' }, 1, 'Staff')
    },
  )
})

describe('a Use with nothing left, from module 0.29.0', () => {
  it('is greyed out where it spends the counter its row shows, at 0, and does nothing', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane())
    await show(user, 'Actions')

    const lucky = useOf('Lucky')
    expect(lucky).toHaveAttribute('aria-disabled', 'true')
    expect(lucky).toHaveAttribute('title', 'None left')
    await user.click(lucky)
    expect(posted).toEqual([])
    // With some left, it's used.
    expect(useOf('Sorcery Points')).not.toHaveAttribute('aria-disabled')
  })

  it.each<[string, (sheet: CharacterSheet) => void]>([
    [
      'where it spends another counter',
      sheet => {
        sheet.actions[0].actions[1].activity = utilityUse('luckyUse', [
          { counter: { resource: 'primary' }, amount: 1 },
        ])
      },
    ],
    [
      'as from a module before 0.29.0, which says neither',
      sheet => {
        sheet.actions[0].actions[1].uses = { value: 0, max: 3, recovery: null }
        sheet.actions[0].actions[1].activity = utilityUse('luckyUse')
      },
    ],
    [
      'where using it gives some back, as Staff of the Magi’s Spell Absorption does its charges',
      sheet => {
        sheet.actions[0].actions[1].activity = utilityUse('luckyUse', [
          { counter: { item: 'lucky' }, amount: -1 },
        ])
      },
    ],
    [
      'where using it costs none',
      sheet => {
        sheet.actions[0].actions[1].activity = utilityUse('luckyUse', [
          { counter: { item: 'lucky' }, amount: 0 },
        ])
      },
    ],
  ])('is not, %s', async (_name, change) => {
    const user = userEvent.setup()
    const posted = answering()
    const sheet = chargingSheet()
    change(sheet)
    render(pane(sheet))
    await show(user, 'Actions')

    const lucky = useOf('Lucky')
    expect(lucky).not.toHaveAttribute('aria-disabled')
    expect(lucky).not.toHaveAttribute('title')
    await user.click(lucky)
    expect(posted).toEqual([
      expect.objectContaining({ kind: 'use', item: 'lucky' }),
    ])
  })
})

describe('Heroic Inspiration, from module 0.29.0', () => {
  it.each([
    [true, 'Inspired', 'Inspired. Use Heroic Inspiration', 'Use', 'use'],
    [
      false,
      'Not inspired',
      'Not inspired. Gain Heroic Inspiration',
      'Gain',
      'gain',
    ],
  ] as const)(
    'with inspiration %p, offers %p, asking first',
    async (inspired, shown, label, verb, inspiration) => {
      const user = userEvent.setup()
      const posted = answering({ 'req-1': DONE })
      render(pane(chargingSheet({ inspiration: inspired })))

      const button = screen.getByRole('button', { name: label })
      expect(button).toHaveTextContent(shown)
      await user.click(button)
      const asked = screen.getByRole('dialog', {
        name: `${verb} Heroic Inspiration?`,
      })
      expect(asked).toHaveTextContent('Foundry’s chat will say so.')
      await user.click(within(asked).getByRole('button', { name: 'Cancel' }))
      expect(posted).toEqual([])

      await user.click(button)
      await user.click(
        within(
          screen.getByRole('dialog', { name: `${verb} Heroic Inspiration?` }),
        ).getByRole('button', { name: verb }),
      )
      expect(posted).toEqual([{ kind: 'inspiration', inspiration, ...PLAIN }])
      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            `Heroic Inspiration${verb === 'Use' ? 'Used' : 'Gained'} at the table`,
          ),
        { timeout: 5000 },
      )
    },
  )

  it.each([
    [false, 'Not inspired. Gain Heroic Inspiration', 'Gain', 'gain'],
    [true, 'Inspired. Use Heroic Inspiration', 'Use', 'use'],
  ] as const)(
    'with inspiration %p, does what its confirm was opened for, however the sheet changes meanwhile',
    async (inspired, label, verb, inspiration) => {
      const user = userEvent.setup()
      const posted = answering()
      const { rerender } = render(
        pane(chargingSheet({ inspiration: inspired })),
      )

      await user.click(screen.getByRole('button', { name: label }))
      // The Gamemaster changes it in Foundry while the player reads the confirm.
      rerender(pane(chargingSheet({ inspiration: !inspired })))
      expect(screen.queryByRole('button', { name: label })).toBeNull()
      const asked = screen.getByRole('dialog', {
        name: `${verb} Heroic Inspiration?`,
      })
      await user.click(within(asked).getByRole('button', { name: verb }))
      expect(posted).toEqual([{ kind: 'inspiration', inspiration, ...PLAIN }])
    },
  )

  it('shows only the mark, while inspired, where the game takes it not', () => {
    answering()
    const { rerender } = render(
      pane(chargingSheet({ inspiration: true }), ['use']),
    )
    expect(screen.getByText('Inspired')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Heroic Inspiration/ }),
    ).toBeNull()

    rerender(pane(chargingSheet({ inspiration: false }), ['use']))
    expect(screen.queryByText('Inspired')).toBeNull()
    expect(screen.queryByText('Not inspired')).toBeNull()
  })
})

describe("the Gamemaster's page, from module 0.29.0", () => {
  it('spends charges and changes Heroic Inspiration, named for the player to be shown them by', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(
      pane(
        chargingSheet({ inspiration: true }),
        ['use', 'spend', 'inspiration'],
        GM,
      ),
    )
    await show(user, 'Features')

    await user.click(
      screen.getByRole('button', {
        name: 'Spend Sorcery Points: 8 of 20 left',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Spend 1' }))
    await show(user, 'Character')
    await user.click(
      screen.getByRole('button', { name: 'Inspired. Use Heroic Inspiration' }),
    )
    await user.click(screen.getByRole('button', { name: 'Use' }))

    expect(posted).toEqual([
      {
        kind: 'spend',
        counter: { item: 'sorcery' },
        count: 1,
        ...PLAIN,
        label: 'Sorcery Points',
      },
      {
        kind: 'inspiration',
        inspiration: 'use',
        ...PLAIN,
        label: 'Heroic Inspiration',
      },
    ])
  })
})

describe('the tray and toasts, from module 0.29.0', () => {
  const tableOf = (state: TableRollState): TableRolls => ({
    states: new Map([['u1', state]]),
    available: true,
    sending: true,
  })
  const trayOf = (roll: LocalUse, state: TableRollState) => {
    const { unmount } = render(
      <RollTray rolls={[roll]} rolling={false} table={tableOf(state)} />,
    )
    const text = screen.getByRole('status').textContent
    unmount()
    return text
  }
  const done: TableRollState = { status: 'done', visible: true, rolls: [] }

  it.each([
    [
      'a concentration ended',
      use({ label: 'Concentration on Bless', ending: true }),
      ['Ending it', 'Ended at the table', 'Not ended at the table', 'ended'],
      'concentration',
      'that concentration has already ended',
    ],
    [
      'charges spent',
      use({ spent: 2 }),
      [
        'Spending 2',
        'Spent 2 at the table',
        'Not spent at the table',
        'spent 2',
      ],
      'short',
      'you haven’t that many left',
    ],
    [
      'Heroic Inspiration used',
      use({ label: 'Heroic Inspiration', inspiration: 'use' }),
      ['Using it', 'Used at the table', 'Not used at the table', 'used'],
      'not-inspired',
      'you have no Heroic Inspiration to use',
    ],
    [
      'Heroic Inspiration gained',
      use({ label: 'Heroic Inspiration', inspiration: 'gain' }),
      [
        'Gaining it',
        'Gained at the table',
        'Not gained at the table',
        'gained',
      ],
      'inspired',
      'you have Heroic Inspiration already',
    ],
  ] as const)(
    'words %s on its way, done and not done, and in its toast',
    (_name, roll, [doing, made, notMade, brief], reason, why) => {
      expect(trayOf(roll, { status: 'rolling' })).toBe(
        `${roll.label}${doing} in your Gamemaster’s game…`,
      )
      expect(trayOf(roll, done)).toBe(`${roll.label}${made}`)
      expect(trayOf(roll, { status: 'failed', reason })).toBe(
        `${roll.label}${notMade}: ${why}`,
      )
      // Among the earlier rolls, what it was.
      const { unmount } = render(
        <RollTray
          rolls={[use({ id: 'later', label: 'Later' }), roll]}
          rolling={false}
          table={{ states: new Map(), available: true, sending: true }}
        />,
      )
      act(() => screen.getByText('Earlier rolls (1)').click())
      expect(screen.getByRole('listitem')).toHaveTextContent(
        `${roll.label}${brief}`,
      )
      unmount()
      expect(briefOf(roll, done)).toMatchObject({
        label: roll.label,
        badge: 'use',
        table: { tone: 'made', text: made },
      })
    },
  )

  it('says the spend’s count, and what each was, in the tray’s earlier rolls', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          use({ id: 'u0', label: 'Lucky', spent: 1 }),
          use({ spent: 2 }),
          use({ id: 'u2', label: 'Concentration on Bless', ending: true }),
          use({ id: 'u3', label: 'Heroic Inspiration', inspiration: 'gain' }),
        ]}
        rolling={false}
        table={{
          states: new Map(),
          available: true,
          sending: true,
        }}
      />,
    )
    await user.click(screen.getByText('Earlier rolls (3)'))
    expect(
      screen.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'Sorcery Pointsspent 2',
      'Concentration on Blessended',
      'Heroic Inspirationgained',
    ])
  })

  it.each([
    ['spend', 'Spending it', 'Spent at the table', 'Not spent at the table'],
    [
      'inspiration',
      'Changing it',
      'Changed at the table',
      'Not changed at the table',
    ],
  ] as const)(
    "words the Gamemaster's %s as the character, on its player's page, with no total",
    (rolled, doing, made, notMade) => {
      const gm: LocalGmRoll = {
        kind: 'gm',
        id: 'gm:req-1',
        label: 'Sorcery Points',
        rolled,
        at: 0,
      }
      expect(briefOf(gm, { status: 'rolling' }).table?.text).toBe(
        `${doing} in your Gamemaster’s game…`,
      )
      expect(briefOf(gm, done)).toMatchObject({
        badge: 'use',
        table: { text: made },
      })
      expect(
        briefOf(gm, { status: 'failed', reason: 'short' }).table?.text,
      ).toBe(`${notMade}: you haven’t that many left`)
    },
  )

  it.each([
    ['uses', 'that can’t be spent from Sending Stone'],
    ['short', 'you haven’t that many left'],
  ])('words a spend refused %p', (reason, why) => {
    expect(trayOf(use({ spent: 3 }), { status: 'failed', reason })).toBe(
      `Sorcery PointsNot spent at the table: ${why}`,
    )
  })
})

/** Every kind from module 0.29.0, a use, and from module 0.42.1 spell slots. */
const SLOT_KINDS: RollKind[] = [...KINDS, 'spellSlot']

/**
 * Ember's slots: 3 of 4 at 1st level, Shield among its spells, and pact magic's 1 of 2 at 3rd;
 * and, where asked, a favorite of her 1st-level slots and Shield among her actions.
 */
const slotsSheet = (
  first = 3,
  fields: Partial<CharacterSheet> = {},
): CharacterSheet =>
  chargingSheet({
    spellcasting: { ability: 'cha', dc: 13, attack: 5, classes: [] },
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: first, max: 4, level: 1 },
        spells: [sheetSpell({ id: 'shield', name: 'Shield' })],
      },
      {
        id: 'pact',
        label: 'Pact Magic',
        slots: { value: 1, max: 2, level: 3 },
        spells: [],
      },
    ],
    ...fields,
  })
const favoredSheet = (first = 3) =>
  slotsSheet(first, {
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'shield',
            name: 'Shield',
            type: 'spell',
            level: 1,
          }),
        ],
      },
    ],
    favorites: [
      {
        type: 'slots',
        id: 'spell1',
        name: '1st Level',
        value: first,
        max: 4,
        level: 1,
      },
    ],
  })

/** The Spells tab's 1st Level. */
const firstLevel = () => screen.getByRole('region', { name: '1st Level' })
const dotsOf = (scope: HTMLElement, name = '1st-level spell slots') =>
  within(within(scope).getByRole('group', { name })).getAllByRole('button')
/** A dot's name, as the button that spends or restores one is named. */
const DOT = /^(Spend|Restore) a .*slot/
const noDots = () =>
  expect(screen.queryByRole('button', { name: DOT })).toBeNull()

const later = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

/** The game: the request taken, or refused `changed`; then where it stands, as `answer` is. */
const following = (
  answer: { current: Record<string, unknown> },
  taken = true,
) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: taken,
        status: taken ? 202 : 422,
        json: async () =>
          taken ? { id: 'req-1' } : { error: 'changed', reason: 'changed' },
      } as Response
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'req-1', ...answer.current }),
    } as Response
  }) as typeof fetch
  return posted
}
const setup = async (answer: { current: Record<string, unknown> }) => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  const posted = following(answer)
  const view = render(pane(slotsSheet(), SLOT_KINDS))
  await show(user, 'Spells')
  await user.click(dotsOf(firstLevel())[0])
  await user.click(screen.getByRole('button', { name: 'Spend' }))
  // What the confirm does is a transition's, drawn once the timers run.
  await later(0)
  expect(posted).toHaveLength(1)
  return { user, posted, ...view }
}
const waits = () => {
  const group = within(firstLevel()).getByRole('group', {
    name: '1st-level spell slots',
  })
  const dimmed = dotsOf(firstLevel()).map(dot =>
    dot.getAttribute('aria-disabled'),
  )
  if (dimmed.every(each => each === 'true')) {
    expect(group).toHaveAttribute('aria-busy', 'true')
    return true
  }
  expect(dimmed.every(each => each === null)).toBe(true)
  expect(group).not.toHaveAttribute('aria-busy')
  return false
}

describe('spell slots spent and restored from the dots, from module 0.42.1 (round 0.42.1 §U.1)', () => {
  it("makes the Spells tab's dots buttons, and spends one once asked, from the count shown, its line among the rolls", async () => {
    const user = userEvent.setup()
    const posted = answering({ 'req-1': DONE })
    render(pane(slotsSheet(), SLOT_KINDS))
    await show(user, 'Spells')

    const dots = dotsOf(firstLevel())
    expect(dots.map(dot => dot.getAttribute('aria-label'))).toEqual([
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Spend a 1st-level spell slot, 3 of 4 left',
      'Restore a 1st-level spell slot, 3 of 4 left',
    ])
    expect(
      dotsOf(
        screen.getByRole('region', { name: 'Pact Magic' }),
        'Pact Magic slots (3rd level)',
      ),
    ).toHaveLength(2)
    // The heading's row wraps the dots beneath its heading before anything scrolls sideways.
    expect(
      within(firstLevel()).getByRole('heading', { name: '1st Level' })
        .parentElement,
    ).toHaveClass('flex-wrap', 'gap-x-3', 'gap-y-1')

    await user.click(dots[0])
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Spend a 1st-level spell slot?' }),
      ).getByRole('button', { name: 'Spend' }),
    )
    expect(posted).toEqual([
      {
        kind: 'spellSlot',
        spellSlot: { op: 'spend', id: 'spell1', from: 3 },
        ...PLAIN,
      },
    ])
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          '1st-level spell slotSpent at the table',
        ),
      { timeout: 5000 },
    )
  })

  it("restores a pact slot once asked, its line named for pact magic's slot", async () => {
    const user = userEvent.setup()
    const posted = answering({ 'req-1': DONE })
    render(pane(slotsSheet(), SLOT_KINDS))
    await show(user, 'Spells')

    const pact = dotsOf(
      screen.getByRole('region', { name: 'Pact Magic' }),
      'Pact Magic slots (3rd level)',
    )
    await user.click(pact[1])
    const asked = screen.getByRole('dialog', {
      name: 'Restore a pact slot (3rd level)?',
    })
    expect(asked).toHaveTextContent(
      '1 of 2 left, 2 once it’s restored. Foundry’s chat will say so.',
    )
    await user.click(within(asked).getByRole('button', { name: 'Restore' }))
    expect(posted).toEqual([
      {
        kind: 'spellSlot',
        spellSlot: { op: 'restore', id: 'pact', from: 1 },
        ...PLAIN,
      },
    ])
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Pact slot (3rd level)Restored at the table',
        ),
      { timeout: 5000 },
    )
  })

  it('keeps the dots pictures with Send to the table off on this device', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.setItem(SEND_KEY, 'off')
    answering()
    render(pane(slotsSheet(), SLOT_KINDS))
    await show(user, 'Spells')

    noDots()
    expect(within(firstLevel()).getByText('3/4')).toBeInTheDocument()
    expect(
      firstLevel().querySelectorAll('.rounded-full.border-2'),
    ).toHaveLength(4)
  })

  it('keeps the dots pictures with a module before 0.42.1, which lists charges and Heroic Inspiration but no spell slots', async () => {
    const user = userEvent.setup()
    answering()
    render(
      pane(favoredSheet(), ['use', 'endConcentration', 'spend', 'inspiration']),
    )
    await show(user, 'Spells')

    noDots()
    expect(
      within(firstLevel()).getByText('3 of 4 spell slots left'),
    ).toBeVisible()
    // Its favorite's row as before, the pictures beside the name.
    const row = within(screen.getByRole('region', { name: 'Favorites' }))
      .getByText('Spell slots')
      .closest('li')?.firstElementChild
    expect(row).not.toHaveClass('max-sm:flex-wrap')
    expect(row?.querySelector(String.raw`.max-sm\:basis-full`)).toBeNull()
  })

  it("keeps a companion's dots pictures, as the app never lists spell slots among a companion's kinds", async () => {
    const user = userEvent.setup()
    answering()
    // As the app keeps a companion's kinds from the module's: never one it can't take.
    const companionKinds = ROLL_KINDS.filter(
      kind => !(COMPANION_UNTAKEN as readonly string[]).includes(kind),
    )
    render(
      <CharacterPane
        characterId='seat-1:c:imp'
        name='Quill'
        sheet={toTableSheet(slotsSheet(), GAME)}
        rollsToTable={companionKinds}
        creature={{ name: 'Quill', relation: { kind: 'owned', of: 'Ember' } }}
        idPrefix='creature-quill-'
      />,
    )
    await show(user, 'Spells')

    noDots()
    expect(
      within(firstLevel()).getByText('3 of 4 spell slots left'),
    ).toBeVisible()
  })

  it("keeps a shaped druid's dots pictures, as her slots wait, and makes them buttons once she's back", async () => {
    const user = userEvent.setup()
    answering()
    const { rerender } = render(pane(shapedSheet(), SLOT_KINDS))
    await show(user, 'Spells')
    noDots()
    expect(
      within(firstLevel()).getByText('4 of 4 spell slots left'),
    ).toBeVisible()

    rerender(pane(druidSheet(), SLOT_KINDS))
    expect(dotsOf(firstLevel())).toHaveLength(4)
  })

  it("spends and restores from the Gamemaster's page, named for the player to be shown them by", async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane(slotsSheet(), SLOT_KINDS, GM))
    await show(user, 'Spells')

    await user.click(dotsOf(firstLevel())[3])
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(posted).toEqual([
      {
        kind: 'spellSlot',
        spellSlot: { op: 'restore', id: 'spell1', from: 3 },
        ...PLAIN,
        label: '1st-level spell slot',
      },
    ])
  })

  it.each([
    ['spend', { status: 'done', visible: true }, 'Spent at the table'],
    ['restore', { status: 'done', visible: true }, 'Restored at the table'],
    [
      'restore',
      { status: 'failed', reason: 'full' },
      'Not restored at the table: none is used',
    ],
    [
      'spend',
      { status: 'failed', reason: 'changed' },
      'Not spent at the table: the slots changed in Foundry; look again',
    ],
  ] as const)(
    "words the Gamemaster's %s on the player's page: %o",
    (slotOp, made, words) => {
      answering()
      const view: GmRollView = {
        id: 'req-9',
        kind: 'spellSlot',
        label: '1st-level spell slot',
        at: '2026-10-29T03:00:00.000Z',
        slotOp,
        ...made,
      }
      render(
        <CharacterPane
          characterId='char-ember'
          name='Ember'
          sheet={toTableSheet(slotsSheet(), GAME)}
          rollsToTable={SLOT_KINDS}
          gmRolls={[view]}
        />,
      )
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('1st-level spell slot')
      expect(status).toHaveTextContent(words)
    },
  )

  it("makes a spell-slots favorite's dots buttons on the Actions tab, beneath its name on a phone, while the Actions tab's own heading keeps its pictures", async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane(favoredSheet(), SLOT_KINDS))
    await show(user, 'Actions')

    const favorites = screen.getByRole('region', { name: 'Favorites' })
    const dots = dotsOf(favorites)
    expect(dots).toHaveLength(4)
    expect(dots[0].closest('li')?.firstElementChild).toHaveClass(
      'max-sm:flex-wrap',
    )
    // The Actions tab's own heading of the level: the count alone, a tap opening or closing it.
    const level = screen.getByRole('group', { name: '1st Level' })
    expect(within(level).queryByRole('button', { name: DOT })).toBeNull()
    expect(level).toHaveTextContent('3 of 4 spell slots left')

    // A right-click on a dot, or on the confirm's words, is never the row's.
    fireEvent.contextMenu(dots[0])
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(dots[0])
    const asked = screen.getByRole('dialog', {
      name: 'Spend a 1st-level spell slot?',
    })
    fireEvent.contextMenu(within(asked).getByText(/3 of 4 left/))
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(within(asked).getByRole('button', { name: 'Spend' }))
    expect(posted).toEqual([
      {
        kind: 'spellSlot',
        spellSlot: { op: 'spend', id: 'spell1', from: 3 },
        ...PLAIN,
      },
    ])
  })

  it('makes the favorite’s dots buttons on the Spells tab too, beside its heading’s', async () => {
    const user = userEvent.setup()
    answering()
    render(pane(favoredSheet(), SLOT_KINDS))
    await show(user, 'Spells')

    expect(
      dotsOf(screen.getByRole('region', { name: 'Favorites' })),
    ).toHaveLength(4)
    expect(dotsOf(firstLevel())).toHaveLength(4)
  })

  describe('waiting for the game, as an effect does (round 0.42.1 §U.0.8.12)', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('waits while the request is on its way, however long, and a tap meanwhile asks nothing and sends nothing', async () => {
      const { user, posted } = await setup({ current: { status: 'sending' } })

      expect(waits()).toBe(true)
      await later(15_000)
      expect(waits()).toBe(true)
      await user.click(dotsOf(firstLevel())[0])
      await user.click(dotsOf(firstLevel())[3])
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted).toHaveLength(1)
    })

    it('waits once made until the sheet shows the count moved, then is live again', async () => {
      const answer = {
        current: { status: 'sending' } as Record<string, unknown>,
      }
      const { rerender } = await setup(answer)

      answer.current = { status: 'done', visible: true, rolls: [] }
      await later(1000)
      expect(screen.getByRole('status')).toHaveTextContent(
        '1st-level spell slotSpent at the table',
      )
      // Made, with the sheet as it was: it waits for the sheet that comes.
      expect(waits()).toBe(true)
      rerender(pane(slotsSheet(2), SLOT_KINDS))
      expect(waits()).toBe(false)
      expect(dotsOf(firstLevel())[0]).toHaveAccessibleName(
        'Spend a 1st-level spell slot, 2 of 4 left',
      )
    })

    it('is live again once made and the settle time has passed, though the sheet never moved', async () => {
      await setup({ current: { status: 'done', visible: true, rolls: [] } })

      await later(1000)
      expect(waits()).toBe(true)
      await later(8500)
      expect(waits()).toBe(true)
      await later(600)
      expect(waits()).toBe(false)
    })

    it('is live again at once where the app refuses it', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const posted = following({ current: {} }, false)
      render(pane(slotsSheet(), SLOT_KINDS))
      await show(user, 'Spells')
      await user.click(dotsOf(firstLevel())[0])
      await user.click(screen.getByRole('button', { name: 'Spend' }))
      await later(0)

      expect(waits()).toBe(false)
      expect(screen.getByRole('status')).toHaveTextContent(
        '1st-level spell slotNot spent at the table: the slots changed in Foundry; look again',
      )
      // It can be tried again.
      await user.click(dotsOf(firstLevel())[0])
      await user.click(screen.getByRole('button', { name: 'Spend' }))
      expect(posted).toHaveLength(2)
    })
  })
})
