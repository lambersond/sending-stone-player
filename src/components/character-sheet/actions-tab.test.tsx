/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsTab } from './actions-tab'
import { FavoriteMarks } from './favorite-mark'
import {
  characterSheet,
  fullerSheet,
  sheetAction,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetAction } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) => {
  const onRoll = jest.fn()
  const onRollDamage = jest.fn()
  render(
    <ActionsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
      onRoll={onRoll}
      onRollDamage={onRollDamage}
    />,
  )
  return { onRoll, onRollDamage }
}

/** A sheet whose only actions are these, under Actions. */
const withActions = (...actions: SheetAction[]) =>
  characterSheet({ actions: [{ id: 'action', label: 'Actions', actions }] })

/** The button that opens an action, named for it. */
const toggle = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`), expanded: false })

/** What holds an action's uses, found by them, such as 7/10. */
const pill = (text: string) =>
  screen.getByText(text).parentElement?.parentElement

const rows = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map(item => item.textContent)

/** Each group in a section, by its name, with its actions' names. */
const groups = (region: HTMLElement) =>
  within(region)
    .getAllByRole('group')
    .map(group => [
      // Its name, which is what labels it, without its count and slots.
      within(group).getByRole('heading', { level: 3 }).querySelector('[id]')
        ?.textContent,
      within(group)
        .queryAllByRole('listitem')
        .map(item => item.querySelector('button .font-medium')?.textContent),
    ])

/** The sheet as wide as a tablet's, or a phone's. */
const sheetWidth = (width: number) =>
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)

describe('components/character-sheet/actions-tab', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ html: '<p>A heavy hammer.</p>' }),
        }) as Response,
    )
  })

  it('lists actions by how they are activated, with what each rolls', () => {
    renderTab()

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map(heading => heading.textContent),
    ).toEqual(['Actions', 'Bonus Actions', 'Reactions', 'Special'])
    expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
      'WarhammerAction · reach 5 ft · Bludgeoning+71d8 + 4',
      'HandaxeAction · reach 5 ft or range 20/60 ft · Slashing+71d6 + 4',
      'GuidanceAction · Touch',
      'Fire BreathAction · 15 ft · Fire1/11 of 1 uses leftDEX 132d6',
    ])
    expect(rows(screen.getByRole('region', { name: 'Bonus Actions' }))).toEqual(
      ['Second WindBonus Action · Self · Healing1/11 of 1 uses left1d10 + 5'],
    )
    expect(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    ).toHaveClass('text-attack')
    expect(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    ).toHaveClass('text-damage')
    expect(
      screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
    ).toHaveClass('text-primary')
    expect(screen.getByTitle('DEX saving throw')).toHaveTextContent('DEX 13')
  })

  it('rolls an attack, or from its menu, with advantage and the like', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderTab()

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

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Handaxe attack, +7' }),
    )
    const menu = screen.getByRole('menu', { name: 'Handaxe attack +7' })
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Roll with advantage' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith({
      label: 'Handaxe attack',
      modifier: 7,
      advantage: 'adv',
      source: { kind: 'attack', item: 'handaxe', activity: 'handaxeAttack' },
      explicit: true,
    })
  })

  it("rolls damage, or a critical hit's from its menu", async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab()
    const damage = {
      label: 'Warhammer damage',
      parts: [
        {
          terms: [
            { sign: 1, count: 1, sides: 8 },
            { sign: 1, flat: 4 },
          ],
          type: 'Bludgeoning',
        },
      ],
      healing: false,
      // The attack it's the damage of, whose damage may be due at the table.
      source: { item: 'warhammer', activity: 'warhammerAttack' },
    }

    await user.click(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith({
      ...damage,
      critical: false,
    })

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    const menu = screen.getByRole('menu', {
      name: 'Warhammer damage 1d8 + 4',
    })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll critical damage'])
    await user.click(within(menu).getByRole('menuitem'))
    expect(onRollDamage).toHaveBeenLastCalledWith({ ...damage, critical: true })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('rolls healing, which has no critical hit', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab()

    const healing = screen.getByRole('button', {
      name: 'Second Wind healing, 1d10 + 5',
    })
    fireEvent.contextMenu(healing)
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(healing)

    expect(onRollDamage).toHaveBeenLastCalledWith({
      label: 'Second Wind healing',
      parts: [
        {
          terms: [
            { sign: 1, count: 1, sides: 10 },
            { sign: 1, flat: 5 },
          ],
          type: 'Healing',
        },
      ],
      healing: true,
      critical: false,
    })
  })

  it('rolls every part of damage of several kinds together', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab(
      withActions(
        sheetAction({
          id: 'flame-tongue',
          name: 'Flame Tongue',
          toHit: 8,
          damage: [
            { formula: '1d8 + 5', type: 'Slashing', healing: false },
            { formula: '2d6', type: 'Fire', healing: false },
          ],
        }),
      ),
    )

    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Flame TongueAction · Slashing, Fire+81d8 + 5 + 2d6',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Flame Tongue damage, 1d8 + 5 + 2d6',
      }),
    )
    expect(onRollDamage.mock.calls[0][0].parts).toEqual([
      {
        terms: [
          { sign: 1, count: 1, sides: 8 },
          { sign: 1, flat: 5 },
        ],
        type: 'Slashing',
      },
      { terms: [{ sign: 1, count: 2, sides: 6 }], type: 'Fire' },
    ])
  })

  it('keeps uses out of the way of what an action rolls, on a phone', () => {
    renderTab(
      withActions(
        sheetAction({
          id: 'staff',
          name: 'Staff of Fire',
          toHit: 2,
          uses: { value: 7, max: 10, recovery: 'Dawn' },
        }),
        sheetAction({
          id: 'wand',
          name: 'Wand of Magic Missiles',
          uses: { value: 5, max: 7, recovery: 'Dawn' },
        }),
      ),
    )

    expect(pill('7/10')).toHaveClass('hidden', '@md:inline')
    expect(pill('5/7')).not.toHaveClass('hidden')
  })

  it("shows a formula it can't read without rolling it", () => {
    renderTab(
      withActions(
        sheetAction({
          id: 'odd',
          name: 'Odd Blade',
          damage: [{ formula: 'max(1, 1d4)', type: null, healing: false }],
        }),
      ),
    )

    expect(screen.getByText('max(1, 1d4)').tagName).toBe('SPAN')
    expect(screen.queryByRole('button', { name: /damage/ })).toBeNull()
  })

  it('opens an action to all there is to know of it, and its description', async () => {
    const user = userEvent.setup()
    renderTab()

    const opener = toggle('Warhammer')
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(fetch).not.toHaveBeenCalled()
    await user.click(opener)

    expect(opener).toHaveAttribute('aria-expanded', 'true')
    const body = (opener.closest('li') as HTMLElement).querySelector(
      '[id]',
    ) as HTMLElement
    expect(body.id).toBe(opener.getAttribute('aria-controls'))
    expect(within(body).getByText('Weapon')).toBeInTheDocument()
    expect(
      within(body)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Activation: Action',
      'Range: reach 5 ft',
      'Target: 1 Creature',
      'To hit: +7',
      'Damage: 1d8 + 4 Bludgeoning',
    ])
    expect(await within(body).findByText('A heavy hammer.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.warhammer}`,
      { signal: expect.any(AbortSignal) },
    )

    await user.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(opener).not.toHaveAttribute('aria-controls')
    expect(body).not.toBeInTheDocument()
  })

  it('opens to a saving throw, uses and healing in words', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(toggle('Fire Breath'))
    await user.click(toggle('Second Wind'))

    const terms = screen
      .getAllByRole('term')
      .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`)
    expect(terms).toEqual([
      'Activation: Action',
      'Range: 15 ft',
      'Target: 15 ft Cone',
      'Saving throw: DC 13 DEX',
      'Damage: 2d6 Fire',
      'Uses: 1 of 1 left, Long Rest',
      'Activation: Bonus Action',
      'Range: Self',
      'Healing: 1d10 + 5',
      'Uses: 1 of 1 left, Short Rest, Long Rest',
    ])
    expect(screen.getAllByText('Feature')).toHaveLength(2)
  })

  it("names a spell's level and concentration, and an unidentified item's secret", async () => {
    const user = userEvent.setup()
    renderTab(
      withActions(
        sheetAction({
          id: 'guidance',
          name: 'Guidance',
          type: 'spell',
          level: 0,
          concentration: true,
        }),
        sheetAction({ id: 'shield', name: 'Shield', type: 'spell', level: 1 }),
        sheetAction({
          id: 'odd',
          name: 'Strange Wand',
          type: 'equipment',
          identified: false,
          activation: null,
        }),
      ),
    )

    for (const name of ['Guidance', 'Shield', 'Strange Wand']) {
      await user.click(toggle(name))
    }

    expect(screen.getByText('Cantrip · Concentration')).toBeInTheDocument()
    expect(screen.getByText('Level 1 spell')).toBeInTheDocument()
    expect(screen.getByText('Equipment · Not identified')).toBeInTheDocument()
    const wand = screen
      .getByRole('button', { name: /^Strange Wand/ })
      .closest('li') as HTMLElement
    expect(within(wand).queryByRole('term')).toBeNull()
  })

  it('opens an action of a kind it has no name for to just its facts', async () => {
    const user = userEvent.setup()
    renderTab(
      withActions(
        sheetAction({ id: 'odd', name: 'Odd Thing', type: 'container' }),
      ),
    )

    await user.click(toggle('Odd Thing'))

    const item = screen.getByRole('listitem')
    expect(item.querySelector('p')).toBeNull()
    expect(within(item).getByRole('term')).toHaveTextContent('Activation')
  })

  it('names a section the player named in Tidy 5e, whatever its name', () => {
    renderTab(
      characterSheet({
        actions: [
          {
            id: 'Rage & Fury',
            label: 'Rage & Fury',
            actions: [sheetAction({ id: 'rage', name: 'Rage' })],
          },
        ],
      }),
    )

    expect(
      screen.getByRole('region', { name: 'Rage & Fury' }),
    ).toHaveTextContent('Rage')
  })

  it("groups each section's actions by kind: weapons, spells as the spellbook groups them, features and items", () => {
    renderTab(
      characterSheet({
        spells: [
          {
            id: 'spell0',
            label: 'Cantrips',
            slots: null,
            spells: [sheetSpell({ id: 'bolt', name: 'Fire Bolt', level: 0 })],
          },
          {
            id: 'pact',
            label: 'Pact Magic — 3rd Level',
            slots: { value: 2, max: 2, level: 3 },
            spells: [sheetSpell({ id: 'hex', name: 'Hex', level: 1 })],
          },
          {
            id: 'spell3',
            label: '3rd Level',
            slots: { value: 1, max: 3, level: 3 },
            spells: [
              sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 }),
            ],
          },
        ],
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'potion',
                name: 'Potion of Healing',
                type: 'consumable',
              }),
              sheetAction({
                id: 'fireball',
                name: 'Fireball',
                type: 'spell',
                level: 3,
              }),
              sheetAction({ id: 'dagger', name: 'Dagger', type: 'weapon' }),
              sheetAction({ id: 'hex', name: 'Hex', type: 'spell', level: 1 }),
              sheetAction({ id: 'breath', name: 'Fire Breath' }),
              sheetAction({
                id: 'bolt',
                name: 'Fire Bolt',
                type: 'spell',
                level: 0,
              }),
            ],
          },
        ],
      }),
    )

    const actions = screen.getByRole('region', { name: 'Actions' })
    expect(groups(actions)).toEqual([
      ['Weapons', ['Dagger']],
      ['Consumables', ['Potion of Healing']],
      ['Cantrips', ['Fire Bolt']],
      ['Pact Magic — 3rd Level', ['Hex']],
      ['3rd Level', ['Fireball']],
      ['Features', ['Fire Breath']],
    ])
    expect(
      within(actions).getByRole('button', { name: /^Weapons/ }),
    ).toHaveTextContent('Weapons1, 1 action')
    expect(
      within(actions).getByRole('group', { name: '3rd Level' }),
    ).toHaveTextContent('1 of 3 spell slots left')
    expect(
      within(actions).getByRole('group', { name: 'Pact Magic — 3rd Level' }),
    ).toHaveTextContent('2 of 2 spell slots left')
    expect(
      within(actions).getByRole('group', { name: 'Cantrips' }),
    ).not.toHaveTextContent('spell slots')
  })

  it('opens a spell to the slots it can be cast with, and dims one with none left', async () => {
    const user = userEvent.setup()
    renderTab(
      characterSheet({
        spells: [
          {
            id: 'spell1',
            label: '1st Level',
            slots: { value: 0, max: 4, level: 1 },
            spells: [
              sheetSpell({ id: 'missile', name: 'Magic Missile', level: 1 }),
            ],
          },
          {
            id: 'spell2',
            label: '2nd Level',
            slots: { value: 1, max: 3, level: 2 },
            spells: [],
          },
          {
            id: 'spell3',
            label: '3rd Level',
            slots: { value: 0, max: 2, level: 3 },
            spells: [
              sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 }),
            ],
          },
        ],
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'missile',
                name: 'Magic Missile',
                type: 'spell',
                level: 1,
              }),
              sheetAction({
                id: 'fireball',
                name: 'Fireball',
                type: 'spell',
                level: 3,
              }),
            ],
          },
        ],
      }),
    )

    expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
      'Magic MissileAction',
      'FireballAction · No slots left',
    ])
    expect(toggle('Fireball')).toHaveClass('opacity-60')
    expect(toggle('Magic Missile')).not.toHaveClass('opacity-60')

    await user.click(toggle('Magic Missile'))
    const castAt = screen.getByText('Cast at').nextElementSibling as HTMLElement
    expect(
      within(castAt)
        .getAllByRole('listitem')
        .map(pool => pool.textContent),
    ).toEqual([
      '1st 0/41st Level, 0 of 4 slots left',
      '2nd 1/32nd Level, 1 of 3 slots left',
      '3rd 0/23rd Level, 0 of 2 slots left',
    ])
    expect(within(castAt).getAllByRole('listitem')[0]).toHaveClass('text-ruby')
  })

  it('dims a spell with no slot left in a table too, and says so', async () => {
    const user = userEvent.setup()
    localStorage.setItem('sending-stone:actions-layout', 'table')
    sheetWidth(800)
    renderTab(
      characterSheet({
        spells: [
          {
            id: 'spell1',
            label: '1st Level',
            slots: { value: 0, max: 4, level: 1 },
            spells: [
              sheetSpell({ id: 'missile', name: 'Magic Missile', level: 1 }),
            ],
          },
          {
            id: 'spell2',
            label: '2nd Level',
            slots: { value: 1, max: 3, level: 2 },
            spells: [],
          },
          {
            id: 'spell3',
            label: '3rd Level',
            slots: { value: 0, max: 2, level: 3 },
            spells: [
              sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 }),
            ],
          },
        ],
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'missile',
                name: 'Magic Missile',
                type: 'spell',
                level: 1,
              }),
              sheetAction({
                id: 'fireball',
                name: 'Fireball',
                type: 'spell',
                level: 3,
              }),
            ],
          },
        ],
      }),
    )

    const table = screen.getByRole('table', { name: 'Actions' })
    const fireball = within(table).getByRole('button', { name: /^Fireball/ })
    expect(fireball).toHaveTextContent('FireballNo slots left')
    expect(fireball).toHaveClass('opacity-60')
    expect(
      within(table).getByRole('button', { name: /^Magic Missile/ }),
    ).not.toHaveClass('opacity-60')

    await user.click(fireball)
    expect(
      within(screen.getByText('Cast at').nextElementSibling as HTMLElement)
        .getAllByRole('listitem')
        .map(pool => pool.textContent),
    ).toEqual(['3rd 0/23rd Level, 0 of 2 slots left'])
  })

  it('closes a group, and keeps it closed for the character, in a list or a table', async () => {
    const user = userEvent.setup()
    sheetWidth(800)
    renderTab()
    const actions = () => screen.getByRole('region', { name: 'Actions' })
    const weapons = () =>
      within(actions()).getByRole('button', { name: /^Weapons/ })

    expect(weapons()).toHaveAttribute('aria-expanded', 'true')
    await user.click(weapons())

    expect(weapons()).toHaveAttribute('aria-expanded', 'false')
    expect(rows(actions())).toEqual([
      'GuidanceAction · Touch',
      'Fire BreathAction · 15 ft · Fire1/11 of 1 uses leftDEX 132d6',
    ])
    expect(
      JSON.parse(
        localStorage.getItem('sending-stone:actions-closed:char-1') ?? '',
      ),
    ).toEqual(['action/weapons'])

    cleanup()
    renderTab()
    expect(weapons()).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Table' }))
    const table = screen.getByRole('table', { name: 'Actions' })
    expect(
      within(table).queryByRole('button', { name: /^Warhammer/ }),
    ).toBeNull()
    expect(
      within(table).getByRole('button', { name: /^Weapons/ }),
    ).toHaveAttribute('aria-expanded', 'false')

    await user.click(within(table).getByRole('button', { name: /^Weapons/ }))
    expect(
      within(table).getByRole('button', { name: 'Warhammer' }),
    ).toBeVisible()
    expect(localStorage.getItem('sending-stone:actions-closed:char-1')).toBe(
      '[]',
    )
  })

  it("puts spells cast from an item under its name, after the spellbook's", () => {
    const wand = { id: 'wand', name: 'Wand of Magic Missiles' }
    renderTab(
      characterSheet({
        spells: [
          {
            id: 'spell0',
            label: 'Cantrips',
            slots: null,
            spells: [sheetSpell({ id: 'bolt', name: 'Fire Bolt', level: 0 })],
          },
        ],
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({ id: 'wand', name: wand.name, type: 'consumable' }),
              sheetAction({
                id: 'wand-missile',
                name: 'Magic Missile',
                type: 'spell',
                level: 1,
                castFrom: wand,
              }),
              sheetAction({
                id: 'coat-hands',
                name: 'Burning Hands',
                type: 'spell',
                level: 1,
                castFrom: { id: 'coat', name: 'Cinder Coat' },
              }),
              sheetAction({
                id: 'bolt',
                name: 'Fire Bolt',
                type: 'spell',
                level: 0,
              }),
            ],
          },
        ],
      }),
    )

    expect(groups(screen.getByRole('region', { name: 'Actions' }))).toEqual([
      ['Consumables', ['Wand of Magic Missiles']],
      ['Cantrips', ['Fire Bolt']],
      ['Wand of Magic Missiles', ['Magic Missile']],
      ['Cinder Coat', ['Burning Hands']],
    ])
  })

  it('offers no layouts on a phone, keeping to the list whatever was chosen', () => {
    localStorage.setItem('sending-stone:actions-layout', 'table')
    sheetWidth(390)
    renderTab()

    expect(screen.queryByRole('group', { name: 'Layout' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'Actions' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(4)
  })

  it('lays actions out in a table on a tablet, lining up what each rolls, and remembers it', async () => {
    const user = userEvent.setup()
    sheetWidth(800)
    const { onRoll } = renderTab()

    const picker = screen.getByRole('group', { name: 'Layout' })
    expect(
      within(picker)
        .getAllByRole('button')
        .map(button => [
          button.textContent,
          button.getAttribute('aria-pressed'),
        ]),
    ).toEqual([
      ['List', 'true'],
      ['Columns', 'false'],
      ['Table', 'false'],
    ])
    await user.click(within(picker).getByRole('button', { name: 'Table' }))

    expect(localStorage.getItem('sending-stone:actions-layout')).toBe('table')
    const table = screen.getByRole('table', { name: 'Actions' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent),
    ).toEqual(['Name', 'Range', 'Hit / DC', 'Damage', 'Uses'])
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map(header => header.textContent),
    ).toEqual([
      'Weapons2, 2 actions',
      'Cantrips1, 1 action',
      'Features1, 1 action',
    ])
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map(row =>
          within(row)
            .queryAllByRole('cell')
            .map(cell => cell.textContent),
        ),
    ).toEqual([
      [],
      ['Warhammer', 'reach 5 ft', '+7', '1d8 + 4', ''],
      ['Handaxe', 'reach 5 ft or range 20/60 ft', '+7', '1d6 + 4', ''],
      [],
      ['Guidance', 'Touch', '', '', ''],
      [],
      ['Fire Breath', '15 ft', 'DEX 13', '2d6', '1/11 of 1 uses left'],
    ])
    expect(
      within(screen.getByRole('table', { name: 'Reactions' })).getAllByRole(
        'rowheader',
      )[0],
    ).toHaveTextContent('1st Level1, 1 action1/21 of 2 spell slots left')

    await user.click(
      within(table).getByRole('button', { name: 'Warhammer attack, +7' }),
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

    await user.click(within(table).getByRole('button', { name: 'Fire Breath' }))
    const details = screen.getByText('Saving throw').closest('td')
    expect(details).toHaveAttribute('colspan', '5')
    expect(details?.closest('tr')).toHaveAttribute(
      'id',
      within(table)
        .getByRole('button', { name: 'Fire Breath', expanded: true })
        .getAttribute('aria-controls'),
    )
  })

  it('lays sections out side by side on a tablet: Actions in a column, the rest beside it', async () => {
    const user = userEvent.setup()
    sheetWidth(800)
    renderTab()

    await user.click(screen.getByRole('button', { name: 'Columns' }))

    expect(screen.getByRole('button', { name: 'Columns' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const actions = screen.getByRole('region', { name: 'Actions' })
    const grid = actions.parentElement?.parentElement as HTMLElement
    expect(grid).toHaveClass('grid-cols-2', '@6xl:grid-cols-3')
    const [first, second] = [...grid.children]
    expect(
      within(first as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map(heading => heading.textContent),
    ).toEqual(['Actions'])
    expect(
      within(second as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map(heading => heading.textContent),
    ).toEqual(['Bonus Actions', 'Reactions', 'Special'])
    expect(second).toHaveClass('@6xl:contents')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it("offers no columns where two don't fit side by side, as beside the chat on a tablet, listing them instead", () => {
    localStorage.setItem('sending-stone:actions-layout', 'columns')
    sheetWidth(640)
    renderTab()

    expect(
      within(screen.getByRole('group', { name: 'Layout' }))
        .getAllByRole('button')
        .map(button => [
          button.textContent,
          button.getAttribute('aria-pressed'),
        ]),
    ).toEqual([
      ['List', 'true'],
      ['Table', 'false'],
    ])
    expect(
      within(screen.getByRole('region', { name: 'Actions' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(4)
  })

  it('remembers the layout chosen, in this browser', () => {
    localStorage.setItem('sending-stone:actions-layout', 'columns')
    sheetWidth(800)
    renderTab()

    expect(screen.getByRole('button', { name: 'Columns' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('puts a lone section in a column of its own', async () => {
    const user = userEvent.setup()
    sheetWidth(800)
    renderTab(withActions(sheetAction({ id: 'dagger', name: 'Dagger' })))

    await user.click(screen.getByRole('button', { name: 'Columns' }))

    const grid = screen.getByRole('region', { name: 'Actions' }).parentElement
      ?.parentElement as HTMLElement
    expect(grid.children).toHaveLength(1)
  })

  it('says so when there are no actions to show, as from an older module', () => {
    sheetWidth(800)
    renderTab(characterSheet())

    expect(screen.getByText('No actions to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Layout' })).toBeNull()
  })

  it('stars a favorite, in a list and in a table, and shows first what it is given, such as the favorites', () => {
    sheetWidth(600)
    const sheet = toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')
    const tab = (
      <FavoriteMarks keys={new Set(['item:warhammer'])}>
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          favorites={<p>Her favorites</p>}
        />
      </FavoriteMarks>
    )
    render(tab)

    expect(
      screen.getByRole('button', { name: /^Warhammer\s*, favorite/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(', favorite')).toHaveLength(1)
    expect(
      screen
        .getByText('Her favorites')
        .compareDocumentPosition(screen.getByRole('group', { name: 'Layout' })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    cleanup()
    localStorage.setItem('sending-stone:actions-layout', 'table')
    render(tab)
    expect(
      within(screen.getAllByRole('table')[0]).getByRole('button', {
        name: /^Warhammer\s*, favorite/,
      }),
    ).toBeInTheDocument()
  })
})
