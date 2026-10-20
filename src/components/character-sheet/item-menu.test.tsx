/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { LONG_PRESS } from './roll-button'
import { PartySheet } from '@/components/party-sheet/party-sheet'
import {
  fullerSheet,
  sendingPartyView,
  sheetItem,
  tableMoves,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { TakeInto } from '@/components/transfers/take-controls'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableMoves } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/**
 * Thorin's things: a handaxe that rolls, a plain ring, a cloak, and the ring a favorite too.
 * @param rings - How many of the ring he has.
 */
const sheet = (rings = 1): CharacterSheet => {
  const fuller = fullerSheet()
  const [weapons, equipment] = fuller.inventory.sections
  return fullerSheet({
    favorites: [
      {
        type: 'item',
        id: 'ring',
        itemType: 'equipment',
        name: 'Plain Ring',
        img: null,
      },
    ],
    inventory: {
      ...fuller.inventory,
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
            ...equipment.items.map(item =>
              item.id === 'ring' ? { ...item, quantity: rings } : item,
            ),
            sheetItem({ id: 'torch', name: 'Torch', quantity: 0 }),
          ],
        },
      ],
    },
  })
}

/** Thorin's pane, with these moves, and this many of his ring. */
const pane = (moves: TableMoves | undefined, rings = 1) => (
  <CharacterPane
    characterId='char-1'
    name='Thorin Oakenshield'
    sheet={toTableSheet(sheet(rings), GAME)}
    moves={moves}
    actorId='actorThorin1'
  />
)

const renderPane = (moves: TableMoves | undefined = tableMoves()) =>
  render(pane(moves))

/** The row of an item in a section of the Inventory tab, by its name. */
const rowOf = (section: string, name: string) =>
  within(screen.getByRole('region', { name: section }))
    .getByText(name)
    .closest('summary') as HTMLElement

const own: TakeInto = {
  kind: 'own',
  actorId: 'actorThorin1',
  name: 'Thorin',
  api: '/api/characters/char-1',
}

describe('components/character-sheet/item-menu, on the character’s Inventory', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('opens a menu named for the item on a right-click, whose Send to… gives it to anyone but the character', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    const row = rowOf('Equipment', 'Plain Ring')

    expect(fireEvent.contextMenu(row, { button: 2 })).toBe(false)
    const menu = screen.getByRole('menu', { name: 'Plain Ring' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Send to…'])
    expect(within(menu).getByRole('menuitem')).toHaveAccessibleName('Send to…')
    // The row didn't open.
    expect(row.closest('details')).not.toHaveAttribute('open')

    // The row has focus as the dialog opens, for the browser to give it back to it as it closes.
    const focus = jest.spyOn(HTMLElement.prototype, 'focus')
    const showModal = jest.spyOn(HTMLDialogElement.prototype, 'showModal')
    await user.click(within(menu).getByRole('menuitem', { name: 'Send to…' }))
    expect(screen.queryByRole('menu')).toBeNull()
    const focused = focus.mock.contexts.indexOf(row)
    expect(focused).toBeGreaterThanOrEqual(0)
    expect(focus.mock.invocationCallOrder[focused]).toBeLessThan(
      showModal.mock.invocationCallOrder[0],
    )
    expect(row).toHaveFocus()
    const dialog = screen.getByRole('dialog', { name: 'Give Plain Ring' })
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map(radio => radio.getAttribute('value')),
    ).toEqual(['groupIronCo01', 'actorVex0001'])
  })

  it('opens it on a long-press of 500 ms, and the click that ends it doesn’t open the row', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    const row = rowOf('Equipment', 'Plain Ring')
    const touch = { pointerType: 'touch', clientX: 10, clientY: 10 }

    fireEvent.pointerDown(row, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS - 1))
    expect(screen.queryByRole('menu')).toBeNull()
    act(() => jest.advanceTimersByTime(1))
    expect(screen.getByRole('menu', { name: 'Plain Ring' })).toBeVisible()
    fireEvent.pointerUp(row, touch)
    fireEvent.click(row)
    expect(row.closest('details')).not.toHaveAttribute('open')
  })

  it('opens it below the row for the context menu key, and after Escape Enter opens the row', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    const row = rowOf('Equipment', 'Plain Ring')

    row.focus()
    fireEvent.contextMenu(row, { button: -1 })
    expect(screen.getByRole('menu', { name: 'Plain Ring' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    // Enter on a summary is its click, with no pointer down before it: nothing is swallowed.
    fireEvent.click(row)
    expect(row.closest('details')).toHaveAttribute('open')
  })

  it('opens it from the name of a row that rolls, whose chips keep their roll menus', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    const name = screen.getByRole('button', {
      name: /^Handaxe/,
      expanded: false,
    })

    fireEvent.contextMenu(name, { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Handaxe' })
    expect(within(menu).getByRole('menuitem')).toHaveTextContent('Send to…')
    expect(name).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{Escape}')

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Handaxe attack, +7' }),
      { button: 2 },
    )
    const rolls = screen.getByRole('menu')
    expect(rolls).not.toHaveAccessibleName('Handaxe')
    expect(
      within(rolls).getByRole('menuitem', { name: 'Roll with advantage' }),
    ).toBeVisible()
    await user.keyboard('{Escape}')

    // Choosing Send to… leaves the name focused as the dialog opens.
    fireEvent.contextMenu(name, { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Send to…' }))
    expect(screen.getByRole('dialog', { name: 'Give Handaxe' })).toBeVisible()
    expect(name).toHaveFocus()
  })

  it('opens none among the favorites, nor for an item there’s none of, nor where nothing may be given', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))

    const favorite = within(screen.getByRole('region', { name: 'Favorites' }))
      .getByText('Plain Ring')
      .closest('li') as HTMLElement
    const named = (favorite.querySelector('summary') ??
      favorite.querySelector('div')) as HTMLElement
    expect(fireEvent.contextMenu(named, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()

    const torch = within(screen.getByRole('region', { name: 'Equipment' }))
      .getByText('Torch')
      .closest('li')?.firstElementChild as HTMLElement
    expect(fireEvent.contextMenu(torch, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
    unmount()

    renderPane({ parties: [], characters: [] })
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    const ring = within(screen.getByRole('region', { name: 'Equipment' }))
      .getByText('Plain Ring')
      .closest('li')?.firstElementChild as HTMLElement
    expect(fireEvent.contextMenu(ring, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes a menu left open once the item can’t be sent, and never opens it again by itself', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))

    // Another player takes the last of it, then it's given back.
    fireEvent.contextMenu(rowOf('Equipment', 'Plain Ring'), { button: 2 })
    expect(screen.getByRole('menu', { name: 'Plain Ring' })).toBeVisible()
    rerender(pane(tableMoves(), 0))
    expect(screen.queryByRole('menu')).toBeNull()
    rerender(pane(tableMoves()))
    expect(screen.queryByRole('menu')).toBeNull()

    // The game stops taking moves a while, as when the bridge hasn't polled, then takes them again.
    fireEvent.contextMenu(rowOf('Equipment', 'Plain Ring'), { button: 2 })
    expect(screen.getByRole('menu', { name: 'Plain Ring' })).toBeVisible()
    // eslint-disable-next-line unicorn/no-useless-undefined -- no moves
    rerender(pane(undefined))
    expect(screen.queryByRole('menu')).toBeNull()
    rerender(pane(tableMoves()))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('components/character-sheet/item-menu, on a party’s sheet', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const party = (view = sendingPartyView()) => (
    <PartySheet
      api='/api/characters/char-1/party/groupIronCo01'
      role='player'
      view={view}
      takeInto={own}
    />
  )
  const renderParty = () => render(party())

  it('opens Send to… for the party’s item, whose To lacks the party', async () => {
    const user = userEvent.setup()
    renderParty()
    const row = rowOf('Loot', 'Rope')

    fireEvent.contextMenu(row, { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Rope' })).getByRole('menuitem', {
        name: 'Send to…',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Send Rope' })
    expect(within(dialog).getByText('From The Iron Company')).toBeVisible()
    const radios = within(dialog).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('value'))).toEqual([
      'groupWarden1',
      'actorThorin1',
      'actorVex0001',
      'actorBram001',
      'actorLia0001',
    ])
    expect(radios.some(radio => radio.getAttribute('checked') !== null)).toBe(
      false,
    )
  })

  it('closes a menu left open while the party’s things can’t be sent, and never opens it again by itself', async () => {
    const { rerender } = renderParty()

    fireEvent.contextMenu(rowOf('Loot', 'Rope'), { button: 2 })
    expect(screen.getByRole('menu', { name: 'Rope' })).toBeVisible()
    // The bridge hasn't polled a while, or Owner was taken away in Foundry: no moves, then back.
    rerender(party({ ...sendingPartyView(), moves: undefined }))
    expect(screen.queryByRole('menu')).toBeNull()
    rerender(party())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('lets a slow tap on Take open Take, and no item menu', async () => {
    jest.useFakeTimers()
    renderParty()
    const take = screen.getByRole('button', { name: 'Take Rope' })
    const touch = { pointerType: 'touch', clientX: 5, clientY: 5 }

    expect(fireEvent.contextMenu(take, { button: 2 })).toBe(true)
    expect(fireEvent.contextMenu(take, { button: -1 })).toBe(true)
    fireEvent.pointerDown(take, touch)
    act(() => jest.advanceTimersByTime(600))
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.pointerUp(take, touch)
    fireEvent.click(take)
    expect(screen.getByRole('dialog', { name: 'Take Rope' })).toBeVisible()
  })
})
