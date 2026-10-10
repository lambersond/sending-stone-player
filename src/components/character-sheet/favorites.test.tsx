/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoriteMarks } from './favorite-mark'
import { FavoritesColumn, FavoritesStrip } from './favorites'
import {
  fullerSheet,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import { favoriteEntries } from '@/utils/favorites'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetFavorite } from '@/types/sending-stone'

const GAME = 'https://my-game.forge-vtt.com'

const onRoll = jest.fn()
const onRollDamage = jest.fn()

/** The favorites' props, for a sheet. */
const propsFor = (sheet: CharacterSheet) => {
  const table = toTableSheet(sheet, GAME)
  return {
    characterId: 'char-1',
    sheet: table,
    entries: favoriteEntries(table),
    onRoll,
    onRollDamage,
  }
}

/** Thorin's sheet, with these favorites. */
const withFavorites = (favorites: SheetFavorite[] = sheetFavorites()) =>
  fullerSheet({ favorites })

/** Every element this many pixels wide, as a browser would lay them out. */
const wide = (width: number) =>
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)

/** An item made a favorite, by its id. */
const item = (id: string, itemType: string, name = id): SheetFavorite => ({
  type: 'item',
  id,
  itemType,
  name,
  img: null,
})

/** The rows' texts, in order. */
const rows = () =>
  screen.getAllByRole('listitem').map(row => row.textContent ?? '')

describe('components/character-sheet/favorites', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ html: '<p>Fifty feet of rope.</p>' }),
        }) as Response,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  it('shows each favorite as the sheet shows it where it lists it, in the order dnd5e shows them', () => {
    render(<FavoritesStrip {...propsFor(withFavorites())} />)

    expect(rows()).toEqual([
      expect.stringMatching(/^Superiority DiceShort Rest3\/4/),
      expect.stringMatching(/^WarhammerAction · reach 5 ft · Bludgeoning/),
      expect.stringMatching(
        /^Cast FireballStaff of Fire · Action · 150 ft · Fire/,
      ),
      expect.stringMatching(/^Bless9 Rounds/),
      // A check's ability stands for its icon.
      'WISPerceptionWisdom · Proficient · Passive 14+4',
      "DEXThieves' ToolsDexterity · Proficient+5",
      expect.stringMatching(/^1st LevelSpell slots/),
    ])
    expect(screen.getByText('3 of 4 uses left')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 spell slots left')).toBeInTheDocument()
  })

  it('rolls an attack, damage and checks as the sheet rolls them where it lists them', async () => {
    const user = userEvent.setup()
    render(<FavoritesStrip {...propsFor(withFavorites())} />)

    await user.click(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Warhammer attack',
      modifier: 7,
      advantage: undefined,
      // The attack, for the Gamemaster's game to make it too.
      source: {
        kind: 'attack',
        item: 'warhammer',
        activity: 'warhammerAttack',
      },
      explicit: false,
    })

    await user.click(
      screen.getByRole('button', { name: 'Cast Fireball damage, 8d6' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith({
      label: 'Cast Fireball damage',
      parts: [{ terms: [{ count: 8, sides: 6, sign: 1 }], type: 'Fire' }],
      healing: false,
      critical: false,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Perception check, +4 (proficient, passive 14)',
      }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Perception check',
      modifier: 4,
      advantage: undefined,
      source: { kind: 'skill', key: 'prc' },
      explicit: false,
    })

    await user.click(
      screen.getByRole('button', {
        name: "Thieves' Tools check, +5 (proficient)",
      }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: "Thieves' Tools check",
      modifier: 5,
      advantage: undefined,
      source: { kind: 'tool', key: 'thief' },
      explicit: false,
    })
  })

  it('offers other ways to roll a check, and damage as a critical hit', async () => {
    const user = userEvent.setup()
    render(<FavoritesStrip {...propsFor(withFavorites())} />)

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Perception check/ }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Perception check',
      modifier: 4,
      advantage: 'adv',
      source: { kind: 'skill', key: 'prc' },
      explicit: true,
    })

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll critical damage' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'Warhammer damage', critical: true }),
    )
  })

  it('shows a spell, a thing carried, a feature, a class and anything else the sheet lists nowhere else as their rows elsewhere do', () => {
    render(
      <FavoritesStrip
        {...propsFor(
          withFavorites([
            item('cure', 'spell'),
            item('cloak', 'equipment'),
            item('darkvision', 'feat'),
            item('fighter', 'class'),
            item('soldier', 'background', 'Soldier'),
            item('handaxe', 'weapon'),
          ]),
        )}
      />,
    )

    expect(rows()).toEqual([
      'Cure Wounds1 Action · SelfAlwaysAlways prepared',
      expect.stringMatching(/^Cloak of ProtectionEquipped · Attuned/),
      expect.stringMatching(/^DarkvisionPassive/),
      // Its hit dice first, as the row cuts its end short.
      'Fighter 5Hit dice 3/5 d10 · Champion',
      'SoldierBackground',
      expect.stringMatching(/^Handaxe×2 · Action/),
    ])
  })

  it("spends a class's hit die from its favorite, where something rolls them", async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    render(
      <FavoritesStrip
        {...propsFor(withFavorites([item('fighter', 'class')]))}
        onRollFormula={onRollFormula}
        spendsAtTable
      />,
    )

    // Beside its hit dice, the button, named for what it shows, then how many are left.
    expect(rows()).toEqual([
      'Fighter 5Hit dice 3/5 d10 · ChampionSpend d10, 3 of 5 left',
    ])
    await user.click(
      screen.getByRole('button', { name: 'Spend d10 , 3 of 5 left' }),
    )
    expect(onRollFormula).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Hit die (d10)',
        source: { kind: 'hitDie', denomination: 'd10' },
      }),
    )
  })

  it("rolls a class's hit die from its favorite where the game won't spend it, and spends none at full hit points", async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    const { rerender } = render(
      <FavoritesStrip
        {...propsFor(withFavorites([item('fighter', 'class')]))}
        onRollFormula={onRollFormula}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Roll d10 , 3 of 5 left' }),
    )
    expect(onRollFormula).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/At full hit points/)).toBeNull()

    rerender(
      <FavoritesStrip
        {...propsFor({
          ...withFavorites([item('fighter', 'class')]),
          hp: { value: 44, max: 44, temp: 0 },
        })}
        onRollFormula={onRollFormula}
        spendsAtTable
      />,
    )
    const spend = screen.getByRole('button', {
      name: 'Spend d10 , 3 of 5 left',
    })
    expect(spend).toBeDisabled()
    expect(spend).toHaveAccessibleDescription('At full hit points')
    // Said after the hit dice too, before what a narrow row cuts short, as a touch screen shows
    // no title.
    expect(rows()).toEqual([
      'Fighter 5Hit dice 3/5 d10 · At full hit points · ChampionSpend d10, 3 of 5 left',
    ])
    await user.click(spend)
    expect(onRollFormula).toHaveBeenCalledTimes(1)
  })

  it("offers no hit die from a class's favorite of a size the game doesn't have, nor says why at full hit points", () => {
    render(
      <FavoritesStrip
        {...propsFor({
          ...withFavorites([item('oddity', 'class')]),
          hp: { value: 44, max: 44, temp: 0 },
          classes: [
            {
              id: 'oddity',
              identifier: 'oddity',
              name: 'Oddity',
              levels: 1,
              subclass: null,
              hitDice: { die: 'd3', value: 1, max: 1 },
            },
          ],
        })}
        onRollFormula={jest.fn()}
        spendsAtTable
      />,
    )

    expect(rows()).toEqual(['Oddity 1Hit dice 1/1 d3'])
    expect(screen.queryByRole('button', { name: /d3/ })).toBeNull()
  })

  it('says whether an effect is off, or unavailable for now', () => {
    render(
      <FavoritesStrip
        {...propsFor(
          withFavorites([
            {
              type: 'effect',
              id: 'rage',
              name: 'Rage',
              img: null,
              disabled: true,
              suppressed: false,
            },
            {
              type: 'effect',
              id: 'blessed',
              name: 'Bless',
              img: null,
              disabled: false,
              suppressed: true,
            },
          ]),
        )}
      />,
    )

    expect(rows()).toEqual(['RageOff', 'Bless9 RoundsUnavailable'])
  })

  it('opens a favorite to its description', async () => {
    const user = userEvent.setup()
    render(
      <FavoritesStrip {...propsFor(withFavorites([item('rope', 'loot')]))} />,
    )

    await user.click(screen.getByText('Hempen Rope'))

    expect(await screen.findByText('Fifty feet of rope.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.rope}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  it("marks none of them a favorite, as all of them are, though they're marked elsewhere", () => {
    render(
      <FavoriteMarks keys={new Set(['item:warhammer', 'effect:blessed'])}>
        <FavoritesStrip {...propsFor(withFavorites())} />
      </FavoriteMarks>,
    )

    expect(screen.queryByText(', favorite')).toBeNull()
  })

  it('hides its favorites under its heading, and shows them again, as this browser remembers for the character', async () => {
    const user = userEvent.setup()
    const props = propsFor(withFavorites())
    render(<FavoritesStrip {...props} />)

    const toggle = screen.getByRole('button', { name: /^Favorites\s*, 7$/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('region', { name: 'Favorites' }),
    ).toBeInTheDocument()
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(localStorage.getItem('sending-stone:favorites-shown:char-1')).toBe(
      'closed',
    )

    cleanup()
    render(<FavoritesStrip {...props} />)
    expect(screen.queryByRole('listitem')).toBeNull()

    cleanup()
    render(<FavoritesStrip {...props} characterId='char-2' />)
    expect(screen.getAllByRole('listitem')).toHaveLength(7)

    cleanup()
    render(<FavoritesStrip {...props} />)
    await user.click(screen.getByRole('button', { name: /^Favorites\s*, 7$/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
  })

  it('lays them out in two lists side by side where they are wide enough, the first half first', () => {
    wide(600)
    render(<FavoritesStrip {...propsFor(withFavorites())} />)

    const [first, second] = screen.getAllByRole('list')
    expect(
      within(first)
        .getAllByRole('listitem')
        .map(row => row.textContent?.slice(0, 9)),
    ).toEqual(['Superiori', 'Warhammer', 'Cast Fire', 'Bless9 Ro'])
    expect(within(second).getAllByRole('listitem')).toHaveLength(3)
  })

  it('keeps them in one list where they are narrower, or when there is only one', () => {
    wide(591)
    render(<FavoritesStrip {...propsFor(withFavorites())} />)
    expect(screen.getAllByRole('list')).toHaveLength(1)

    cleanup()
    wide(800)
    render(
      <FavoritesStrip {...propsFor(withFavorites([sheetFavorites()[0]]))} />,
    )
    expect(screen.getAllByRole('list')).toHaveLength(1)
  })

  it('has them in a column of their own beside the sheet, named for them', () => {
    render(<FavoritesColumn {...propsFor(withFavorites())} />)

    const column = screen.getByRole('complementary', { name: 'Favorites' })
    expect(within(column).getAllByRole('listitem')).toHaveLength(7)
    expect(
      within(column).queryByRole('button', { name: /^Favorites/ }),
    ).toBeNull()
  })

  it("opens what there is to read of an item's other activities from beside each, as its tab does", async () => {
    const user = userEvent.setup()
    const attack = {
      type: 'attack',
      activation: 'Action',
      target: null,
      toHit: 7,
      save: null,
      damage: [{ formula: '1d6 + 4', type: 'Piercing', healing: false }],
      uses: null,
    }
    const sheet = withFavorites([item('javelin', 'weapon', 'Javelin')])
    sheet.inventory.sections[0].items.push(
      sheetItem({
        id: 'javelin',
        name: 'Javelin',
        type: 'weapon',
        range: 'reach 5 ft',
        toHit: 7,
        attackId: 'stab',
        damage: attack.damage,
        text: TEXTS.rope,
        activities: [
          { ...attack, id: 'stab', name: 'Attack', range: 'reach 5 ft' },
          { ...attack, id: 'throw', name: 'Throw', range: '30/120 ft' },
        ],
      }),
    )
    render(
      <FavoritesStrip
        {...propsFor(sheet)}
        // Of its own, as descriptions already loaded are kept by character.
        characterId='char-3'
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /^Javelin/, expanded: false }),
    )
    // Its row says what it did before.
    expect(
      within(
        screen.getByRole('list', { name: 'Javelin: its other activities' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^ThrowAction · 30\/120 ft · Piercing\+71d6 \+ 4$/)
    await user.click(
      screen.getByRole('button', { name: 'About Javelin (Throw)' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Throw' })
    expect(within(dialog).getByText('From Javelin')).toBeVisible()
    expect(
      await within(
        within(dialog).getByRole('region', { name: 'Javelin' }),
      ).findByText('Fifty feet of rope.'),
    ).toBeInTheDocument()
  })

  it('shows an activity with what the sheet lists of its item, opening to its description', async () => {
    const user = userEvent.setup()
    const sheet = withFavorites([
      {
        type: 'activity',
        id: 'swing',
        itemId: 'handaxe',
        itemType: 'weapon',
        itemName: 'Handaxe',
        name: 'Throw',
        img: null,
        activation: 'Action',
        range: '20/60 ft',
        target: null,
        toHit: 7,
        save: null,
        damage: [{ formula: '1d6 + 4', type: 'Slashing', healing: false }],
        uses: null,
      },
    ])
    sheet.inventory.sections[0].items[1] = sheetItem({
      ...sheet.inventory.sections[0].items[1],
      text: TEXTS.backpack,
    })
    render(<FavoritesStrip {...propsFor(sheet)} />)

    expect(rows()).toEqual([
      expect.stringMatching(/^ThrowHandaxe · Action · 20\/60 ft · Slashing/),
    ])
    expect(
      screen.getByRole('button', { name: 'Throw attack, +7' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Throw Handaxe/ }))
    expect(await screen.findByText('Fifty feet of rope.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.backpack}`,
      { signal: expect.any(AbortSignal) },
    )
    expect(screen.getByText('Weapon')).toBeInTheDocument()
  })

  it('uses an activity in the game from its chips while the game takes it, as its item', async () => {
    const user = userEvent.setup()
    const onUse = jest.fn()
    const exhale: SheetFavorite = {
      type: 'activity',
      id: 'exhale',
      itemId: 'breath',
      itemType: 'feat',
      itemName: 'Fire Breath',
      name: 'Exhale',
      img: null,
      activation: 'Action',
      range: '15 ft',
      target: '15 ft Cone',
      toHit: null,
      save: { ability: 'DEX', dc: 13 },
      damage: [{ formula: '2d6', type: 'Fire', healing: false }],
      uses: null,
      activity: {
        id: 'exhale',
        type: 'save',
        targets: {
          self: false,
          area: true,
          count: null,
          perLevel: null,
          affects: 'creature',
        },
      },
    }
    const props = propsFor(withFavorites([exhale]))
    const { rerender } = render(<FavoritesStrip {...props} onUse={onUse} />)

    await user.click(
      screen.getByRole('button', { name: 'Exhale, DEX saving throw DC 13' }),
    )
    await user.click(screen.getByRole('button', { name: 'Exhale damage, 2d6' }))
    expect(onUse).toHaveBeenCalledTimes(2)
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'breath',
        activity: expect.objectContaining({ id: 'exhale', type: 'save' }),
      }),
    )

    // While the game takes none, its damage is rolled here.
    rerender(<FavoritesStrip {...props} />)
    expect(
      screen.queryByRole('button', { name: 'Exhale, DEX saving throw DC 13' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Exhale damage, 2d6' }))
    expect(onRollDamage).toHaveBeenCalledTimes(1)
    expect(onUse).toHaveBeenCalledTimes(2)
  })

  it('rolls a favorite spell, item or feature as its tab rolls it', async () => {
    const user = userEvent.setup()
    const onUse = jest.fn()
    const sheet = withFavorites([
      item('bolt', 'spell'),
      item('potion', 'consumable'),
      item('surge', 'feat'),
    ])
    const [cantrips, ...spellbook] = sheet.spells
    sheet.spells = [
      {
        ...cantrips,
        spells: [
          sheetSpell({
            id: 'bolt',
            name: 'Fire Bolt',
            level: 0,
            toHit: 5,
            attackId: 'boltAttack',
            damage: [{ formula: '2d10', type: 'Fire', healing: false }],
          }),
        ],
      },
      ...spellbook,
    ]
    const self = {
      self: true,
      area: false,
      count: null,
      perLevel: null,
      affects: 'self',
    }
    sheet.inventory.sections[1].items.push(
      sheetItem({
        id: 'potion',
        name: 'Potion of Healing',
        type: 'consumable',
        activity: { id: 'drink', type: 'heal', targets: self },
        damage: [{ formula: '2d4 + 2', type: 'Healing', healing: true }],
      }),
    )
    sheet.features[0].features.push({
      id: 'surge',
      name: 'Surge',
      img: null,
      kind: null,
      requirements: null,
      activation: 'Special',
      passive: false,
      uses: null,
      text: null,
      activity: { id: 'go', type: 'utility', targets: self },
    })
    render(<FavoritesStrip {...propsFor(sheet)} onUse={onUse} />)

    await user.click(
      screen.getByRole('button', { name: 'Fire Bolt attack, +5' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { kind: 'attack', item: 'bolt', activity: 'boltAttack' },
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Potion of Healing healing, 2d4 + 2',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Use Surge' }))
    expect(onUse.mock.calls.map(([action]) => action.id)).toEqual([
      'potion',
      'surge',
    ])
    // Nothing is marked a favorite among them, as every one is.
    expect(screen.queryByText(', favorite')).toBeNull()
  })

  it('shows what it can of a favorite the sheet says little of', () => {
    const sheet = withFavorites([
      {
        type: 'tool',
        id: 'odd',
        name: 'Odd Kit',
        ability: null,
        total: -1,
        passive: null,
        proficiency: 0,
        mode: -1,
      },
      { type: 'resource', id: 'tertiary', name: 'Luck', uses: null },
      item('wizard', 'class'),
      item('sorcerer', 'class'),
      item('lost', 'weapon', 'Lost Blade'),
    ])
    sheet.classes = [
      {
        id: 'wizard',
        name: 'Wizard',
        levels: null,
        subclass: null,
        hitDice: { die: 'd6', value: null, max: null },
      },
      { id: 'sorcerer', name: 'Sorcerer', levels: 1, subclass: null },
    ]
    render(<FavoritesStrip {...propsFor(sheet)} />)

    expect(rows()).toEqual([
      'Odd KitCheckDis−1',
      'Luck',
      'WizardHit dice –/– d6',
      'Sorcerer 1',
      'Lost Blade',
    ])
    expect(
      screen.getByRole('button', {
        name: 'Odd Kit check, −1, with disadvantage',
      }),
    ).toBeInTheDocument()
    // Its icon, for want of an ability to name.
    expect(screen.getAllByRole('listitem')[0].querySelector('svg')).toHaveClass(
      'size-4',
    )
  })
})
