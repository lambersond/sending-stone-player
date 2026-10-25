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
import { CharacterPane } from './character-pane'
import { LONG_PRESS } from './roll-button'
import { PartySheet } from '@/components/party-sheet/party-sheet'
import { MOST_MOVED } from '@/constants/sending-stone'
import {
  fullerSheet,
  removalInventory,
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

/**
 * Thorin's things to remove: his handaxe, which rolls; the removal stand-ins' potions, rope,
 * vial, arrows, backpack and chest; a pebble that's a plain row; gems past what a removal can
 * say; and his rope among his favorites.
 */
const removalSheet = (): CharacterSheet => {
  const fuller = fullerSheet()
  const [weapons] = fuller.inventory.sections
  const inventory = removalInventory()
  const [consumables, loot] = inventory.sections
  return fullerSheet({
    favorites: [
      {
        type: 'item',
        id: 'ropeThorin01',
        itemType: 'loot',
        name: 'Rope',
        img: null,
      },
    ],
    inventory: {
      ...inventory,
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
        consumables,
        {
          ...loot,
          items: [
            ...loot.items,
            sheetItem({ id: 'pebbleThorin', name: 'Pebble' }),
            sheetItem({
              id: 'gemsThorin01',
              name: 'Gems',
              quantity: MOST_MOVED + 1,
            }),
          ],
        },
      ],
    },
  })
}
/** An item's row, which opens or not, in a section of the Inventory tab, by its name. */
const anyRow = (section: string, name: string) => {
  const item = within(screen.getByRole('region', { name: section }))
    .getByText(name)
    .closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}
/** A menu's items, by their names: a disabled one's reason is its description. */
const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map(item => item.getAttribute('aria-label') ?? item.textContent)
/** A row's summary, opened to show what it holds. */
const open = async (
  user: ReturnType<typeof userEvent.setup>,
  section: string,
  name: string,
  inside: string,
) => {
  await user.click(
    within(screen.getByRole('region', { name: section })).getByText(name),
  )
  await screen.findByText(inside)
}

describe('components/character-sheet/item-menu, Remove…, from module 0.33.0', () => {
  const removing = ({
    moves,
    removes = true,
  }: { moves?: TableMoves; removes?: boolean } = {}) => (
    <CharacterPane
      characterId='char-1'
      name='Thorin'
      sheet={toTableSheet(removalSheet(), GAME)}
      moves={moves}
      removes={removes}
      actorId='actorThorin1'
    />
  )
  const renderRemoving = async (
    options: Parameters<typeof removing>[0] = {},
  ) => {
    const user = userEvent.setup()
    const view = render(removing(options))
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    return { user, ...view }
  }
  beforeEach(() => {
    // Nothing answers, unless a test says: what's sent stays on its way.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('offers Remove… alone with moves off, at the item’s own name', async () => {
    await renderRemoving()
    const row = anyRow('Loot', 'Rope')

    expect(fireEvent.contextMenu(row, { button: 2 })).toBe(false)
    const menu = screen.getByRole('menu', { name: 'Rope' })
    expect(itemsOf(menu)).toEqual(['Remove…'])
    expect(
      within(menu).getByRole('menuitem', { name: 'Remove…' }),
    ).toBeEnabled()
    expect(menu).not.toHaveAttribute('aria-describedby')
  })

  it('offers Send to… then Remove… with moves on', async () => {
    await renderRemoving({ moves: tableMoves() })
    fireEvent.contextMenu(anyRow('Loot', 'Rope'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Rope' }))).toEqual([
      'Send to…',
      'Remove…',
    ])
  })

  it('opens no menu where neither may be done, leaving the browser its own', async () => {
    await renderRemoving({ removes: false })
    expect(fireEvent.contextMenu(anyRow('Loot', 'Rope'), { button: 2 })).toBe(
      true,
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers it for what a container holds, at any depth, and for a stack of none', async () => {
    const { user } = await renderRemoving()
    await open(user, 'Containers', 'Backpack', 'Bedroll')
    fireEvent.contextMenu(anyRow('Containers', 'Bedroll'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Bedroll' }))).toEqual([
      'Remove…',
    ])
    await user.keyboard('{Escape}')
    await open(user, 'Containers', 'Pouch', 'Gem')
    fireEvent.contextMenu(anyRow('Containers', 'Gem'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Gem' }))).toEqual([
      'Remove…',
    ])
    await user.keyboard('{Escape}')
    fireEvent.contextMenu(anyRow('Consumables', 'Arrows'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Arrows' }))).toEqual([
      'Remove…',
    ])
  })

  it('offers it from the name of an item that rolls', async () => {
    await renderRemoving()
    const name = screen.getByRole('button', {
      name: /^Handaxe/,
      expanded: false,
    })
    fireEvent.contextMenu(name, { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Handaxe' }))).toEqual([
      'Remove…',
    ])
  })

  it('lets a plain row take focus, and the keyboard open its menu below it', async () => {
    const { user } = await renderRemoving()
    const pebble = anyRow('Loot', 'Pebble')
    expect(pebble.tagName).toBe('DIV')
    expect(pebble).toHaveAttribute('tabindex', '0')
    pebble.focus()
    // As Shift+F10 sends it: no button, so no pointer to hang it from.
    expect(fireEvent.contextMenu(pebble, { button: -1 })).toBe(false)
    const menu = screen.getByRole('menu', { name: 'Pebble' })
    expect(itemsOf(menu)).toEqual(['Remove…'])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers none among the favorites, nor of a stack past what a removal can say', async () => {
    await renderRemoving()
    const favorite = within(screen.getByRole('region', { name: 'Favorites' }))
      .getByText('Rope')
      .closest('li') as HTMLElement
    const named = (favorite.querySelector('summary') ??
      favorite.querySelector('div')) as HTMLElement
    expect(fireEvent.contextMenu(named, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()

    expect(fireEvent.contextMenu(anyRow('Loot', 'Gems'), { button: 2 })).toBe(
      true,
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('waits while a give of the item is on its way from this page', async () => {
    const { user } = await renderRemoving({ moves: tableMoves() })
    fireEvent.contextMenu(anyRow('Loot', 'Rope'), { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Send to…' }))
    const dialog = screen.getByRole('dialog', { name: 'Give Rope' })
    await user.click(within(dialog).getByRole('button', { name: 'Give' }))

    fireEvent.contextMenu(anyRow('Loot', 'Rope'), { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Rope' })
    const remove = within(menu).getByRole('menuitem', { name: 'Remove…' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAccessibleDescription('It’s on its way already')
    // Send to… can be chosen, so the menu itself says nothing more.
    expect(menu).not.toHaveAttribute('aria-describedby')
    await user.keyboard('{Escape}')

    // Another item doesn't wait.
    fireEvent.contextMenu(anyRow('Consumables', 'Strange Vial'), { button: 2 })
    expect(screen.getByRole('menuitem', { name: 'Remove…' })).toBeEnabled()
  })

  it('waits while a give of something inside it is on its way', async () => {
    const { user } = await renderRemoving({ moves: tableMoves() })
    await open(user, 'Containers', 'Backpack', 'Bedroll')
    fireEvent.contextMenu(anyRow('Containers', 'Bedroll'), { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Send to…' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Give Bedroll' })).getByRole(
        'button',
        { name: 'Give' },
      ),
    )

    fireEvent.contextMenu(anyRow('Containers', 'Backpack'), { button: 2 })
    expect(
      within(screen.getByRole('menu', { name: 'Backpack' })).getByRole(
        'menuitem',
        { name: 'Remove…' },
      ),
    ).toBeDisabled()
  })

  it('waits while the container it’s in is being removed, and says why on the menu where nothing else may be done', async () => {
    const { user } = await renderRemoving()
    fireEvent.contextMenu(anyRow('Containers', 'Backpack'), { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Remove…' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Remove Backpack?' }),
      ).getByRole('button', { name: 'Remove' }),
    )

    await open(user, 'Containers', 'Backpack', 'Bedroll')
    fireEvent.contextMenu(anyRow('Containers', 'Bedroll'), { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Bedroll' })
    expect(itemsOf(menu)).toEqual(['Remove…'])
    const remove = within(menu).getByRole('menuitem', { name: 'Remove…' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAccessibleDescription('It’s on its way already')
    expect(menu).toHaveAccessibleDescription('It’s on its way already')
    await waitFor(() =>
      expect(menu.contains(document.activeElement)).toBe(true),
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers Send to… alone on a party’s sheet', async () => {
    render(
      <PartySheet
        api='/api/characters/char-1/party/groupIronCo01'
        role='player'
        view={sendingPartyView()}
        takeInto={own}
      />,
    )
    fireEvent.contextMenu(rowOf('Loot', 'Rope'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Rope' }))).toEqual([
      'Send to…',
    ])
  })
})

describe('components/character-sheet/item-menu, favorites, from module 0.37.0', () => {
  const favoriting = ({
    moves,
    removes = false,
    favorites = true,
  }: { moves?: TableMoves; removes?: boolean; favorites?: boolean } = {}) => (
    <CharacterPane
      characterId='char-1'
      name='Thorin'
      sheet={toTableSheet(removalSheet(), GAME)}
      moves={moves}
      removes={removes}
      favorites={favorites}
      actorId='actorThorin1'
    />
  )
  const renderFavoriting = async (
    options: Parameters<typeof favoriting>[0] = {},
  ) => {
    const user = userEvent.setup()
    const view = render(favoriting(options))
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    return { user, ...view }
  }
  beforeEach(() => {
    // Nothing answers, unless a test says: what's sent stays on its way.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('offers Add to favorites first, then Send to… and Remove…', async () => {
    await renderFavoriting({ moves: tableMoves(), removes: true })
    fireEvent.contextMenu(anyRow('Loot', 'Pebble'), { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Pebble' })
    expect(itemsOf(menu)).toEqual(['Add to favorites', 'Send to…', 'Remove…'])
    expect(
      within(menu).getByRole('menuitem', { name: 'Add to favorites' }),
    ).toBeEnabled()
  })

  it('offers Remove from favorites of a favorite, as the favorites say, alone with moves and removals off', async () => {
    await renderFavoriting()
    fireEvent.contextMenu(anyRow('Loot', 'Rope'), { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Rope' }))).toEqual([
      'Remove from favorites',
    ])
  })

  it('offers Remove from favorites alone among the favorites, where the star marks nothing', async () => {
    await renderFavoriting({ moves: tableMoves(), removes: true })
    const favorite = within(screen.getByRole('region', { name: 'Favorites' }))
      .getByText('Rope')
      .closest('li') as HTMLElement
    const named = (favorite.querySelector('summary') ??
      favorite.querySelector('div')) as HTMLElement
    expect(fireEvent.contextMenu(named, { button: 2 })).toBe(false)
    expect(itemsOf(screen.getByRole('menu', { name: 'Rope' }))).toEqual([
      'Remove from favorites',
    ])
  })

  it('sends it from the menu, then waits, saying why, with the rest of the menu as it was', async () => {
    const { user } = await renderFavoriting({ removes: true })
    const pebble = anyRow('Loot', 'Pebble')
    fireEvent.contextMenu(pebble, { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Add to favorites' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(pebble).toHaveFocus()
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          kind: 'favorite',
          favorite: { type: 'item', id: 'pebbleThorin', op: 'add' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        }),
      }),
    )

    fireEvent.contextMenu(pebble, { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Pebble' })
    expect(itemsOf(menu)).toEqual(['Add to favorites', 'Remove…'])
    const entry = within(menu).getByRole('menuitem', {
      name: 'Add to favorites',
    })
    expect(entry).toBeDisabled()
    expect(entry).toHaveAccessibleDescription('It’s on its way already')
    // Remove… can still be chosen, so the menu itself says nothing.
    expect(menu).not.toHaveAttribute('aria-describedby')
  })

  it('opens none where nothing may be done, the favorites off too', async () => {
    await renderFavoriting({ favorites: false })
    expect(fireEvent.contextMenu(anyRow('Loot', 'Pebble'), { button: 2 })).toBe(
      true,
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers an item that rolls its own entry once, from its name, as its row’s menu', async () => {
    const { user } = await renderFavoriting()
    const name = screen.getByRole('button', {
      name: /^Handaxe/,
      expanded: false,
    })
    fireEvent.contextMenu(name, { button: 2 })
    expect(itemsOf(screen.getByRole('menu', { name: 'Handaxe' }))).toEqual([
      'Add to favorites',
    ])
    await user.keyboard('{Escape}')
    // Only one menu at once: the item's, not its action's as well.
    expect(screen.queryAllByRole('menu')).toHaveLength(0)
  })
})
