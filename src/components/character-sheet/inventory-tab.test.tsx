/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InventoryTab } from './inventory-tab'
import {
  characterSheet,
  fullerSheet,
  sheetItem,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetInventory } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <InventoryTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

const withInventory = (inventory: Partial<SheetInventory>) =>
  fullerSheet({ inventory: { ...fullerSheet().inventory, ...inventory } })

const rows = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .filter(item => item.parentElement === list)
    .map(item => item.querySelector('summary, div')?.textContent)

const chevron = (name: string) =>
  screen.getByText(name).closest('summary')?.lastElementChild

const fact = (label: string) => screen.getByText(label).parentElement

describe('components/character-sheet/inventory-tab', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ html: '<p>Sturdy and well kept.</p>' }),
        }) as Response,
    )
  })

  it("shows the character's coin, load and attunement", () => {
    renderTab()

    expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual([
      'Currency',
      'Encumbrance',
      'Attunement',
    ])
    const [currency, encumbrance, attunement] =
      screen.getAllByRole('definition')
    expect(
      within(currency)
        .getAllByRole('listitem')
        .map(coin => coin.textContent),
    ).toEqual(['2 PP', '41 GP', '0 SP'])
    expect(screen.getByTitle('Silver')).toHaveClass('text-text-secondary')
    expect(screen.getByTitle('Gold')).not.toHaveClass('text-text-secondary')
    expect(encumbrance).toHaveTextContent('62.5 / 270 lb')
    expect(attunement).toHaveTextContent('2 / 3')
  })

  it('draws the load against the most the character can carry, marking where encumbrance begins', () => {
    renderTab()

    const bar = screen
      .getByText('62.5')
      .closest('dd')
      ?.querySelector('[aria-hidden]') as HTMLElement
    const [fill, encumbered, heavily] = [...bar.children] as HTMLElement[]
    expect(fill).toHaveClass('bg-primary')
    expect(fill.style.width).toMatch(/^23\.14/)
    expect(encumbered.style.left).toMatch(/^33\.33/)
    expect(heavily.style.left).toMatch(/^66\.66/)
  })

  it.each([
    [100, 'bg-warning'],
    [200, 'bg-danger'],
    [300, 'bg-danger'],
  ])('colours a load of %i lb %s', (value, colour) => {
    renderTab(
      withInventory({
        encumbrance: {
          value,
          max: 270,
          units: 'lb',
          encumbered: 90,
          heavilyEncumbered: 180,
        },
      }),
    )

    const bar = screen
      .getByText(String(value))
      .closest('dd')
      ?.querySelector('[aria-hidden]') as HTMLElement
    expect(bar.firstElementChild).toHaveClass(colour)
    expect((bar.firstElementChild as HTMLElement).style.width).not.toBe('')
  })

  it('shows a load without thresholds or a limit as it is', () => {
    renderTab(
      withInventory({
        encumbrance: {
          value: 400,
          max: 270,
          units: 'lb',
          encumbered: null,
          heavilyEncumbered: null,
        },
        attunement: { value: 1, max: null },
        currency: [],
      }),
    )

    const encumbrance = screen.getByText('Encumbrance').nextSibling
    const bar = (encumbrance as HTMLElement).querySelector(
      '[aria-hidden]',
    ) as HTMLElement
    expect(bar.children).toHaveLength(1)
    expect(bar.firstElementChild).toHaveClass('bg-danger')
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%')
    expect(screen.getByText('Attunement').nextSibling).toHaveTextContent(/^1$/)
    expect(screen.queryByText('Currency')).toBeNull()
  })

  it('shows a load with no limit without a bar', () => {
    renderTab(
      withInventory({
        encumbrance: {
          value: 12,
          max: null,
          units: 'kg',
          encumbered: null,
          heavilyEncumbered: null,
        },
      }),
    )

    const encumbrance = screen.getByText('Encumbrance')
      .nextSibling as HTMLElement
    expect(encumbrance).toHaveTextContent('12 kg')
    expect(encumbrance.querySelector('[aria-hidden]')).toBeNull()
  })

  it('lists items by type, with what is equipped, attuned and carried', () => {
    renderTab()

    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['Weapons', 'Equipment', 'Containers'])
    const weapons = within(
      screen.getByRole('region', { name: 'Weapons' }),
    ).getByRole('list')
    expect(rows(weapons)).toEqual([
      'WarhammerEquipped · 5 lb · 15 GP',
      'Handaxe4 lb · 5 GP×2',
    ])
    expect(weapons.querySelector('img')).toHaveAttribute(
      'src',
      'https://my-game.forge-vtt.com/icons/weapons/hammers/hammer-war.webp',
    )
    const equipment = within(
      screen.getByRole('region', { name: 'Equipment' }),
    ).getByRole('list')
    expect(rows(equipment)).toEqual([
      'Plain RingEquipped · Attuned',
      'Cloak of ProtectionEquipped · Attuned2/32 of 3 uses left',
    ])
  })

  it('opens an item to its rarity, attunement and properties, and its description', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByText('Cloak of Protection'))
    expect(
      screen.getByText('Uncommon · Requires attunement · Magical'),
    ).toBeInTheDocument()

    await user.click(screen.getByText('Warhammer'))
    expect(await screen.findByText('Sturdy and well kept.')).toBeInTheDocument()
    const warhammer = screen.getByText('Warhammer').closest('li') as HTMLElement
    // In full, as the line under its name may be cut short.
    expect(
      within(warhammer)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual(['Weight: 5 lb', 'Price: 15 GP'])
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.warhammer}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  it("keeps an unidentified item's secrets", async () => {
    const user = userEvent.setup()
    renderTab(
      withInventory({
        sections: [
          {
            id: 'equipment',
            label: 'Equipment',
            items: [
              sheetItem({
                id: 'ring',
                name: 'Plain Ring',
                identified: false,
                attunement: 'optional',
              }),
            ],
          },
        ],
      }),
    )

    await user.click(screen.getByText('Plain Ring'))

    expect(
      screen.getByText('Not identified · Attunement optional'),
    ).toBeInTheDocument()
  })

  it('opens a container to its capacity and what it holds, containers within it too', async () => {
    const user = userEvent.setup()
    renderTab()

    const containers = within(
      screen.getByRole('region', { name: 'Containers' }),
    ).getByRole('list')
    expect(rows(containers)).toEqual(['Backpack5 lb', 'Puzzle Box'])

    await user.click(screen.getByText('Backpack'))
    const backpack = screen.getByText('Backpack').closest('li') as HTMLElement
    expect(
      within(backpack).getByText('Capacity').nextSibling,
    ).toHaveTextContent('12.5 / 30 lb')
    const inside = within(backpack).getByRole('list', {
      name: 'In the Backpack',
    })
    expect(rows(inside)).toEqual(['Hempen Rope10 lb', 'Pouch'])

    await user.click(within(inside).getByText('Pouch'))
    const pouch = within(inside).getByRole('list', { name: 'In the Pouch' })
    expect(rows(pouch)).toEqual(['Old Coin×2'])
    expect(
      within(inside).getByText('Capacity', { selector: 'dt' }).nextSibling,
    ).toHaveTextContent('2 / 6 Items')
  })

  it('marks open only the rows that are open, inside an open container too', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByText('Backpack'))

    expect(chevron('Backpack')).toHaveClass('rotate-180')
    expect(chevron('Hempen Rope')).not.toHaveClass('rotate-180')
    expect(chevron('Pouch')).not.toHaveClass('rotate-180')

    await user.click(screen.getByText('Pouch'))
    expect(chevron('Pouch')).toHaveClass('rotate-180')
    await user.click(screen.getByText('Backpack'))
    expect(chevron('Backpack')).not.toHaveClass('rotate-180')
  })

  it('puts load and attunement side by side under the coin, or either alone across', () => {
    const { unmount } = renderTab()
    expect(fact('Currency')).toHaveClass('col-span-2')
    expect(fact('Encumbrance')).not.toHaveClass('col-span-2')
    expect(fact('Attunement')).not.toHaveClass('col-span-2')
    unmount()

    renderTab(withInventory({ attunement: null }))
    expect(fact('Encumbrance')).toHaveClass('col-span-2')
  })

  it("doesn't tell what an unidentified container holds, and says when one is empty", async () => {
    const user = userEvent.setup()
    const sheet = fullerSheet()
    const [, box] = sheet.inventory.containers
    renderTab(
      withInventory({
        containers: [
          box,
          {
            ...sheetItem({ id: 'sack', name: 'Sack', type: 'container' }),
            capacity: null,
            contents: [],
          },
        ],
      }),
    )

    await user.click(screen.getByText('Puzzle Box'))
    expect(screen.getByText('Not identified')).toBeInTheDocument()
    expect(
      screen.getByText("What it holds isn't known yet."),
    ).toBeInTheDocument()

    await user.click(screen.getByText('Sack'))
    expect(screen.getByText("It's empty.")).toBeInTheDocument()
  })

  it('says so when there are no items to show, as from an older module', () => {
    renderTab(characterSheet())

    expect(screen.getByText('No items to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('term')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
