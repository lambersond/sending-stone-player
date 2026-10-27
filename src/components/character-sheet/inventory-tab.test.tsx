/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoriteMarks } from './favorite-mark'
import { Favoriting } from './favoriting'
import { InventoryTab, ItemEntry } from './inventory-tab'
import { SheetFact } from './sheet-fact'
import { useWildShape, WildShaping } from './wild-shape'
import { Modal } from '@/components/modal'
import {
  Transferring,
  type TransferControls,
} from '@/components/transfers/transferring'
import {
  castingSheet,
  characterSheet,
  druidSheet,
  fullerSheet,
  offeringFavorites,
  shapedSheet,
  sheetItem,
  TEXTS,
  wolfForm,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetInventory } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

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

  it("lists a wand's spell's later activities beneath it, as the Actions tab does, from module 0.20.0", async () => {
    const user = userEvent.setup()
    const sheet = castingSheet()
    const flame = sheet.actions[0].actions[1]
    const [, hex] = flame.activities!
    // A wand whose only activity casts Hex, as the module sends it, its Cast its own rolls.
    sheet.inventory.sections = [
      {
        id: 'consumable',
        label: 'Consumables',
        items: [
          sheetItem({
            id: 'hex-wand',
            name: 'Wand of Hexes',
            type: 'consumable',
            uses: { value: 3, max: 7, recovery: 'Dawn' },
            activation: hex.activation,
            range: hex.range,
            toHit: null,
            activity: hex.activity,
            save: null,
            damage: [],
            cast: hex.cast,
            spellId: 'hex',
          }),
        ],
      },
    ]
    renderTab(sheet)

    await user.click(
      screen.getByRole('button', { name: /^Wand of Hexes/, expanded: false }),
    )
    expect(
      within(
        screen.getByRole('list', {
          name: 'Wand of Hexes: its other activities',
        }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^Hex \(Bonus Hex Damage\)Special · Necrotic1d6$/)
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

/** Thorin's things: a handaxe that rolls, and a broken torch, none left of it. */
const movingSheet = () => {
  const fuller = fullerSheet()
  const [weapons, equipment] = fuller.inventory.sections
  return fullerSheet({
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
            ...equipment.items,
            sheetItem({ id: 'torch', name: 'Torch', quantity: 0 }),
          ],
        },
      ],
    },
  })
}

describe('moving items and coins, from module 0.31.0', () => {
  /** Controls that say which item and coin they're for, where they're shown. */
  const controls: TransferControls = {
    item: item => ({
      aside: <button type='button'>Aside {item.name}</button>,
      body: <button type='button'>Body {item.name}</button>,
    }),
    coins: currency => (
      <button type='button'>
        Coins {currency.map(({ id }) => id).join(' ')}
      </button>
    ),
  }
  const renderMoving = (transfers?: TransferControls, favorites?: ReactNode) =>
    render(
      <InventoryTab
        characterId='char-1'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        sheet={toTableSheet(movingSheet(), 'https://my-game.forge-vtt.com')}
        transfers={transfers}
        favorites={favorites}
      />,
    )

  beforeEach(() => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it("gives a plain row its controls beside its quantity and once it's open", async () => {
    const user = userEvent.setup()
    renderMoving(controls)

    const ring = screen
      .getByText('Plain Ring')
      .closest('summary') as HTMLElement
    expect(
      within(ring).getByRole('button', { name: 'Aside Plain Ring' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Body Plain Ring' })).toBeNull()
    await user.click(screen.getByText('Plain Ring'))
    expect(
      screen.getByRole('button', { name: 'Body Plain Ring' }),
    ).toBeInTheDocument()

    // Inside a container too, and a container itself.
    await user.click(screen.getByText('Backpack'))
    expect(
      screen.getByRole('button', { name: 'Aside Hempen Rope' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Aside Backpack' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Body Backpack' }),
    ).toBeInTheDocument()
  })

  it('gives a row that rolls its controls once open alone, after its enchantments', async () => {
    const user = userEvent.setup()
    renderMoving(controls)

    expect(screen.queryByRole('button', { name: 'Aside Handaxe' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Body Handaxe' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: /^Handaxe/, expanded: false }),
    )
    expect(
      screen.getByRole('button', { name: 'Body Handaxe' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aside Handaxe' })).toBeNull()
  })

  it('gives none to an item there are none of', async () => {
    const user = userEvent.setup()
    renderMoving(controls)

    expect(screen.queryByRole('button', { name: 'Aside Torch' })).toBeNull()
    // With nothing else to show, it doesn't open at all.
    expect(screen.getByText('Torch').closest('summary')).toBeNull()
    await user.click(screen.getByText('Torch'))
    expect(screen.queryByRole('button', { name: 'Body Torch' })).toBeNull()
  })

  it("puts the coin's control in the fact's value, so that its name is Currency alone", () => {
    renderMoving(controls)

    const coins = screen.getByRole('button', { name: 'Coins pp gp sp' })
    expect(coins.closest('dd')).not.toBeNull()
    // Its text in its own span, which a party's sheet's spinner sits beside (module 0.33.0).
    const currency = screen.getByText('Currency').parentElement as HTMLElement
    expect(currency.tagName).toBe('DT')
    expect(currency).toHaveTextContent(/^Currency$/)
    expect(coins.closest('dd')?.previousElementSibling).toBe(currency)
  })

  it('gives none without controls, even inside a sheet that has some, nor to the favorites', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <Transferring controls={controls}>
        <InventoryTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(movingSheet(), 'https://my-game.forge-vtt.com')}
        />
      </Transferring>,
    )
    expect(
      screen.queryByRole('button', { name: /^(Aside|Body|Coins)/ }),
    ).toBeNull()
    await user.click(screen.getByText('Plain Ring'))
    expect(
      screen.queryByRole('button', { name: /^(Aside|Body|Coins)/ }),
    ).toBeNull()
    unmount()

    const rope = sheetItem({ id: 'rope', name: 'Hempen Rope' })
    renderMoving(
      controls,
      <ul aria-label='Favorites'>
        <ItemEntry characterId='char-1' item={rope} />
      </ul>,
    )
    expect(
      within(screen.getByRole('list', { name: 'Favorites' })).queryByRole(
        'button',
        {
          name: /^Aside/,
        },
      ),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Aside Plain Ring' }),
    ).toBeInTheDocument()
  })
})

describe('the Currency row and coin spacing, from module 0.32.0’s feedback', () => {
  const sendTo: TransferControls = {
    coins: () => (
      <button type='button' aria-haspopup='dialog'>
        Send to
      </button>
    ),
  }

  beforeEach(() => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it('puts the coin’s controls on its label’s row, in a group the label names, before the coins', () => {
    render(
      <InventoryTab
        characterId='char-1'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        transfers={sendTo}
      />,
    )

    const label = screen.getAllByRole('term')[0]
    expect(label).toHaveTextContent(/^Currency$/)
    const group = screen.getByRole('group', { name: 'Currency' })
    expect(group).toHaveAttribute('aria-labelledby', label.id)
    expect(
      within(group)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Send to'])
    // Label, then its controls, then the coins, in one card, the controls pushed right.
    const card = label.parentElement as HTMLElement
    expect(card).toHaveClass('flex-wrap', 'justify-between')
    expect(group.closest('dd')).toHaveClass('ml-auto')
    const coins = screen.getByTitle('Gold').closest('dd') as HTMLElement
    expect(coins).toHaveClass('basis-full')
    expect([...card.children]).toEqual([label, group.closest('dd'), coins])
  })

  it('names no group where the coin has no control', () => {
    renderTab()

    expect(screen.getByText('Currency')).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Currency' })).toBeNull()
  })

  it('puts half a space between a coin’s amount and its abbreviation, which still reads as one', async () => {
    const user = userEvent.setup()
    render(
      <InventoryTab
        characterId='char-1'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        sheet={toTableSheet(
          withInventory({
            currency: [
              { id: 'gp', label: 'Gold', abbreviation: 'GP', value: 41 },
              {
                id: 'pp',
                label: 'Platinum',
                abbreviation: 'PP',
                value: 12_877,
              },
            ],
          }),
          'https://my-game.forge-vtt.com',
        )}
      />,
    )

    const plain = screen.getByTitle('Gold')
    expect(plain).toHaveTextContent(/^41 GP$/)
    const spaced = (scope: HTMLElement) => {
      const parts = [...scope.querySelectorAll(':scope > span')]
      expect(parts.map(part => part.textContent)).toEqual([
        expect.any(String),
        ' ',
        expect.any(String),
      ])
      expect(parts[1]).toHaveClass('text-[0.5em]')
    }
    spaced(plain)

    // The shortened amount's button, and its exact amount, alike.
    const button = screen.getByRole('button', {
      name: '12.8k PP, exact amount',
    })
    expect(button).toHaveTextContent(/^12\.8k PP$/)
    spaced(button)
    await user.click(button)
    const exact = screen.getByRole('dialog', { name: '12,877 PP' })
    const amount = within(exact).getByText('12,877')
      .parentElement as HTMLElement
    expect(amount).toHaveTextContent(/^12,877 PP$/)
    spaced(amount)
  })
})

/** Buttons that wait, as a party's do while what they move is on its way. */
const waitingControls = (waiting?: ReadonlySet<string>): TransferControls => ({
  item: item => ({
    aside: (
      <button
        type='button'
        disabled={waiting?.has(item.id)}
      >{`Take ${item.name}`}</button>
    ),
  }),
  coins: () => (
    <button type='button' disabled={waiting?.has('coins')}>
      Take coins
    </button>
  ),
  ...(waiting && { waiting }),
})
const renderWaiting = (waiting?: ReadonlySet<string>) =>
  render(
    <InventoryTab
      characterId='char-1'
      onRoll={jest.fn()}
      onRollDamage={jest.fn()}
      sheet={toTableSheet(movingSheet(), 'https://my-game.forge-vtt.com')}
      transfers={waitingControls(waiting)}
    />,
  )
/** The spinners inside a part of the page. */
const spinnersIn = (scope: Element) => [
  ...scope.querySelectorAll(String.raw`svg.motion-safe\:animate-spin`),
]
/** The Currency fact's label. */
const currencyTerm = () =>
  screen.getByText('Currency').closest('dt') as HTMLElement
/** An item's row, by its name. */
const itemRow = (name: string) =>
  screen.getByText(name).closest('li') as HTMLElement

describe('one spinner on a party’s sheet, from module 0.33.0’s feedback', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it('shows one spinner right of the Currency label while its coins wait, its group busy and still named Currency', () => {
    renderWaiting(new Set(['coins']))

    const [spinner, ...more] = spinnersIn(currencyTerm())
    expect(more).toEqual([])
    expect(spinner.previousElementSibling).toBe(screen.getByText('Currency'))
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).toHaveClass('size-3.5', 'shrink-0')
    expect(currencyTerm()).toHaveTextContent(/^Currency$/)
    expect(currencyTerm()).toHaveClass('flex', 'items-center', 'gap-1.5')
    expect(screen.getByText('Currency')).toHaveClass('min-w-0', 'truncate')
    const group = screen.getByRole('group', { name: 'Currency' })
    expect(group).toHaveAttribute('aria-busy', 'true')
    expect(group).toHaveAttribute('aria-labelledby', currencyTerm().id)
    // No item waits.
    for (const row of screen.getAllByRole('listitem')) {
      expect(row).not.toHaveAttribute('aria-busy')
    }
  })

  it('shows one right of an item’s name while it waits, its row busy, inside a container too', async () => {
    const user = userEvent.setup()
    renderWaiting(new Set(['ring', 'rope']))

    const ring = itemRow('Plain Ring')
    expect(ring).toHaveAttribute('aria-busy', 'true')
    const [spinner, ...more] = spinnersIn(ring)
    expect(more).toEqual([])
    expect(spinner.previousElementSibling).toBe(screen.getByText('Plain Ring'))
    // Its name unchanged: the spinner is hidden from screen readers.
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinnersIn(currencyTerm())).toEqual([])
    expect(screen.getByRole('group', { name: 'Currency' })).not.toHaveAttribute(
      'aria-busy',
    )

    await user.click(screen.getByText('Backpack'))
    const rope = itemRow('Hempen Rope')
    expect(rope).toHaveAttribute('aria-busy', 'true')
    expect(spinnersIn(rope)).toHaveLength(1)
    // Its container doesn't wait, though the rope inside it does.
    const backpack = itemRow('Backpack')
    expect(backpack).not.toHaveAttribute('aria-busy')
    expect(
      spinnersIn(backpack.querySelector('summary') as HTMLElement),
    ).toEqual([])
  })

  it('gives a row that rolls none, as a party’s stash has no rows', () => {
    renderWaiting(new Set(['handaxe']))

    const handaxe = screen
      .getAllByText('Handaxe')
      .map(name => name.closest('li') as HTMLElement)
    expect(handaxe.length).toBeGreaterThan(0)
    for (const row of handaxe) {
      expect(row).not.toHaveAttribute('aria-busy')
      expect(spinnersIn(row)).toEqual([])
    }
  })

  it('shows none where nothing waits, as on a character’s sheet', () => {
    renderWaiting()

    expect(document.querySelector('[aria-busy]')).toBeNull()
    expect(spinnersIn(document.body)).toEqual([])
  })

  it('takes busy on a fact only beside what’s done with it', () => {
    render(
      <dl>
        <SheetFact label='Encumbrance' busy>
          12 lb
        </SheetFact>
      </dl>,
    )

    expect(screen.queryByRole('group')).toBeNull()
    expect(spinnersIn(document.body)).toEqual([])
    expect(document.querySelector('[aria-busy]')).toBeNull()
    // Its label as it always was, its text its own.
    expect(screen.getByText('Encumbrance').tagName).toBe('DT')
  })
})

/** A menu's items, by their names. */
const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map(item => item.textContent)

describe('components/character-sheet/inventory-tab, favorites, from module 0.37.0', () => {
  /** A staff carried, which strikes, and zaps besides. */
  const staff = sheetItem({
    id: 'staff',
    name: 'Staff',
    type: 'weapon',
    activation: 'Action',
    toHit: 5,
    attackId: 'strike',
    damage: [{ formula: '1d6 + 3', type: 'Bludgeoning', healing: false }],
    activities: [
      {
        id: 'strike',
        name: 'Strike',
        type: 'attack',
        activation: 'Action',
        range: 'reach 5 ft',
        target: null,
        toHit: 5,
        attackId: 'strike',
        save: null,
        damage: [{ formula: '1d6 + 3', type: 'Bludgeoning', healing: false }],
        uses: null,
      },
      {
        id: 'zap',
        name: 'Zap',
        type: 'utility',
        activation: 'Bonus Action',
        range: '30 ft',
        target: null,
        toHit: null,
        attackId: null,
        save: null,
        damage: [],
        uses: null,
      },
    ],
  })
  const renderOffered = () => {
    const offering = offeringFavorites(['item:ring'])
    const sheet = fullerSheet()
    const [weapons, ...rest] = sheet.inventory.sections
    render(
      <Favoriting value={offering.value}>
        <InventoryTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(
            {
              ...sheet,
              inventory: {
                ...sheet.inventory,
                sections: [
                  { ...weapons, items: [...weapons.items, staff] },
                  ...rest,
                ],
              },
            },
            'https://my-game.forge-vtt.com',
          )}
        />
      </Favoriting>,
    )
    return offering
  }

  it('offers an item’s entry on its row, as the item, Remove of a favorite', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    const ring = within(screen.getByRole('region', { name: 'Equipment' }))
      .getByText('Plain Ring')
      .closest('li') as HTMLElement
    fireEvent.contextMenu(
      (ring.querySelector('summary') ?? ring.firstElementChild) as HTMLElement,
      { button: 2 },
    )
    const menu = screen.getByRole('menu', { name: 'Plain Ring' })
    expect(itemsOf(menu)).toEqual(['Remove from favorites'])
    await user.click(within(menu).getByRole('menuitem'))
    expect(offering.chosen).toEqual([
      {
        target: { type: 'item', id: 'ring' },
        name: 'Plain Ring',
        op: 'remove',
      },
    ])
  })

  it('offers an item that rolls its own entry once, from its name, and each other activity its own', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    const name = screen.getByRole('button', { name: /^Staff/, expanded: false })
    fireEvent.contextMenu(name, { button: 2 })
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(itemsOf(screen.getByRole('menu', { name: 'Staff' }))).toEqual([
      'Add to favorites',
    ])
    await user.keyboard('{Escape}')

    await user.click(name)
    const zap = screen.getByText('Zap').closest('[tabindex]') as HTMLElement
    fireEvent.contextMenu(zap, { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Zap' })).getByRole('menuitem'),
    )
    expect(offering.chosen).toEqual([
      {
        target: { type: 'activity', id: 'zap', item: 'staff' },
        name: 'Zap',
        op: 'add',
      },
    ])
  })
})

describe('components/character-sheet/inventory-tab, Wild Shape, from module 0.40.0', () => {
  /** Elowen's Wild Shape, as her own pane gives it to the tab inside, at the seat given. */
  function Shaping({
    sheet,
    role = 'player',
    effects = true,
    children,
  }: Readonly<{
    sheet: TableSheet
    role?: SeatRole
    effects?: boolean
    children: ReactNode
  }>) {
    const value = useWildShape({
      on: role === 'player',
      pane: true,
      role,
      name: 'Elowen',
      sheet,
      characterId: 'char-1',
      effects,
      states: new Map(),
      send: () => 'use-1',
      read: () => new Promise(() => {}),
      panel: () => document.querySelector<HTMLElement>('#sheet-panel'),
    })
    return <WildShaping value={value}>{children}</WildShaping>
  }
  const renderShaped = (
    sheet: CharacterSheet = shapedSheet(),
    role: SeatRole = 'player',
  ) => {
    const table = toTableSheet(sheet, 'https://my-game.forge-vtt.com')
    return render(
      <Shaping sheet={table} role={role}>
        <InventoryTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={table}
        />
      </Shaping>,
    )
  }

  it('says first, while shaped, that Elowen’s own gear comes back to this tab', () => {
    const { container } = renderShaped()

    const note = screen.getByText(
      'Elowen’s own gear is back on this tab when Wild Shape ends.',
    )
    expect((container.firstElementChild as HTMLElement).firstElementChild).toBe(
      note,
    )
  })

  it('says nothing of Wild Shape ending for another transformation, such as a Polymorph (round 0.40.0 review)', () => {
    renderShaped(
      shapedSheet({
        form: wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          hours: null,
          minutesLeft: null,
          profile: null,
        }),
      }),
    )

    expect(screen.queryByText(/back on this tab/)).toBeNull()
    expect(screen.queryByText(/when Wild Shape ends/)).toBeNull()
  })

  it('says nothing of it unshaped, nor at the Gamemaster’s page', () => {
    const { unmount } = renderShaped(druidSheet())
    expect(screen.queryByText(/back on this tab/)).toBeNull()
    unmount()

    renderShaped(shapedSheet(), 'gm')
    expect(screen.queryByText(/back on this tab/)).toBeNull()
  })
})
