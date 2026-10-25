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
import { Favoriting } from './favoriting'
import {
  castingSheet,
  fullerSheet,
  offeringFavorites,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import { favoriteEntries } from '@/utils/favorites'
import { toTableSheet } from '@/utils/table-view'
import type {
  CharacterSheet,
  SheetFavorite,
  SheetUses,
} from '@/types/sending-stone'

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

/** None left of 1 use, back after a short rest. */
const NONE_LEFT: SheetUses = { value: 0, max: 1, recovery: 'Short Rest' }

/** An old-style resource, standing for the feature the module says. */
const resource = (
  name: string,
  itemId: string | null,
  uses = NONE_LEFT,
): SheetFavorite => ({ type: 'resource', id: 'secondary', name, uses, itemId })

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

    const perception = screen.getByRole('button', {
      name: 'Perception check, +4 (proficient, passive 14)',
    })
    // Its ability's badge, small on the accent's tint, in the accent deep enough to read there.
    expect(perception.querySelector('span[aria-hidden]')).toHaveClass(
      'bg-primary/10',
      'text-primary-text',
    )
    await user.click(perception)
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

  it("uses a class's hit dice from its favorite, a tap a die, or more at once from its popover", async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    render(
      <FavoritesStrip
        {...propsFor(withFavorites([item('fighter', 'class')]))}
        onRollFormula={onRollFormula}
      />,
    )

    // Beside its hit dice, a button with their die that says Use, named for it, then the size
    // and how many are left.
    expect(rows()).toEqual(['Fighter 5Hit dice 3/5 d10 · ChampionUse'])
    const use = screen.getByRole('button', {
      name: 'Use a d10 hit die, 3 of 5 left',
    })
    expect(use.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await user.click(use)
    expect(onRollFormula).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Hit die (d10)',
        source: { kind: 'hitDie', denomination: 'd10' },
      }),
    )

    // From the keyboard's context menu key, its popover offers as many as are left.
    fireEvent.contextMenu(use, { button: -1 })
    const popover = screen.getByRole('dialog', { name: 'Use d10 hit dice' })
    const more = within(popover).getByRole('button', { name: 'One die more' })
    for (let press = 0; press < 3; press++) await user.click(more)
    expect(popover).toHaveTextContent('3 of 3')
    expect(more).toHaveAttribute('aria-disabled', 'true')
    await user.click(
      within(popover).getByRole('button', { name: 'Use 3 d10 hit dice' }),
    )
    expect(onRollFormula).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Hit dice (3d10)',
        source: {
          kind: 'hitDice',
          hitDice: [{ denomination: 'd10', count: 3 }],
        },
      }),
    )
  })

  it("goes by its class's own hit dice, and its popover by every class's of that size, as dnd5e spends them", async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    const sheet = withFavorites([
      item('fighter', 'class'),
      item('paladin', 'class'),
    ])
    sheet.classes = [
      {
        id: 'fighter',
        identifier: 'fighter',
        name: 'Fighter',
        levels: 3,
        subclass: null,
        hitDice: { die: 'd10', value: 0, max: 3 },
      },
      {
        id: 'paladin',
        identifier: 'paladin',
        name: 'Paladin',
        levels: 2,
        subclass: null,
        hitDice: { die: 'd10', value: 2, max: 2 },
      },
    ]
    render(
      <FavoritesStrip {...propsFor(sheet)} onRollFormula={onRollFormula} />,
    )

    // Each as its row says: the fighter's spent, the paladin's not.
    expect(rows()).toEqual([
      'Fighter 3Hit dice 0/3 d10Use',
      'Paladin 2Hit dice 2/2 d10Use',
    ])
    const fighter = screen.getByRole('button', {
      name: 'Use a d10 hit die, 0 of 3 left',
    })
    expect(fighter).toBeDisabled()
    expect(fighter).toHaveAttribute('title', 'None left')
    const paladin = screen.getByRole('button', {
      name: 'Use a d10 hit die, 2 of 2 left',
    })
    expect(paladin).toBeEnabled()

    // Its popover offers the d10s left of both classes, which are the paladin's.
    fireEvent.contextMenu(paladin, { button: -1 })
    const popover = screen.getByRole('dialog', { name: 'Use d10 hit dice' })
    expect(popover).toHaveTextContent('1 of 2')
    await user.click(
      within(popover).getByRole('button', { name: 'Use 1 d10 hit die' }),
    )
    expect(onRollFormula).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Hit die (d10)',
        source: { kind: 'hitDie', denomination: 'd10' },
      }),
    )
  })

  it("uses none from a class's favorite at full hit points, saying why only in its button's title", async () => {
    const user = userEvent.setup()
    const onRollFormula = jest.fn()
    render(
      <FavoritesStrip
        {...propsFor({
          ...withFavorites([item('fighter', 'class')]),
          hp: { value: 44, max: 44, temp: 0 },
        })}
        onRollFormula={onRollFormula}
      />,
    )

    const use = screen.getByRole('button', {
      name: 'Use a d10 hit die, 3 of 5 left',
    })
    expect(use).toBeDisabled()
    expect(use).toHaveAccessibleDescription('At full hit points')
    expect(rows()).toEqual(['Fighter 5Hit dice 3/5 d10 · ChampionUse'])
    await user.click(use)
    expect(onRollFormula).not.toHaveBeenCalled()
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

  it("lists a favorite Cast's spell's later activities beneath it, as its tab does, from module 0.20.0", async () => {
    const user = userEvent.setup()
    const sheet = castingSheet({
      favorites: [
        {
          type: 'activity',
          id: 'cast-hex',
          itemId: 'flame',
          itemType: 'weapon',
          itemName: 'Bardic Flame',
          name: 'Hex',
          img: null,
          activation: 'Bonus Action',
          range: '90 ft',
          target: null,
          toHit: null,
          save: null,
          damage: [],
          uses: null,
          activity: {
            id: 'cast-hex',
            type: 'utility',
            targets: {
              self: false,
              area: false,
              count: 1,
              perLevel: null,
              affects: 'enemy',
            },
          },
          cast: { level: 1, concentration: true, charges: 1, short: false },
          spellId: 'hex',
        },
      ],
    })
    render(<FavoritesStrip {...propsFor(sheet)} onUse={jest.fn()} />)

    expect(rows()).toEqual([
      'HexBardic Flame · Bonus Action · 90 ft · 1 charge · 1 moreCast',
    ])
    await user.click(screen.getByRole('button', { name: /^Hex Bardic Flame/ }))
    expect(
      within(
        screen.getByRole('list', { name: 'Hex: its other activities' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^Hex \(Bonus Hex Damage\)Special · Necrotic1d6$/)
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

  describe('a resource that stands for a feature, from module 0.23.0', () => {
    it("shows the feature's action, with the resource's uses, opening to its description", async () => {
      const user = userEvent.setup()
      render(
        <FavoritesStrip
          {...propsFor(withFavorites([resource('Second Wind', 'second-wind')]))}
        />,
      )

      // As on the Actions tab, but with the resource's uses, not its own 1/1.
      expect(rows()).toEqual([
        'Second WindBonus Action · Self · Healing0/10 of 1 uses left1d10 + 5',
      ])
      expect(screen.getByText('0 of 1 uses left').parentElement).toHaveClass(
        'text-ruby',
      )
      // Shown in a list however narrow, which its own uses beside what it rolls are not.
      expect(screen.getByText('0 of 1 uses left').closest('.hidden')).toBeNull()
      expect(screen.queryByText('1 of 1 uses left')).toBeNull()

      await user.click(screen.getByText('Second Wind'))

      expect(screen.getByText('0 of 1 left, Short Rest')).toBeInTheDocument()
      expect(await screen.findByText('Fifty feet of rope.')).toBeInTheDocument()
      expect(fetch).toHaveBeenCalledWith(
        `/api/characters/char-1/texts/${TEXTS.secondWind}`,
        { signal: expect.any(AbortSignal) },
      )
    })

    it("uses the sheet's own action in the game from its chips", async () => {
      const user = userEvent.setup()
      const onUse = jest.fn()
      const sheet = withFavorites([resource('Second Wind', 'second-wind')])
      const [, bonus] = sheet.actions
      bonus.actions[0] = {
        ...bonus.actions[0],
        activity: {
          id: 'breather',
          type: 'heal',
          targets: {
            self: true,
            area: false,
            count: null,
            perLevel: null,
            affects: 'self',
          },
        },
      }
      const props = propsFor(sheet)
      render(<FavoritesStrip {...props} onUse={onUse} />)

      await user.click(
        screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
      )

      expect(onUse).toHaveBeenCalledTimes(1)
      expect(onUse.mock.calls[0][0]).toBe(props.sheet.actions[1].actions[0])
      expect(onUse.mock.calls[0][0].uses).toEqual({
        value: 1,
        max: 1,
        recovery: 'Short Rest, Long Rest',
      })
    })

    it('names the resource first where it stands for a feature of another name', () => {
      render(
        <FavoritesStrip
          {...propsFor(
            withFavorites([
              resource('Ki', 'second-wind', {
                value: 3,
                max: 5,
                recovery: 'Short Rest',
              }),
            ]),
          )}
        />,
      )

      expect(rows()).toEqual([
        'Second WindKi · Bonus Action · Self · Healing3/53 of 5 uses left1d10 + 5',
      ])
    })

    it('names the resource first before a passive feature of another name', () => {
      render(
        <FavoritesStrip
          {...propsFor(withFavorites([resource('Ki', 'darkvision')]))}
        />,
      )

      expect(rows()).toEqual(['DarkvisionKi · Passive0/10 of 1 uses left'])
    })

    it("shows the resource's uses on a feature that rolls but isn't among the actions", () => {
      const sheet = withFavorites([
        resource('Ki', 'second-wind', {
          value: 3,
          max: 5,
          recovery: 'Short Rest',
        }),
      ])
      // As a player may take it off Tidy 5e's Actions list, while it still rolls on Features.
      const [, bonus] = sheet.actions
      bonus.actions = bonus.actions.filter(({ id }) => id !== 'second-wind')
      const [fighter] = sheet.features
      fighter.features[0] = {
        ...fighter.features[0],
        damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
      }
      render(<FavoritesStrip {...propsFor(sheet)} />)

      expect(rows()).toEqual([
        'Second WindKi · 1 Bonus Action · Healing3/53 of 5 uses left1d10 + 5',
      ])
      expect(screen.getByText('3 of 5 uses left').closest('.hidden')).toBeNull()
      expect(screen.queryByText('1 of 1 uses left')).toBeNull()
    })

    it("shows a passive feature as its tab does, with the resource's uses, opening to its description", async () => {
      const user = userEvent.setup()
      const sheet = withFavorites([resource('Darkvision', 'darkvision')])
      sheet.features[1].features[0].text = TEXTS.fighter
      render(<FavoritesStrip {...propsFor(sheet)} />)

      expect(rows()).toEqual(['DarkvisionPassive0/10 of 1 uses left'])

      await user.click(screen.getByText('Darkvision'))

      expect(await screen.findByText('Fifty feet of rope.')).toBeInTheDocument()
      expect(fetch).toHaveBeenCalledWith(
        `/api/characters/char-1/texts/${TEXTS.fighter}`,
        { signal: expect.any(AbortSignal) },
      )
    })

    it('keeps a counter of one the module says stands for nothing', () => {
      render(
        <FavoritesStrip
          {...propsFor(withFavorites([resource('Second Wind', null)]))}
        />,
      )

      expect(rows()).toEqual(['Second WindShort Rest0/10 of 1 uses left'])
    })
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

/** A menu's items, by their names. */
const itemsOf = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map(item => item.textContent)

/** A plain row's part that would open a menu, by its name. */
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

describe('components/character-sheet/favorites, removed from the app, from module 0.37.0', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** The strip, inside a pane that offers favorites, each of these one. */
  const renderOffered = (favorites: SheetFavorite[] = sheetFavorites()) => {
    const offering = offeringFavorites([
      'item:warhammer',
      'activity:staff.cast-fireball',
      'effect:blessed',
    ])
    render(
      <Favoriting value={offering.value}>
        <FavoritesStrip {...propsFor(withFavorites(favorites))} />
      </Favoriting>,
    )
    return offering
  }

  it('offers Remove from favorites on an item among them, which removes the item', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Warhammer/, expanded: false }),
      { button: 2 },
    )
    const menu = screen.getByRole('menu', { name: 'Warhammer' })
    expect(itemsOf(menu)).toEqual(['Remove from favorites'])
    await user.click(within(menu).getByRole('menuitem'))
    expect(offering.chosen).toEqual([
      {
        target: { type: 'item', id: 'warhammer' },
        name: 'Warhammer',
        op: 'remove',
      },
    ])
  })

  it('removes an activity among them as the activity, never its item', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Cast Fireball/, expanded: false }),
      { button: 2 },
    )
    await user.click(
      within(screen.getByRole('menu', { name: 'Cast Fireball' })).getByRole(
        'menuitem',
        { name: 'Remove from favorites' },
      ),
    )
    expect(offering.chosen).toEqual([
      {
        target: { type: 'activity', id: 'cast-fireball', item: 'staff' },
        name: 'Cast Fireball',
        op: 'remove',
      },
    ])
  })

  it.each([
    ['a class', item('fighter', 'class'), 'Fighter 5'],
    [
      'anything else the sheet lists nowhere else',
      item('soldier', 'background', 'Soldier'),
      'Soldier',
    ],
  ])(
    'offers Remove from favorites on %s among them, which removes it as its item',
    async (_kind, favorite, name) => {
      const user = userEvent.setup()
      const offering = offeringFavorites([`item:${favorite.id}`])
      render(
        <Favoriting value={offering.value}>
          <FavoritesStrip {...propsFor(withFavorites([favorite]))} />
        </Favoriting>,
      )
      fireEvent.contextMenu(rowOf(name), { button: 2 })
      const menu = screen.getByRole('menu', { name })
      expect(itemsOf(menu)).toEqual(['Remove from favorites'])
      await user.click(within(menu).getByRole('menuitem'))
      expect(offering.chosen).toEqual([
        { target: { type: 'item', id: favorite.id }, name, op: 'remove' },
      ])
    },
  )

  it('removes an effect among them as the effect', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    fireEvent.contextMenu(rowOf('Bless'), { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Bless' })).getByRole('menuitem'),
    )
    expect(offering.chosen).toEqual([
      {
        target: { type: 'effect', id: 'blessed' },
        name: 'Bless',
        op: 'remove',
      },
    ])
  })

  it('offers none on a resource, spell slots, or a skill, which keeps its roll menu', () => {
    renderOffered()
    for (const name of ['Superiority Dice', '1st Level']) {
      expect(fireEvent.contextMenu(rowOf(name), { button: 2 })).toBe(true)
      expect(screen.queryByRole('menu')).toBeNull()
    }
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Perception check/ }),
    )
    expect(itemsOf(screen.getByRole('menu'))).toEqual([
      'Roll with advantage',
      'Roll with disadvantage',
      'Modify roll…',
    ])
  })

  it('offers none on a feature a resource stands for, whose place is the resource’s', () => {
    renderOffered([resource('Second Wind', 'second-wind')])
    const name = screen.getByRole('button', {
      name: /^Second Wind/,
      expanded: false,
    })
    expect(fireEvent.contextMenu(name, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('leaves an action’s chips their roll menus', () => {
    renderOffered()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    expect(screen.getByRole('menu')).not.toHaveAccessibleName('Warhammer')
  })
})
