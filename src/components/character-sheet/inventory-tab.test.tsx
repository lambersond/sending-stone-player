/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoriteMarks } from './favorite-mark'
import { InventoryTab } from './inventory-tab'
import { Modal } from '@/components/modal'
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
      onRoll={jest.fn()}
      onRollDamage={jest.fn()}
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

const withInventory = (inventory: Partial<SheetInventory>) =>
  fullerSheet({ inventory: { ...fullerSheet().inventory, ...inventory } })

/** Gold of the character's, 12,877 pieces, with this abbreviation. */
const gold = (abbreviation = 'GP') =>
  withInventory({
    currency: [{ id: 'gp', label: 'Gold', abbreviation, value: 12_877 }],
  })

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

  it('shows what an item rolls beside it, whether it is equipped or not, and wherever it is', async () => {
    const user = userEvent.setup()
    const sheet = fullerSheet()
    const [weapons, ...kinds] = sheet.inventory.sections
    const [backpack, ...containers] = sheet.inventory.containers
    const handaxe = {
      ...weapons.items[1],
      activation: '1 Action',
      range: 'reach 5 ft or range 20/60 ft',
      target: '1 Creature',
      toHit: 7,
      attackId: 'handaxeAttack',
      damage: [{ formula: '1d6 + 4', type: 'Slashing', healing: false }],
    }
    const potion = sheetItem({
      id: 'potion',
      name: 'Potion of Healing',
      type: 'consumable',
      quantity: 3,
      activation: '1 Bonus Action',
      activity: {
        id: 'drink',
        type: 'heal',
        targets: {
          self: true,
          area: false,
          count: null,
          perLevel: null,
          affects: 'self',
        },
      },
      damage: [{ formula: '2d4 + 2', type: 'Healing', healing: true }],
    })
    const onRoll = jest.fn()
    const onUse = jest.fn()
    render(
      <InventoryTab
        characterId='char-1'
        sheet={toTableSheet(
          {
            ...sheet,
            inventory: {
              ...sheet.inventory,
              sections: [
                { ...weapons, items: [weapons.items[0], handaxe] },
                ...kinds,
              ],
              containers: [
                {
                  ...backpack,
                  contents: [potion, ...(backpack.contents ?? [])],
                },
                ...containers,
              ],
            },
          },
          'https://my-game.forge-vtt.com',
        )}
        onRoll={onRoll}
        onRollDamage={jest.fn()}
        onUse={onUse}
      />,
    )

    const axe = screen
      .getByRole('button', { name: /^Handaxe/, expanded: false })
      .closest('li') as HTMLElement
    // What it is to carry is said of it, as of anything else carried.
    expect(within(axe).getByText('4 lb · 5 GP')).toBeInTheDocument()
    expect(within(axe).getByText('×2')).toBeInTheDocument()
    await user.click(
      within(axe).getByRole('button', { name: 'Handaxe attack, +7' }),
    )
    expect(onRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { kind: 'attack', item: 'handaxe', activity: 'handaxeAttack' },
      }),
    )
    await user.click(
      within(axe).getByRole('button', { name: /^Handaxe/, expanded: false }),
    )
    expect(
      within(axe)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Activation: 1 Action',
      'Range: reach 5 ft or range 20/60 ft',
      'Target: 1 Creature',
      'Weight: 4 lb',
      'Price: 5 GP',
      'To hit: +7',
      'Damage: 1d6 + 4 Slashing',
    ])

    await user.click(screen.getByText('Backpack'))
    await user.click(
      within(screen.getByRole('list', { name: 'In the Backpack' })).getByRole(
        'button',
        { name: 'Potion of Healing healing, 2d4 + 2' },
      ),
    )
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'potion', type: 'consumable' }),
    )
    // Nothing else carried rolls.
    expect(
      screen.getByText('Hempen Rope').closest('summary'),
    ).toBeInTheDocument()
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

  it('shortens coin from 1,000, rounding down, with the exact amount a click or tap away', async () => {
    const user = userEvent.setup()
    renderTab(
      withInventory({
        currency: [
          { id: 'pp', label: 'Platinum', abbreviation: 'PP', value: 1050 },
          { id: 'gp', label: 'Gold', abbreviation: 'GP', value: 12_877 },
          { id: 'ep', label: '', abbreviation: 'EP', value: 2_500_000 },
          { id: 'sp', label: 'Silver', abbreviation: 'SP', value: 999 },
        ],
      }),
    )

    const [currency] = screen.getAllByRole('definition')
    expect(
      within(currency)
        .getAllByRole('listitem')
        .map(coin => coin.textContent),
    ).toEqual(['1k PP', '12.8k GP', '2.5M EP', '999 SP'])
    // Each shortened amount is a button, named first for what it shows; one under 1,000 is text.
    const buttons = within(currency).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual([
      '1k PP',
      '12.8k GP',
      '2.5M EP',
    ])
    for (const button of buttons) {
      expect(button).toHaveAccessibleName(`${button.textContent}, exact amount`)
      expect(button).toHaveAttribute('aria-haspopup', 'dialog')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByRole('dialog')).toBeNull()

    const gold = screen.getByRole('button', { name: '12.8k GP, exact amount' })
    await user.click(gold)
    const exact = screen.getByRole('dialog', { name: '12,877 GP' })
    expect(exact).toHaveTextContent(/^Gold12,877 GP$/)
    expect(gold).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(exact).toHaveFocus())

    // Escape closes it, back on the amount.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gold).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(gold).toHaveFocus())

    // So does a click or tap elsewhere.
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: '12,877 GP' })).toBeVisible()
    await user.click(screen.getByText('Encumbrance'))
    expect(screen.queryByRole('dialog')).toBeNull()

    // A coin the sheet doesn't name shows only its amount.
    await user.click(
      screen.getByRole('button', { name: '2.5M EP, exact amount' }),
    )
    expect(
      screen.getByRole('dialog', { name: '2,500,000 EP' }),
    ).toHaveTextContent(/^2,500,000 EP$/)
  })

  describe('a shortened amount of coin', () => {
    it('is named for its amount alone, for a coin with no abbreviation', async () => {
      const user = userEvent.setup()
      renderTab(gold(''))

      await user.click(
        screen.getByRole('button', { name: '12.8k, exact amount' }),
      )
      expect(screen.getByRole('dialog', { name: '12,877' })).toHaveTextContent(
        /^Gold12,877$/,
      )
    })

    it('opens the exact amount above it, so that the finger that tapped it does not cover it', async () => {
      const user = userEvent.setup()
      // A 1024 by 768 window.
      for (const [side, size] of [
        ['clientWidth', 1024],
        ['clientHeight', 768],
      ] as const)
        Object.defineProperty(document.documentElement, side, {
          configurable: true,
          value: size,
        })
      try {
        renderTab(gold())
        const amount = screen.getByRole('button', {
          name: '12.8k GP, exact amount',
        })
        // 60 by 20 pixels, 100 from the left of the window and 400 from its top.
        jest
          .spyOn(amount, 'getBoundingClientRect')
          .mockReturnValue(
            DOMRect.fromRect({ x: 100, y: 400, width: 60, height: 20 }),
          )
        await user.click(amount)

        // Its middle over the amount's, 6 pixels above it.
        await waitFor(() =>
          expect(
            screen.getByRole('dialog', { name: '12,877 GP' }).style.transform,
          ).toBe('translate(130px, 394px)'),
        )
      } finally {
        for (const side of ['clientWidth', 'clientHeight'])
          Reflect.deleteProperty(document.documentElement, side)
      }
    })

    it('opens the exact amount inside a dialog it is in, as the page behind it can’t be used, where Escape closes only it', async () => {
      const user = userEvent.setup()
      const pressed: KeyboardEvent[] = []
      const keep = (event: KeyboardEvent) => {
        if (event.key === 'Escape') pressed.push(event)
      }
      globalThis.addEventListener('keydown', keep, true)
      render(
        <Modal open onClose={jest.fn()} title='Thorin'>
          <InventoryTab
            characterId='char-1'
            onRoll={jest.fn()}
            onRollDamage={jest.fn()}
            sheet={toTableSheet(gold(), 'https://my-game.forge-vtt.com')}
          />
        </Modal>,
      )

      await user.click(
        screen.getByRole('button', { name: '12.8k GP, exact amount' }),
      )
      const exact = screen.getByRole('dialog', { name: '12,877 GP' })
      expect(screen.getByRole('dialog', { name: 'Thorin' })).toContainElement(
        exact,
      )
      await waitFor(() => expect(exact).toHaveFocus())
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog', { name: '12,877 GP' })).toBeNull()
      // The key cancelled, which the browser would otherwise take to close the dialog too.
      expect(pressed.at(-1)?.defaultPrevented).toBe(true)
      await user.keyboard('{Escape}')
      expect(pressed.at(-1)?.defaultPrevented).toBe(false)
      globalThis.removeEventListener('keydown', keep, true)
    })
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

  it('stars a favorite, though it is in a container, and shows first what it is given, such as the favorites', async () => {
    const user = userEvent.setup()
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    render(
      <FavoriteMarks keys={new Set(['item:rope', 'item:cloak'])}>
        <InventoryTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
          favorites={<p>Her favorites</p>}
        />
      </FavoriteMarks>,
    )
    await user.click(screen.getByText('Backpack'))

    expect(
      screen
        .getAllByText(', favorite')
        .map(star => star.closest('summary')?.textContent?.split(',', 1)[0]),
    ).toEqual(['Cloak of Protection', 'Hempen Rope'])
    expect(
      screen
        .getByText('Her favorites')
        .compareDocumentPosition(
          screen.getByRole('heading', { name: 'Weapons' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
