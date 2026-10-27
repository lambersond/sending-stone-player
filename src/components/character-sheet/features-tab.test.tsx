/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoriteMarks } from './favorite-mark'
import { Favoriting } from './favoriting'
import { FeaturesTab } from './features-tab'
import { LONG_PRESS } from './roll-button'
import { useWildShape, WildShaping } from './wild-shape'
import {
  characterSheet,
  druidSheet,
  fullerSheet,
  moonBlock,
  offeringFavorites,
  shapedSheet,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <FeaturesTab
      characterId='char-1'
      onRoll={jest.fn()}
      onRollDamage={jest.fn()}
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

describe('components/character-sheet/features-tab', () => {
  it('shows each class with its hit dice', () => {
    renderTab()

    const classes = within(
      screen.getByRole('region', { name: 'Classes' }),
    ).getAllByRole('listitem')
    expect(classes.map(item => item.textContent)).toEqual([
      'Fighter 5Champion · Hit dice 3/5 d10',
    ])
    // Nothing to tap where nothing rolls them.
    expect(within(classes[0]).queryByRole('button')).toBeNull()
  })

  it("has no button for a class's hit dice, which are used from the Character tab, even at full hit points", () => {
    const sheet = fullerSheet({ hp: { value: 44, max: 44, temp: 0 } })
    render(
      <FeaturesTab
        characterId='char-1'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        onRollFormula={jest.fn()}
        sheet={toTableSheet(
          {
            ...sheet,
            classes: [
              ...sheet.classes,
              {
                id: 'wizard',
                identifier: 'wizard',
                name: 'Wizard',
                levels: 2,
                subclass: null,
                hitDice: { die: 'd6', value: 0, max: 2 },
              },
            ],
          },
          'https://my-game.forge-vtt.com',
        )}
      />,
    )

    const classes = screen.getByRole('region', { name: 'Classes' })
    // Its subclass and hit dice alone, nor why none would be spent.
    expect(
      within(classes)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual([
      'Fighter 5Champion · Hit dice 3/5 d10',
      'Wizard 2Hit dice 0/2 d6',
    ])
    expect(within(classes).queryByRole('button')).toBeNull()
    expect(screen.queryByText(/At full hit points/)).toBeNull()
  })

  it('groups features by where they came from, with how and how often each is used', () => {
    renderTab()

    const fighter = within(
      screen.getByRole('region', { name: 'Fighter Features' }),
    )
    expect(
      fighter.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'About Fighter',
      'Second Wind1 Bonus Action · Short Rest, Long Rest1/11 of 1 uses left',
      'Action SurgeSpecial · Short Rest0/10 of 1 uses left',
    ])
    expect(fighter.getByText('0/1').parentElement).toHaveClass('text-ruby')
    const species = within(
      screen.getByRole('region', { name: 'Species Features' }),
    )
    expect(species.getByRole('listitem')).toHaveTextContent('DarkvisionPassive')
    expect(species.getByRole('listitem').querySelector('img')).toHaveAttribute(
      'src',
      'https://assets.forge-vtt.com/darkvision.webp',
    )
  })

  it('shows what a feature rolls beside it, rolling it here or using it in the game', async () => {
    const user = userEvent.setup()
    // Its description loads once it's open.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    const sheet = fullerSheet()
    const [fighter, ...origins] = sheet.features
    const wind = {
      ...fighter.features[0],
      range: 'Self',
      target: null,
      concentration: false,
      activity: {
        id: 'windHeal',
        type: 'heal' as const,
        targets: {
          self: true,
          area: false,
          count: null,
          perLevel: null,
          affects: 'self',
        },
      },
      damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
    }
    const props = {
      characterId: 'char-1',
      sheet: toTableSheet(
        { ...sheet, features: [{ ...fighter, features: [wind] }, ...origins] },
        'https://my-game.forge-vtt.com',
      ),
      onRoll: jest.fn(),
      onRollDamage: jest.fn(),
    }
    const onUse = jest.fn()
    const { rerender } = render(<FeaturesTab {...props} onUse={onUse} />)
    // As on the Actions tab, its uses keep out of the way of what it rolls in a narrow list.
    expect(screen.getByText('1 of 1 uses left').closest('.hidden')).toHaveClass(
      '@md:inline',
    )

    await user.click(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    )
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second-wind', type: 'feat' }),
    )
    await user.click(
      screen.getByRole('button', { name: /^Second Wind/, expanded: false }),
    )
    expect(screen.getByText('Class Feature · Fighter 1')).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Activation: 1 Bonus Action',
      'Range: Self',
      'Healing: 1d10 + 5',
      'Uses: 1 of 1 left, Short Rest, Long Rest',
    ])

    // While the game takes no features, it's rolled here.
    rerender(<FeaturesTab {...props} />)
    await user.click(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    )
    expect(props.onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Second Wind healing', healing: true }),
    )
    expect(onUse).toHaveBeenCalledTimes(1)
    // A feature that rolls nothing is as it was.
    expect(
      screen.getByText('Darkvision').closest('li')?.querySelector('button'),
    ).toBeNull()
  })

  it('rolls damage whose dice Foundry rerolls, as a chip of its own', async () => {
    const user = userEvent.setup()
    const onRollDamage = jest.fn()
    const sheet = fullerSheet()
    const [fighter, ...origins] = sheet.features
    const strike = {
      ...fighter.features[0],
      id: 'brutal-strike',
      name: 'Brutal Strike',
      damage: [
        { formula: '2d6r<=2 + 7 + 1d8', type: 'Bludgeoning', healing: false },
      ],
    }
    render(
      <FeaturesTab
        characterId='char-1'
        sheet={toTableSheet(
          {
            ...sheet,
            features: [{ ...fighter, features: [strike] }, ...origins],
          },
          'https://my-game.forge-vtt.com',
        )}
        onRoll={jest.fn()}
        onRollDamage={onRollDamage}
      />,
    )

    const chip = screen.getByRole('button', {
      name: 'Brutal Strike damage, 2d6r<=2 + 7 + 1d8',
    })
    expect(chip).toBeEnabled()
    await user.click(chip)
    expect(onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Brutal Strike damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
              { sign: 1, flat: 7 },
              { sign: 1, count: 1, sides: 8 },
            ],
            type: 'Bludgeoning',
          },
        ],
      }),
    )
  })

  it('names the species or background a group came from, if it has a description', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      features: [
        { ...sheet.features[1], text: '5e6f708192a3b4' },
        {
          id: 'background',
          label: 'Background Features',
          text: '6f708192a3b4c5',
          features: [],
        },
        {
          id: 'wizard',
          label: 'Wizard Features',
          text: '708192a3b4c5d6',
          features: [],
        },
      ],
    })

    expect(screen.getByText('About Dwarf')).toBeInTheDocument()
    expect(screen.getByText('About Soldier')).toBeInTheDocument()
    expect(screen.getByText('About this')).toBeInTheDocument()
  })

  it('says so when there are no features to show, as from an older module', () => {
    const { classes, ...sheet } = characterSheet()
    renderTab({ ...sheet, classes: [{ ...classes[0], hitDice: null }] })

    expect(screen.getByText('No features to show yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Hit dice/)).toBeNull()
  })

  it('shows hit dice it only partly knows', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      classes: [
        {
          ...sheet.classes[0],
          levels: null,
          subclass: null,
          hitDice: { die: 'd8', value: null, max: null },
        },
      ],
    })

    expect(screen.getByRole('region', { name: 'Classes' })).toHaveTextContent(
      'FighterHit dice –/– d8',
    )
  })

  it('stars a favorite', () => {
    render(
      <FavoriteMarks keys={new Set(['item:darkvision'])}>
        <FeaturesTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        />
      </FavoriteMarks>,
    )

    expect(
      screen
        .getAllByText(', favorite')
        .map(star => star.closest('li')?.textContent),
    ).toEqual(['Darkvision, favoritePassive'])
  })
})

describe('components/character-sheet/features-tab: recharges, from module 0.36.0', () => {
  it('says what recharges a feature’s uses as dnd5e’s stat block says it', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      features: sheet.features.map(section => ({
        ...section,
        features: section.features.map(feature =>
          feature.id === 'action-surge'
            ? {
                ...feature,
                uses: {
                  value: 0,
                  max: 1,
                  recovery: 'Recharge [5+]',
                  recharge: 5,
                  counter: { item: 'action-surge' },
                },
              }
            : feature,
        ),
      })),
    })

    const surge = screen.getByText('Action Surge').closest('li') as HTMLElement
    expect(surge).toHaveTextContent('Special · Recharge 5–6')
    expect(surge).not.toHaveTextContent('[5+]')
    // Any other's as the sheet says it.
    expect(
      screen.getByText('Second Wind').closest('li') as HTMLElement,
    ).toHaveTextContent('Short Rest, Long Rest')
  })
})

/** A feature's row, by its name: its summary, its plain row, or its name's button. */
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.querySelector('button') ??
    item.firstElementChild) as HTMLElement
}

/** A class's card, by its name. */
const cardOf = (name: string) =>
  within(screen.getByRole('region', { name: 'Classes' }))
    .getByText(new RegExp(`^${name}`))
    .closest('li') as HTMLElement

/** What a part pressed for its menu has, from a held touch's: no text selection or callout. */
const UNSELECTED = /select-none|-webkit-touch-callout/

describe('components/character-sheet/features-tab, favorites, from module 0.37.0', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  /** The tab, inside a pane that offers favorites. */
  const renderOffered = (sheet: CharacterSheet = fullerSheet()) => {
    const offering = offeringFavorites()
    render(
      <Favoriting value={offering.value}>
        <FeaturesTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
        />
      </Favoriting>,
    )
    return offering
  }

  it('offers a feature’s entry, as the feature', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    fireEvent.contextMenu(rowOf('Darkvision'), { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Darkvision' })).getByRole(
        'menuitem',
      ),
    )
    expect(offering.chosen).toEqual([
      {
        target: { type: 'item', id: 'darkvision' },
        name: 'Darkvision',
        op: 'add',
      },
    ])
  })

  it('offers a class card’s, as the class, by a right-click, a held touch and Shift+F10 from a tab stop of its own', async () => {
    jest.useFakeTimers()
    const offering = renderOffered()
    const card = cardOf('Fighter')
    expect(card).toHaveAttribute('tabindex', '0')
    // A held touch selects none of its words, nor brings up a phone's callout over its menu.
    expect(card).toHaveClass('select-none', '[-webkit-touch-callout:none]')
    const touch = { pointerType: 'touch', clientX: 10, clientY: 10 }

    fireEvent.pointerDown(card, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    expect(screen.getByRole('menu', { name: 'Fighter' })).toBeVisible()
    fireEvent.pointerUp(card, touch)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    jest.useRealTimers()

    card.focus()
    expect(fireEvent.contextMenu(card, { button: -1 })).toBe(false)
    const user = userEvent.setup()
    await user.click(
      within(screen.getByRole('menu', { name: 'Fighter' })).getByRole(
        'menuitem',
        { name: 'Add to favorites' },
      ),
    )
    expect(offering.chosen).toEqual([
      { target: { type: 'item', id: 'fighter' }, name: 'Fighter', op: 'add' },
    ])
  })

  it('takes a held tap on an entry of a class card’s menu as the entry’s, never the card’s', () => {
    jest.useFakeTimers()
    const offering = renderOffered()
    const card = cardOf('Fighter')
    const touch = { pointerType: 'touch', clientX: 10, clientY: 10 }
    fireEvent.pointerDown(card, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS))
    fireEvent.pointerUp(card, touch)
    fireEvent.click(card)
    const entry = within(
      screen.getByRole('menu', { name: 'Fighter' }),
    ).getByRole('menuitem', { name: 'Add to favorites' })

    // A right-click inside the menu is the menu's: the card doesn't open it again there.
    expect(fireEvent.contextMenu(entry, { button: 2 })).toBe(true)
    // A tap on the entry held a little long, as a phone's may be, chooses it, and the card's
    // press neither opens its menu again nor takes the click that ends it.
    fireEvent.pointerDown(entry, touch)
    act(() => jest.advanceTimersByTime(LONG_PRESS + 50))
    fireEvent.pointerUp(entry, touch)
    fireEvent.click(entry)
    expect(offering.chosen).toEqual([
      { target: { type: 'item', id: 'fighter' }, name: 'Fighter', op: 'add' },
    ])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers none on a class card the sheet names by no id, nor on a section’s About row, nor without a pane offering them', () => {
    const sheet = fullerSheet()
    renderOffered({
      ...sheet,
      classes: [{ ...sheet.classes[0], id: null }],
      features: [{ ...sheet.features[0], text: 'about-fighter' }],
    })
    const card = cardOf('Fighter')
    expect(card).not.toHaveAttribute('tabindex')
    expect(card.className).not.toMatch(UNSELECTED)
    expect(fireEvent.contextMenu(card, { button: 2 })).toBe(true)
    expect(fireEvent.contextMenu(rowOf('About Fighter'), { button: 2 })).toBe(
      true,
    )
    expect(screen.queryByRole('menu')).toBeNull()

    // Nor where the pane offers none: its words select as any others.
    cleanup()
    render(
      <FeaturesTab
        characterId='char-1'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
      />,
    )
    const plain = cardOf('Fighter')
    expect(plain).not.toHaveAttribute('tabindex')
    expect(plain.className).not.toMatch(UNSELECTED)
    expect(fireEvent.contextMenu(plain, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

/** The Wild Shape row, its list item (module 0.40.0). */
const wildRow = () =>
  screen
    .getAllByText('Wild Shape')
    .map(each => each.closest('li'))
    .find(Boolean) as HTMLElement

describe('components/character-sheet/features-tab, Wild Shape, from module 0.40.0', () => {
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
    sheet: CharacterSheet = druidSheet(),
    role: SeatRole = 'player',
  ) => {
    const table = toTableSheet(sheet, 'https://my-game.forge-vtt.com')
    return render(
      <Shaping sheet={table} role={role}>
        <FeaturesTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={table}
        />
      </Shaping>,
    )
  }

  it('draws the Wild Shape row as an action’s, with Change and Known forms… beside its uses, never inside what opens it', () => {
    renderShaped()

    const row = wildRow()
    const change = within(row).getByRole('button', { name: 'Change' })
    const known = within(row).getByRole('button', { name: 'Known forms…' })
    expect(change).toBeVisible()
    expect(known).toBeVisible()
    expect(row.querySelector('summary')).toBeNull()
    const opener = within(row).getByRole('button', {
      name: /^Wild Shape/,
      expanded: false,
    })
    expect(opener).not.toContainElement(change)
    expect(row).toHaveTextContent('Change into a known Beast form for 2 hours.')
  })

  it('says in its description what Wild Shape allows Elowen now, the Moon’s floor too', async () => {
    const user = userEvent.setup()
    const { unmount } = renderShaped()

    await user.click(
      within(wildRow()).getByRole('button', {
        name: /^Wild Shape/,
        expanded: false,
      }),
    )
    expect(
      within(wildRow()).getByText(
        'Bonus Action. 6 known forms, up to CR 1/2, none with a Fly Speed. Lasts 2 hours. Elowen gains 5 temporary hit points.',
      ),
    ).toBeVisible()
    unmount()

    renderShaped(druidSheet({ wildShape: moonBlock() }))
    await user.click(
      within(wildRow()).getByRole('button', {
        name: /^Wild Shape/,
        expanded: false,
      }),
    )
    expect(
      within(wildRow()).getByText(
        'Bonus Action. 6 known forms, up to CR 1, none with a Fly Speed. Lasts 2 hours. Elowen gains 15 temporary hit points. AC at least 16.',
      ),
    ).toBeVisible()
  })

  it('offers Return beside Change while shaped, and nothing at the Gamemaster’s page', () => {
    const { unmount } = renderShaped(shapedSheet())
    expect(
      within(wildRow()).getByRole('button', { name: 'Return' }),
    ).toBeVisible()
    unmount()

    renderShaped(shapedSheet(), 'gm')
    for (const name of ['Return', 'Change', 'Known forms…'])
      expect(screen.queryByRole('button', { name })).toBeNull()
  })

  it('draws the row as ever where the sheet has no Wild Shape', () => {
    const sheet = druidSheet()
    renderShaped({ ...sheet, wildShape: undefined })

    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    expect(screen.queryByText(/Change into a known Beast form/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Known forms…' })).toBeNull()
    expect(screen.getAllByText('Wild Shape').length).toBeGreaterThan(0)
  })
})
