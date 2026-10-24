/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { castNote, verbOf } from './action-entry'
import { ActionsTab } from './actions-tab'
import { FavoriteMarks } from './favorite-mark'
import { SheetIdPrefix } from '@/hooks/use-sheet-ids'
import { fireBreath, lightningBreath, spiritSheet } from '@/mocks/alone'
import {
  castingSheet,
  characterSheet,
  fullerSheet,
  sheetAction,
  sheetSpell,
  TEXTS,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Layout } from './actions-layout'
import type {
  CharacterSheet,
  SheetAction,
  SheetActionSection,
  SheetActivity,
  SheetSpell,
} from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet(), layout?: Layout) => {
  const onRoll = jest.fn()
  const onRollDamage = jest.fn()
  render(
    <ActionsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
      onRoll={onRoll}
      onRollDamage={onRollDamage}
      layout={layout}
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

/** What's listed beneath an action, of its other activities. */
const others = (name: string) =>
  within(screen.getByRole('list', { name: `${name}: its other activities` }))
    .getAllByRole('listitem')
    .map(item => item.textContent)

/** An element's facts, each with its label, such as "Range: 60 ft". */
/** What the menu a right-click on this button opens offers, closing it again; none for no menu. */
const menuOf = (name: string) => {
  fireEvent.contextMenu(screen.getByRole('button', { name }))
  const menu = screen.queryByRole('menu')
  const items = menu
    ? within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    : undefined
  if (menu) fireEvent.keyDown(menu, { key: 'Escape' })
  return items
}

const factsIn = (element: HTMLElement) =>
  within(element)
    .getAllByRole('term')
    .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`)

/** The button beside one of an item's activities that opens what there is to read of it. */
const about = (name: string) =>
  screen.getByRole('button', { name: `About ${name}` })

/** The button that opens the Bardic Flame's row in a section. */
const flameRow = (section: string) =>
  within(screen.getByRole('region', { name: section })).getByRole('button', {
    name: /^Bardic Flame/,
    expanded: false,
  })

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

/** A cast's levels from the 1st, each costing as many charges, each short or not as given. */
const castLevels = (...short: boolean[]) =>
  short.map((each, index) => ({
    level: index + 1,
    charges: index + 1,
    short: each,
  }))

/** A spell's activity, as the Spells tab's copy lists it. */
const spellActivity = (
  fields: Partial<SheetActivity> & Pick<SheetActivity, 'id' | 'name'>,
): SheetActivity => ({
  type: 'utility',
  activation: 'Action',
  range: 'Self',
  target: null,
  toHit: null,
  attackId: null,
  activity: null,
  save: null,
  damage: [],
  uses: null,
  ...fields,
})
/** A copy of a spell an item casts, as the Spells tab lists it under the item. */
const copyOf = (
  fields: Partial<SheetSpell> & Pick<SheetSpell, 'id' | 'name'>,
  from: { id: string; name: string },
  activities: SheetActivity[],
) =>
  sheetSpell({
    level: 3,
    castFrom: from,
    activity: activities[0].activity,
    save: activities[0].save,
    damage: activities[0].damage,
    activities,
    ...fields,
  })
/** A sheet with these actions, and these copies listed under their items. */
const castingWith = (actions: SheetAction[], copies: SheetSpell[]) =>
  characterSheet({
    actions: [{ id: 'action', label: 'Actions', actions }],
    spells: [{ id: 'item', label: 'Item Spells', slots: null, spells: copies }],
  })

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
    ).toHaveClass('text-primary-text')
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

  it("rolls damage, or from its menu a critical hit's, its highest, or with its dice changed", async () => {
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
    ).toEqual(['Roll critical damage', 'Roll maximum damage', 'Modify damage…'])
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Roll critical damage' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith({ ...damage, critical: true })
    expect(screen.queryByRole('menu')).toBeNull()

    const chip = screen.getByRole('button', {
      name: 'Warhammer damage, 1d8 + 4',
    })
    fireEvent.contextMenu(chip)
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll maximum damage' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith({
      ...damage,
      critical: false,
      modifiers: { maximize: true },
    })

    // Two more dice, made d12s, as a critical hit's.
    fireEvent.contextMenu(chip)
    await user.click(screen.getByRole('menuitem', { name: 'Modify damage…' }))
    const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '1d8 + 4 Bludgeoning',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'One die more' }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'One die more' }),
    )
    await user.click(within(dialog).getByRole('radio', { name: 'd12' }))
    await user.click(
      within(dialog).getByRole('switch', { name: /^Critical hit/ }),
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '6d12 + 4 Bludgeoning',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Roll' }))
    expect(onRollDamage).toHaveBeenLastCalledWith({
      ...damage,
      critical: true,
      modifiers: { extra: 2, faces: 12 },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rolls healing, which has no critical hit, but can be at its highest', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderTab()

    const healing = screen.getByRole('button', {
      name: 'Second Wind healing, 1d10 + 5',
    })
    fireEvent.contextMenu(healing)
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['Roll maximum healing', 'Modify healing…'])
    await user.keyboard('{Escape}')
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
      'table',
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
    cleanup()
    renderTab(fullerSheet(), 'table')
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

  it('lays actions out in a table, lining up what each rolls', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderTab(fullerSheet(), 'table')

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

  it('lays sections out side by side: Actions in a column, the rest beside it', () => {
    renderTab(fullerSheet(), 'columns')

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

  it('puts a lone section in a column of its own', () => {
    renderTab(
      withActions(sheetAction({ id: 'dagger', name: 'Dagger' })),
      'columns',
    )

    const grid = screen.getByRole('region', { name: 'Actions' }).parentElement
      ?.parentElement as HTMLElement
    expect(grid.children).toHaveLength(1)
  })

  describe("an activity's own formula", () => {
    const lantern = sheetAction({
      id: 'lantern',
      name: 'Lantern of Revealing',
      activity: {
        id: 'lanternUse',
        type: 'utility',
        targets: {
          self: true,
          area: false,
          count: null,
          perLevel: null,
          affects: null,
        },
      },
      rollFormula: { formula: '1d4 + 3', name: 'Light radius' },
    })
    const renderWith = (sheet: CharacterSheet, layout?: Layout) => {
      const onRollFormula = jest.fn()
      render(
        <ActionsTab
          characterId='char-1'
          sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          onRollFormula={onRollFormula}
          layout={layout}
        />,
      )
      return onRollFormula
    }

    it('rolls it any time, apart from using it, for the game to roll too', async () => {
      const user = userEvent.setup()
      const onRollFormula = renderWith(withActions(lantern))

      const chip = screen.getByRole('button', {
        name: 'Roll Lantern of Revealing: Light radius, 1d4 + 3',
      })
      expect(chip).toHaveTextContent('1d4 + 3')
      expect(chip).toHaveAttribute('title', 'Light radius')
      await user.click(chip)
      expect(onRollFormula).toHaveBeenCalledWith({
        label: 'Lantern of Revealing: Light radius',
        terms: [
          { sign: 1, count: 1, sides: 4 },
          { sign: 1, flat: 3 },
        ],
        source: { kind: 'formula', item: 'lantern', activity: 'lanternUse' },
      })
    })

    it("rolls it here alone when the game can't use the activity, naming a formula without a name", async () => {
      const user = userEvent.setup()
      const onRollFormula = renderWith(
        withActions({
          ...lantern,
          activity: null,
          rollFormula: { formula: '2d6', name: null },
        }),
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Roll Lantern of Revealing roll, 2d6',
        }),
      )
      expect(onRollFormula).toHaveBeenCalledWith({
        label: 'Lantern of Revealing roll',
        terms: [{ sign: 1, count: 2, sides: 6 }],
      })
    })

    it("shows a formula it can't read, or of an item not identified, without rolling it", () => {
      renderWith(
        withActions(
          { ...lantern, rollFormula: { formula: '(1d4)*5', name: 'Fall' } },
          {
            ...lantern,
            id: 'orb',
            name: 'Strange Orb',
            identified: false,
            rollFormula: { formula: '1d6', name: null },
          },
        ),
      )

      expect(screen.getByText('(1d4)*5')).toBeInTheDocument()
      expect(screen.getByText('1d6')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Roll / })).toBeNull()
    })

    it('rolls it from a table too', async () => {
      const user = userEvent.setup()
      const onRollFormula = renderWith(withActions(lantern), 'table')

      const table = screen.getByRole('table', { name: 'Actions' })
      await user.click(
        within(table).getByRole('button', {
          name: 'Roll Lantern of Revealing: Light radius, 1d4 + 3',
        }),
      )
      expect(onRollFormula).toHaveBeenCalledTimes(1)
    })
  })

  describe('spells and features used in the game', () => {
    const targets = {
      self: false,
      area: false,
      count: null,
      perLevel: null,
      affects: null,
    }
    const breath = sheetAction({
      id: 'breath',
      name: 'Fire Breath',
      save: { ability: 'DEX', dc: 13 },
      damage: [{ formula: '2d6', type: 'Fire', healing: false }],
      activity: {
        id: 'breathSave',
        type: 'save',
        targets: { ...targets, area: true, affects: 'creature' },
      },
    })
    const missile = sheetAction({
      id: 'missile',
      name: 'Magic Missile',
      type: 'spell',
      level: 1,
      damage: [{ formula: '3d4 + 3', type: 'Force', healing: false }],
      activity: {
        id: 'missileDamage',
        type: 'damage',
        targets: { ...targets, count: 3, perLevel: 1, affects: 'creature' },
      },
    })
    const surge = sheetAction({
      id: 'surge',
      name: 'Action Surge',
      activity: { id: 'surgeUse', type: 'utility', targets },
    })
    const bless = sheetAction({
      id: 'bless',
      name: 'Bless',
      type: 'spell',
      level: 1,
      activity: {
        id: 'blessCast',
        type: 'utility',
        targets: { ...targets, count: 3, perLevel: 1, affects: 'ally' },
      },
    })
    // A spell attack's damage is its attack's, rolled once the attack is made.
    const bolt = sheetAction({
      id: 'bolt',
      name: 'Fire Bolt',
      type: 'spell',
      level: 0,
      attackId: 'boltAttack',
      toHit: 5,
      damage: [{ formula: '1d10', type: 'Fire', healing: false }],
    })
    // An item not identified yet keeps what it does to itself.
    const wand = sheetAction({
      id: 'wand',
      name: 'Strange Wand',
      identified: false,
      activity: { id: 'wandUse', type: 'utility', targets },
    })
    const sheet = toTableSheet(
      withActions(breath, missile, surge, bless, bolt, wand),
      'https://my-game.forge-vtt.com',
    )

    it('uses them from their chips while the game takes them, in a list and in a table', async () => {
      const user = userEvent.setup()
      const onUse = jest.fn()
      const onRoll = jest.fn()
      const onRollDamage = jest.fn()
      const tab = (layout: Layout) => (
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={onRoll}
          onRollDamage={onRollDamage}
          onUse={onUse}
          layout={layout}
        />
      )
      const { rerender } = render(tab('list'))
      const used = () => onUse.mock.calls.map(([action]) => action.id)

      await user.click(
        screen.getByRole('button', {
          name: 'Fire Breath, DEX saving throw DC 13',
        }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Fire Breath damage, 2d6' }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Magic Missile damage, 3d4 + 3' }),
      )
      await user.click(screen.getByRole('button', { name: 'Use Action Surge' }))
      await user.click(screen.getByRole('button', { name: 'Cast Bless' }))
      expect(used()).toEqual(['breath', 'breath', 'missile', 'surge', 'bless'])
      expect(screen.queryByRole('button', { name: /Strange Wand$/ })).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Fire Bolt damage, 1d10' }),
      )
      expect(onRollDamage).toHaveBeenCalledTimes(1)
      expect(onUse).toHaveBeenCalledTimes(5)

      rerender(tab('table'))
      const table = screen.getByRole('table', { name: 'Actions' })
      await user.click(
        within(table).getByRole('button', {
          name: 'Fire Breath, DEX saving throw DC 13',
        }),
      )
      await user.click(
        within(table).getByRole('button', { name: 'Use Action Surge' }),
      )
      await user.click(
        within(table).getByRole('button', {
          name: 'Magic Missile damage, 3d4 + 3',
        }),
      )
      expect(used().slice(5)).toEqual(['breath', 'surge', 'missile'])
    })

    /** An attack of this damage, rolled here, and a feature that deals it, used in the game. */
    const both = (id: string, name: string, formula: string) => [
      sheetAction({
        id: `${id}Attack`,
        name: `${name} Strike`,
        attackId: `${id}Hit`,
        toHit: 5,
        damage: [{ formula, type: 'Bludgeoning', healing: false }],
      }),
      sheetAction({
        id: `${id}Touch`,
        name: `${name} Touch`,
        damage: [{ formula, type: 'Necrotic', healing: false }],
        activity: {
          id: `${id}Damage`,
          type: 'damage',
          targets: { ...targets, count: 1, affects: 'creature' },
        },
      }),
    ]

    it('offers no change that takes away more, nor a menu with nothing in it, for damage that takes a die away', () => {
      render(
        <ActionsTab
          characterId='char-1'
          sheet={toTableSheet(
            withActions(
              // A Reduced Unarmed Strike's, as dnd5e labels it, which adds no die of its own.
              ...both('reduced', 'Reduced', '- 1d4 + 4'),
              // A greataxe's under Reduce.
              ...both('greataxe', 'Greataxe', '1d12 - 1d4 + 3'),
            ),
            'https://my-game.forge-vtt.com',
          )}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          onUse={jest.fn()}
          // Changed on purpose (round 0.36.0 §12): `TableDamage` says whether damage goes on its
          // own and recharges are taken, neither here.
          tableDamage={{
            modifies: true,
            dueFor: jest.fn(),
            sendsAlone: false,
            recharges: false,
          }}
        />,
      )

      expect(menuOf('Reduced Strike damage, - 1d4 + 4')).toEqual([
        'Roll critical damage',
      ])
      expect(menuOf('Reduced Touch damage, - 1d4 + 4')).toBeUndefined()
      expect(menuOf('Greataxe Strike damage, 1d12 - 1d4 + 3')).toEqual([
        'Roll critical damage',
        'Modify damage…',
      ])
      expect(menuOf('Greataxe Touch damage, 1d12 - 1d4 + 3')).toEqual([
        'Use with damage modified…',
      ])
    })

    it('rolls their chips here while the game takes none', async () => {
      const user = userEvent.setup()
      const { onRollDamage } = renderTab(
        withActions(breath, missile, surge, bless),
      )

      expect(
        screen.queryByRole('button', {
          name: 'Fire Breath, DEX saving throw DC 13',
        }),
      ).toBeNull()
      expect(screen.queryByRole('button', { name: /^(Use|Cast) / })).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Fire Breath damage, 2d6' }),
      )
      expect(onRollDamage).toHaveBeenCalledTimes(1)
    })
  })

  describe('items with more than one activity', () => {
    const targets = {
      self: false,
      area: false,
      count: 1,
      perLevel: null,
      affects: 'creature',
    }
    const curse = { id: 'curse', type: 'utility' as const, targets }
    // Hex is cast by its curse, its damage on a hit and moving the curse following without a slot.
    const hex = sheetAction({
      id: 'hex',
      name: 'Hex',
      type: 'spell',
      level: 1,
      activation: 'Bonus Action',
      range: '90 ft',
      activity: curse,
      activities: [
        {
          id: 'curse',
          name: 'Place Curse',
          type: 'utility',
          activation: 'Bonus Action',
          range: '90 ft',
          target: '1 Creature',
          toHit: null,
          attackId: null,
          activity: curse,
          save: null,
          damage: [],
          uses: null,
        },
        {
          id: 'hit',
          name: 'Bonus Hex Damage',
          type: 'damage',
          activation: 'Special',
          range: null,
          target: null,
          toHit: null,
          attackId: null,
          activity: { id: 'hit', type: 'damage', targets },
          save: null,
          damage: [{ formula: '1d6', type: 'Necrotic', healing: false }],
          consumesSlot: false,
          uses: null,
        },
        {
          id: 'move',
          name: 'Curse New Creature',
          type: 'utility',
          activation: 'Bonus Action',
          range: '90 ft',
          target: '1 Creature',
          toHit: null,
          attackId: null,
          activity: { id: 'move', type: 'utility', targets },
          save: null,
          damage: [],
          consumesSlot: false,
          uses: null,
        },
      ],
    })
    // An unarmed strike hits, or grapples or shoves.
    const unarmed = sheetAction({
      id: 'unarmed',
      name: 'Unarmed Strike',
      type: 'weapon',
      range: 'reach 5 ft',
      toHit: 5,
      attackId: 'punch',
      damage: [{ formula: '1 + 3', type: 'Bludgeoning', healing: false }],
      activities: [
        {
          id: 'punch',
          name: 'Attack',
          type: 'attack',
          activation: 'Action',
          range: 'reach 5 ft',
          target: null,
          toHit: 5,
          attackId: 'punch',
          save: null,
          damage: [{ formula: '1 + 3', type: 'Bludgeoning', healing: false }],
          uses: null,
        },
        {
          id: 'grapple',
          name: 'Grapple/Shove',
          type: 'save',
          activation: 'Action',
          range: '5 ft',
          target: null,
          toHit: null,
          attackId: null,
          activity: { id: 'grapple', type: 'save', targets },
          save: { ability: 'DC', dc: 13 },
          damage: [],
          uses: null,
        },
      ],
    })
    // Flaming Sphere is summoned, which is Foundry's to do, then rams.
    const sphere = sheetAction({
      id: 'sphere',
      name: 'Flaming Sphere',
      type: 'spell',
      level: 2,
      range: '60 ft',
      activities: [
        {
          id: 'call',
          name: 'Summon',
          type: 'summon',
          activation: 'Action',
          range: '60 ft',
          target: null,
          toHit: null,
          attackId: null,
          save: null,
          damage: [],
          uses: null,
        },
        {
          id: 'ram',
          name: 'Ram',
          type: 'save',
          activation: 'Bonus Action',
          range: '5 ft',
          target: null,
          toHit: null,
          attackId: null,
          activity: { id: 'ram', type: 'save', targets },
          save: { ability: 'DEX', dc: 14 },
          damage: [{ formula: '2d6', type: 'Fire', healing: false }],
          consumesSlot: false,
          uses: null,
        },
      ],
    })
    const sheet = toTableSheet(
      withActions(hex, unarmed, sphere),
      'https://my-game.forge-vtt.com',
    )
    const renderUsing = (layout?: Layout) => {
      const onUse = jest.fn()
      const onRoll = jest.fn()
      const onRollDamage = jest.fn()
      render(
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={onRoll}
          onRollDamage={onRollDamage}
          onUse={onUse}
          layout={layout}
        />,
      )
      return { onUse, onRoll, onRollDamage }
    }
    it('folds the rest of their activities away, saying how many, until one is opened', async () => {
      const user = userEvent.setup()
      renderUsing()

      // Closed, each says how many more it has, and lists none of them.
      expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
        'Unarmed StrikeAction · reach 5 ft · Bludgeoning · 1 more+51 + 3',
        'HexBonus Action · 90 ft · 2 moreCast',
        'Flaming SphereAction · 60 ft · Used in Foundry · 1 more',
      ])
      expect(
        screen.queryByRole('list', { name: 'Hex: its other activities' }),
      ).toBeNull()

      // Open, its activities are listed beneath it, each with what it rolls.
      await user.click(toggle('Hex'))
      expect(others('Hex')).toEqual([
        'Bonus Hex DamageSpecial · Necrotic1d6',
        'Curse New CreatureUse',
      ])
      expect(
        screen.getByRole('button', { name: /^Hex/, expanded: true }),
      ).toHaveTextContent('HexBonus Action · 90 ft')
      await user.click(
        screen.getByRole('button', { name: /^Hex/, expanded: true }),
      )
      expect(
        screen.queryByRole('list', { name: 'Hex: its other activities' }),
      ).toBeNull()
    })

    it('uses each from its own chips while the game takes them, as that activity alone', async () => {
      const user = userEvent.setup()
      const { onUse, onRoll } = renderUsing()
      const used = () =>
        onUse.mock.calls.map(([action]) => [action.name, action.activity.id])
      for (const name of ['Hex', 'Unarmed Strike', 'Flaming Sphere']) {
        await user.click(toggle(name))
      }

      await user.click(screen.getByRole('button', { name: 'Cast Hex' }))
      await user.click(
        screen.getByRole('button', {
          name: 'Hex (Bonus Hex Damage) damage, 1d6',
        }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Use Hex (Curse New Creature)' }),
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Unarmed Strike (Grapple/Shove), DC saving throw DC 13',
        }),
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Flaming Sphere (Ram), DEX saving throw DC 14',
        }),
      )
      expect(used()).toEqual([
        ['Hex', 'curse'],
        ['Hex (Bonus Hex Damage)', 'hit'],
        ['Hex (Curse New Creature)', 'move'],
        ['Unarmed Strike (Grapple/Shove)', 'grapple'],
        ['Flaming Sphere (Ram)', 'ram'],
      ])

      await user.click(
        screen.getByRole('button', { name: 'Unarmed Strike attack, +5' }),
      )
      expect(onRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { kind: 'attack', item: 'unarmed', activity: 'punch' },
        }),
      )
    })

    it('lists them in a table too, beneath their item, their chips in its columns', async () => {
      const user = userEvent.setup()
      const { onUse } = renderUsing('table')

      const table = screen.getByRole('table', { name: 'Actions' })
      // Folded away until each is opened, as in a list.
      expect(
        within(table).queryByText('Grapple/Shove', { exact: true }),
      ).toBeNull()
      expect(within(table).getByText('2 more')).toBeVisible()
      for (const name of ['Hex', 'Unarmed Strike', 'Flaming Sphere']) {
        await user.click(
          within(table).getByRole('button', {
            name: new RegExp(`^${name}`),
            expanded: false,
          }),
        )
      }
      const cells = (text: string) =>
        [
          ...within(table).getByText(text, { exact: true }).closest('tr')!
            .children,
        ].map(cell => cell.textContent)
      expect(cells('Grapple/Shove')).toEqual([
        'Grapple/Shove',
        '5 ft',
        'DC 13',
        '',
        '',
      ])
      expect(cells('Ram')).toEqual([
        'RamBonus Action · Fire',
        '5 ft',
        'DEX 14',
        '2d6',
        '',
      ])
      expect(within(table).getByText('Used in Foundry')).toBeVisible()
      await user.click(
        within(table).getByRole('button', {
          name: 'Hex (Bonus Hex Damage) damage, 1d6',
        }),
      )
      expect(onUse.mock.calls[0][0].activity.id).toBe('hit')
    })

    it('rolls their chips here while the game takes none', async () => {
      const user = userEvent.setup()
      const { onRollDamage } = renderTab(withActions(hex, unarmed, sphere))

      expect(screen.queryByRole('button', { name: /^(Use|Cast) / })).toBeNull()
      await user.click(toggle('Hex'))
      await user.click(
        screen.getByRole('button', {
          name: 'Hex (Bonus Hex Damage) damage, 1d6',
        }),
      )
      expect(onRollDamage).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Hex (Bonus Hex Damage) damage' }),
      )
    })

    it("opens what there is to read of an item's, but not of a spell's, which opens to its own", async () => {
      const user = userEvent.setup()
      renderUsing()
      for (const name of ['Hex', 'Unarmed Strike', 'Flaming Sphere']) {
        await user.click(toggle(name))
      }

      const about = screen.getAllByRole('button', { name: /^About / })
      expect(about.map(button => button.getAttribute('aria-label'))).toEqual([
        'About Unarmed Strike (Grapple/Shove)',
      ])
      await user.click(about[0])
      const dialog = screen.getByRole('dialog', { name: 'Grapple/Shove' })
      expect(within(dialog).getByText('From Unarmed Strike')).toBeVisible()
      expect(factsIn(dialog)).toEqual([
        'Activation: Action',
        'Range: 5 ft',
        'Saving throw: DC 13 DC',
      ])
    })
  })

  describe('an item under each kind of action it has, and the spells it casts', () => {
    const charges = { value: 2, max: 10, recovery: 'Dawn' }
    const targets = {
      self: false,
      area: false,
      count: 1,
      perLevel: null,
      affects: 'creature',
    }
    const wisp = {
      id: 'cast-wisp',
      name: 'Starry Wisp',
      type: 'cast',
      activation: 'Action',
      activationType: 'action',
      range: '60 ft',
      target: null,
      toHit: 6,
      attackId: 'cast-wisp',
      activity: null,
      save: null,
      damage: [{ formula: '1d8', type: 'Radiant', healing: false }],
      cast: { level: 0, concentration: false, charges: 1, short: false },
      uses: charges,
    }
    // A weapon that strikes as an action and casts spells from its charges: under Actions, its
    // strike and the spells cast as actions; under Reactions, Silvery Barbs, which it has too few
    // charges left for.
    const flame = sheetAction({
      id: 'flame',
      name: 'Bardic Flame',
      type: 'weapon',
      activationType: 'action',
      range: 'reach 5 ft',
      toHit: 5,
      attackId: 'strike',
      damage: [{ formula: '1d6 + 1', type: 'Bludgeoning', healing: false }],
      uses: charges,
      activities: [
        {
          id: 'strike',
          name: 'Attack',
          type: 'attack',
          activation: 'Action',
          activationType: 'action',
          range: 'reach 5 ft',
          target: null,
          toHit: 5,
          attackId: 'strike',
          save: null,
          damage: [{ formula: '1d6 + 1', type: 'Bludgeoning', healing: false }],
          uses: null,
        },
        wisp,
        {
          id: 'cast-charm',
          name: 'Charm Person',
          type: 'cast',
          activation: 'Action',
          activationType: 'action',
          range: null,
          target: null,
          toHit: null,
          attackId: null,
          activity: null,
          save: null,
          damage: [],
          uses: null,
        },
      ],
    })
    const barbs = sheetAction({
      id: 'flame',
      name: 'Bardic Flame',
      type: 'weapon',
      activityName: 'Silvery Barbs',
      activation: 'Reaction',
      activationType: 'reaction',
      range: '60 ft',
      activity: { id: 'cast-barbs', type: 'utility', targets },
      cast: {
        level: 1,
        concentration: false,
        charges: 3,
        short: true,
        text: TEXTS.shield,
      },
      uses: charges,
      activities: [
        {
          id: 'cast-barbs',
          name: 'Silvery Barbs',
          type: 'cast',
          activation: 'Reaction',
          activationType: 'reaction',
          range: '60 ft',
          target: null,
          toHit: null,
          attackId: null,
          activity: { id: 'cast-barbs', type: 'utility', targets },
          save: null,
          damage: [],
          cast: { level: 1, concentration: false, charges: 3, short: true },
          uses: charges,
        },
      ],
    })
    const sheet = toTableSheet(
      characterSheet({
        actions: [
          { id: 'action', label: 'Actions', actions: [flame] },
          { id: 'reaction', label: 'Reactions', actions: [barbs] },
        ],
      }),
      'https://my-game.forge-vtt.com',
    )
    const renderFlame = () => {
      const onUse = jest.fn()
      const onRoll = jest.fn()
      render(
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={onRoll}
          onRollDamage={jest.fn()}
          onUse={onUse}
        />,
      )
      return { onUse, onRoll }
    }

    it('lists it under each, as itself, each row named for its spell where it is not its first, without saying the kind of action again', () => {
      renderFlame()

      expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
        'Bardic Flamereach 5 ft · Bludgeoning · 2 more2/102 of 10 uses left+51d6 + 1',
      ])
      expect(rows(screen.getByRole('region', { name: 'Reactions' }))).toEqual([
        'Bardic FlameSilvery Barbs · 60 ft · No charges left2/102 of 10 uses leftCast',
      ])
      expect(flameRow('Reactions')).toHaveClass('opacity-60')
      expect(flameRow('Actions')).not.toHaveClass('opacity-60')
    })

    it('casts its spells from it, named for both, the cost in charges said and those it is short of faded', async () => {
      const user = userEvent.setup()
      const { onUse, onRoll } = renderFlame()

      await user.click(
        screen.getByRole('button', {
          name: 'Cast Bardic Flame (Silvery Barbs)',
        }),
      )
      expect(onUse.mock.calls[0][0]).toMatchObject({
        id: 'flame',
        activityName: 'Silvery Barbs',
        activity: { id: 'cast-barbs' },
      })

      await user.click(flameRow('Actions'))
      // The charges a spell spends are the weapon's, shown by it, not by each spell.
      expect(others('Bardic Flame')).toEqual([
        'Starry Wisp60 ft · Radiant · 1 charge+61d8',
        'Charm PersonUsed in Foundry',
      ])
      await user.click(
        screen.getByRole('button', {
          name: 'Bardic Flame (Starry Wisp) attack, +6',
        }),
      )
      expect(onRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Bardic Flame (Starry Wisp) attack',
          source: { kind: 'attack', item: 'flame', activity: 'cast-wisp' },
        }),
      )
    })

    it('opens a row cast from it to the spell', async () => {
      const user = userEvent.setup()
      renderFlame()

      await user.click(flameRow('Reactions'))
      expect(
        screen.getByText('Level 1 spell · Cast from Bardic Flame'),
      ).toBeVisible()
    })

    describe('to read about', () => {
      const from = { id: 'flame', name: 'Bardic Flame' }
      // dnd5e's copy of each spell the Flame casts, as the Spells tab lists it under the Flame.
      const copies = [
        sheetSpell({
          id: 'wisp-copy',
          name: 'Starry Wisp',
          level: 0,
          school: 'Evocation',
          range: '60 ft',
          castFrom: from,
          text: TEXTS.bless,
        }),
        sheetSpell({
          id: 'charm-copy',
          name: 'Charm Person',
          school: 'Enchantment',
          range: '30 ft',
          target: '1 Humanoid',
          duration: '1 Hour',
          castFrom: from,
          text: TEXTS.ring,
        }),
        sheetSpell({
          id: 'barbs-copy',
          name: 'Silvery Barbs',
          school: 'Enchantment',
          components: 'V',
          activation: '1 Reaction',
          range: '60 ft',
          target: '1 Creature',
          castFrom: from,
          text: TEXTS.shield,
        }),
      ]
      /**
       * The Actions tab, with the Flame under each kind of action it has, or these, and these
       * spells cast from items, each description shown as its hash.
       */
      const renderRead = (
        spells: SheetSpell[] = copies,
        actions: SheetActionSection[] = [
          { id: 'action', label: 'Actions', actions: [flame] },
          { id: 'reaction', label: 'Reactions', actions: [barbs] },
        ],
        layout?: Layout,
      ) => {
        globalThis.fetch = jest.fn(
          async (url: RequestInfo | URL) =>
            ({
              ok: true,
              json: async () => ({
                html: `<p>Text ${String(url).split('/').at(-1)}</p>`,
              }),
            }) as Response,
        )
        render(
          <ActionsTab
            // Of its own, as descriptions already loaded are kept by character.
            characterId='char-2'
            sheet={toTableSheet(
              characterSheet({
                actions,
                spells: [
                  { id: 'item', label: 'Item Spells', slots: null, spells },
                ],
              }),
              'https://my-game.forge-vtt.com',
            )}
            onRoll={jest.fn()}
            onRollDamage={jest.fn()}
            layout={layout}
          />,
        )
      }

      it('puts a button beside the name of each of its other activities, the row unchanged, that opens its spell as the Spells tab has it', async () => {
        const user = userEvent.setup()
        renderRead()

        // None on its rows, which open to what there is to read of them.
        expect(screen.queryByRole('button', { name: /^About / })).toBeNull()
        await user.click(flameRow('Actions'))
        expect(others('Bardic Flame')).toEqual([
          'Starry Wisp60 ft · Radiant · 1 charge+61d8',
          'Charm PersonUsed in Foundry',
        ])
        const wisp = about('Bardic Flame (Starry Wisp)')
        expect(wisp).toHaveAttribute('aria-haspopup', 'dialog')
        expect(wisp).toHaveAttribute(
          'title',
          'About Bardic Flame (Starry Wisp)',
        )
        expect(wisp.previousSibling).toHaveTextContent(/^Starry Wisp$/)
        expect(screen.getAllByRole('button', { name: /^About / })).toHaveLength(
          2,
        )

        await user.click(wisp)
        const dialog = screen.getByRole('dialog', { name: 'Starry Wisp' })
        expect(
          within(dialog).getByText('Cantrip · Evocation · From Bardic Flame'),
        ).toBeVisible()
        expect(factsIn(dialog)).toEqual([
          'Casting time: Action',
          'Range: 60 ft',
          'Duration: Instantaneous',
          'Components: V, S',
          'Cost: 1 charge',
          'To hit: +6',
          'Damage: 1d8 Radiant',
          'Uses: 2 of 10 left, Dawn',
        ])
        expect(
          await within(dialog).findByText(`Text ${TEXTS.bless}`),
        ).toBeInTheDocument()
        // Nothing in it rolls: its row does.
        expect(
          within(dialog)
            .getAllByRole('button')
            .map(button => button.getAttribute('aria-label')),
        ).toEqual(['Close'])

        await user.click(within(dialog).getByRole('button', { name: 'Close' }))
        expect(screen.queryByRole('dialog')).toBeNull()
      })

      it("finds a spell by its name, how it's cast and its range its own where its activity has none, and closes on Escape", async () => {
        const user = userEvent.setup()
        renderRead()

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Charm Person)'))
        const dialog = screen.getByRole('dialog', { name: 'Charm Person' })
        expect(
          within(dialog).getByText('Level 1 · Enchantment · From Bardic Flame'),
        ).toBeVisible()
        expect(
          within(dialog)
            .getAllByRole('listitem')
            .map(mark => mark.textContent),
        ).toEqual(['Used in Foundry'])
        expect(factsIn(dialog)).toEqual([
          'Casting time: Action',
          'Range: 30 ft',
          'Target: 1 Humanoid',
          'Duration: 1 Hour',
          'Components: V, S',
        ])
        expect(
          await within(dialog).findByText(`Text ${TEXTS.ring}`),
        ).toBeInTheDocument()

        // The browser closes the dialog on Escape, firing close.
        fireEvent(dialog, new Event('close'))
        expect(screen.queryByRole('dialog')).toBeNull()
      })

      it("marks a spell it's short of charges for, that takes concentration, or that it can't cast until it's attuned", async () => {
        const user = userEvent.setup()
        const [strike, , charm] = flame.activities ?? []
        renderRead(
          [
            copies[0],
            {
              ...copies[1],
              castFrom: { ...from, usable: false, attune: true },
            },
          ],
          [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                {
                  ...flame,
                  activities: [
                    strike,
                    {
                      ...wisp,
                      cast: { ...wisp.cast, concentration: true, short: true },
                    },
                    charm,
                  ],
                },
              ],
            },
          ],
        )
        const marks = (name: string) =>
          within(screen.getByRole('dialog', { name }))
            .getAllByRole('listitem')
            .map(mark => mark.textContent)

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Starry Wisp)'))
        expect(marks('Starry Wisp')).toEqual([
          'Concentration',
          'No charges left',
        ])
        await user.click(screen.getByRole('button', { name: 'Close' }))
        await user.click(about('Bardic Flame (Charm Person)'))
        expect(marks('Charm Person')).toEqual([
          'Needs attuning',
          'Used in Foundry',
        ])
      })

      it("marks none for concentration where only the item's first activity takes it", async () => {
        const user = userEvent.setup()
        const [strike] = flame.activities ?? []
        // First, a Cast that takes concentration, for which the module marks the whole Flame.
        renderRead(copies, [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              {
                ...flame,
                concentration: true,
                activities: [
                  { ...wisp, cast: { ...wisp.cast, concentration: true } },
                  strike,
                ],
              },
            ],
          },
        ])

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Attack)'))
        const dialog = screen.getByRole('dialog', { name: 'Attack' })
        expect(within(dialog).queryAllByRole('listitem')).toEqual([])
        expect(within(dialog).queryByText('Concentration')).toBeNull()
      })

      it("falls back to the item's only spell for a Cast renamed, or else shows what its row has, and the item's description", async () => {
        const user = userEvent.setup()
        const staff = sheetAction({
          id: 'staff',
          name: 'Staff of Fire',
          type: 'weapon',
          toHit: 4,
          attackId: 'bonk',
          damage: [{ formula: '1d6', type: 'Bludgeoning', healing: false }],
          text: TEXTS.warhammer,
          activities: [
            {
              id: 'bonk',
              name: 'Attack',
              type: 'attack',
              activation: 'Action',
              range: 'reach 5 ft',
              target: null,
              toHit: 4,
              attackId: 'bonk',
              save: null,
              damage: [{ formula: '1d6', type: 'Bludgeoning', healing: false }],
              uses: null,
            },
            {
              id: 'cast-fireball',
              name: 'Cast Fireball',
              type: 'cast',
              activation: 'Action',
              range: '150 ft',
              target: null,
              toHit: null,
              attackId: null,
              activity: { id: 'cast-fireball', type: 'save', targets },
              save: { ability: 'DEX', dc: 15 },
              damage: [{ formula: '8d6', type: 'Fire', healing: false }],
              cast: {
                level: 5,
                concentration: false,
                charges: 3,
                short: false,
              },
              uses: null,
            },
          ],
        })
        const of = { id: 'staff', name: 'Staff of Fire' }
        const fireball = sheetSpell({
          id: 'fireball-copy',
          name: 'Fireball',
          level: 3,
          school: 'Evocation',
          components: 'V, S, M',
          materials: 'a ball of bat guano and sulfur',
          target: '20 ft Sphere',
          castFrom: of,
          text: TEXTS.poisoned,
        })
        const wall = sheetSpell({
          id: 'wall-copy',
          name: 'Wall of Fire',
          level: 4,
          castFrom: of,
        })
        const actions = [{ id: 'action', label: 'Actions', actions: [staff] }]

        renderRead([fireball], actions)
        await user.click(toggle('Staff of Fire'))
        await user.click(about('Staff of Fire (Cast Fireball)'))
        let dialog = screen.getByRole('dialog', { name: 'Fireball' })
        expect(
          within(dialog).getByText('Level 3 · Evocation · From Staff of Fire'),
        ).toBeVisible()
        expect(factsIn(dialog)).toEqual([
          'Casting time: Action',
          'Range: 150 ft',
          'Target: 20 ft Sphere',
          'Duration: Instantaneous',
          'Components: V, S, M (a ball of bat guano and sulfur)',
          'Cast at: 5th level',
          'Cost: 3 charges',
          'Saving throw: DC 15 DEX',
          'Damage: 8d6 Fire',
        ])
        expect(
          await within(dialog).findByText(`Text ${TEXTS.poisoned}`),
        ).toBeInTheDocument()

        // Of two spells, neither of its name, it can't tell which.
        cleanup()
        renderRead([fireball, wall], actions)
        await user.click(toggle('Staff of Fire'))
        await user.click(about('Staff of Fire (Cast Fireball)'))
        dialog = screen.getByRole('dialog', { name: 'Cast Fireball' })
        expect(within(dialog).getByText('From Staff of Fire')).toBeVisible()
        expect(factsIn(dialog)).toEqual([
          'Casting time: Action',
          'Range: 150 ft',
          'Cost: 3 charges',
          'Saving throw: DC 15 DEX',
          'Damage: 8d6 Fire',
        ])
        const item = within(dialog).getByRole('region', {
          name: 'Staff of Fire',
        })
        expect(
          await within(item).findByText(`Text ${TEXTS.warhammer}`),
        ).toBeInTheDocument()
      })

      it('finds its spell by the copy the module names, whatever it is called, and says what a reaction answers, how long it lasts, and its own description', async () => {
        const user = userEvent.setup()
        const [strike, , charm] = flame.activities ?? []
        const parry = {
          ...charm,
          id: 'parry',
          name: 'Parry',
          type: 'utility',
          activation: 'Reaction',
          activationType: 'reaction',
          trigger: 'When a creature hits you with a melee attack',
          duration: '1 Round',
          text: TEXTS.rope,
        }
        renderRead(copies, [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              {
                ...flame,
                activities: [
                  strike,
                  // Renamed, and named for another spell: the copy the module names is its own.
                  { ...charm, name: 'Starry Wisp', spellId: 'charm-copy' },
                  parry,
                ],
              },
            ],
          },
        ])

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Starry Wisp)'))
        expect(
          screen.getByRole('dialog', { name: 'Charm Person' }),
        ).toHaveTextContent('Level 1 · Enchantment · From Bardic Flame')
        await user.click(screen.getByRole('button', { name: 'Close' }))

        await user.click(about('Bardic Flame (Parry)'))
        const dialog = screen.getByRole('dialog', { name: 'Parry' })
        expect(factsIn(dialog)).toEqual([
          'Activation: Reaction',
          'Trigger: When a creature hits you with a melee attack',
          'Duration: 1 Round',
        ])
        expect(
          await within(dialog).findByText(`Text ${TEXTS.rope}`),
        ).toBeInTheDocument()
      })

      it("shows what its row has for a Cast whose spell the module didn't find, as the item's only spell is another Cast's", async () => {
        const user = userEvent.setup()
        const [strike, , charm] = flame.activities ?? []
        // Its spell not set, or lost: named for its kind, it rolls nothing, and has no copy.
        const unset = { ...charm, id: 'cast-unset', name: 'Cast' }
        renderRead(
          [copies[1]],
          [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                {
                  ...flame,
                  text: TEXTS.warhammer,
                  activities: [strike, charm, unset],
                },
              ],
            },
          ],
        )

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Cast)'))
        const dialog = screen.getByRole('dialog', { name: 'Cast' })
        expect(within(dialog).getByText('From Bardic Flame')).toBeVisible()
        expect(
          within(dialog).queryByText(/Charm Person|Enchantment/),
        ).toBeNull()
        const item = within(dialog).getByRole('region', {
          name: 'Bardic Flame',
        })
        expect(
          await within(item).findByText(`Text ${TEXTS.warhammer}`),
        ).toBeInTheDocument()

        // The Cast of its name still finds it.
        await user.click(within(dialog).getByRole('button', { name: 'Close' }))
        await user.click(about('Bardic Flame (Charm Person)'))
        expect(
          screen.getByRole('dialog', { name: 'Charm Person' }),
        ).toHaveTextContent('Level 1 · Enchantment · From Bardic Flame')
      })

      it("says how a spell is cast as the spell does where its activity doesn't", async () => {
        const user = userEvent.setup()
        const [strike, , charm] = flame.activities ?? []
        renderRead(
          [{ ...copies[1], activation: '1 Bonus Action' }],
          [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                {
                  ...flame,
                  activities: [strike, { ...charm, activation: null }],
                },
              ],
            },
          ],
        )

        await user.click(flameRow('Actions'))
        await user.click(about('Bardic Flame (Charm Person)'))
        expect(
          factsIn(screen.getByRole('dialog', { name: 'Charm Person' }))[0],
        ).toBe('Casting time: 1 Bonus Action')
      })

      it("reads a weapon's other attack, with the weapon's description under its name, in a table too", async () => {
        const user = userEvent.setup()
        const attack = {
          type: 'attack',
          activation: 'Action',
          target: null,
          toHit: 7,
          save: null,
          damage: [{ formula: '1d6 + 4', type: 'Slashing', healing: false }],
          uses: null,
        }
        const handaxe = sheetAction({
          id: 'handaxe',
          name: 'Handaxe',
          type: 'weapon',
          range: 'reach 5 ft',
          toHit: 7,
          attackId: 'swing',
          damage: attack.damage,
          text: TEXTS.backpack,
          activities: [
            { ...attack, id: 'swing', name: 'Attack', range: 'reach 5 ft' },
            { ...attack, id: 'throw', name: 'Throw', range: '20/60 ft' },
          ],
        })
        renderRead(
          [],
          [{ id: 'action', label: 'Actions', actions: [handaxe] }],
          'table',
        )

        const table = screen.getByRole('table', { name: 'Actions' })
        await user.click(
          within(table).getByRole('button', {
            name: /^Handaxe/,
            expanded: false,
          }),
        )
        // Its name and its kind of damage, as before.
        expect(
          within(table).getByText('Throw', { exact: true }).closest('td'),
        ).toHaveTextContent(/^ThrowSlashing$/)
        await user.click(
          within(table).getByRole('button', { name: 'About Handaxe (Throw)' }),
        )
        const dialog = screen.getByRole('dialog', { name: 'Throw' })
        expect(within(dialog).getByText('From Handaxe')).toBeVisible()
        expect(within(dialog).queryByRole('list')).toBeNull()
        expect(factsIn(dialog)).toEqual([
          'Activation: Action',
          'Range: 20/60 ft',
          'To hit: +7',
          'Damage: 1d6 + 4 Slashing',
        ])
        const item = within(dialog).getByRole('region', { name: 'Handaxe' })
        expect(
          await within(item).findByText(`Text ${TEXTS.backpack}`),
        ).toBeInTheDocument()
      })

      it("says an activity's own formula, and what dnd5e calls it", async () => {
        const user = userEvent.setup()
        const light = {
          type: 'utility',
          activation: 'Bonus Action',
          range: 'Self',
          target: null,
          toHit: null,
          attackId: null,
          save: null,
          damage: [],
          uses: null,
        }
        const lantern = sheetAction({
          id: 'lantern',
          name: 'Lantern of Revealing',
          type: 'equipment',
          activity: { id: 'lit', type: 'utility', targets },
          activities: [
            {
              ...light,
              id: 'lit',
              name: 'Light',
              activity: { id: 'lit', type: 'utility', targets },
            },
            {
              ...light,
              id: 'hood',
              name: 'Lower the Hood',
              activity: { id: 'hood', type: 'utility', targets },
              rollFormula: { formula: '1d4 + 3', name: 'Light radius' },
            },
          ],
        })
        renderRead(
          [],
          [{ id: 'bonus', label: 'Bonus Actions', actions: [lantern] }],
        )

        await user.click(toggle('Lantern of Revealing'))
        await user.click(about('Lantern of Revealing (Lower the Hood)'))
        expect(
          factsIn(screen.getByRole('dialog', { name: 'Lower the Hood' })),
        ).toEqual([
          'Activation: Bonus Action',
          'Range: Self',
          'Formula: 1d4 + 3 (Light radius)',
        ])
      })

      it('opens a row cast from it to the spell in full, as the Spells tab has it', async () => {
        const user = userEvent.setup()
        renderRead()

        await user.click(flameRow('Reactions'))
        const reactions = screen.getByRole('region', { name: 'Reactions' })
        expect(
          within(reactions).getByText(
            'Level 1 · Enchantment · From Bardic Flame',
          ),
        ).toBeVisible()
        expect(factsIn(reactions)).toEqual([
          'Casting time: Reaction',
          'Range: 60 ft',
          'Target: 1 Creature',
          'Duration: Instantaneous',
          'Components: V',
          'Cost: 3 charges',
          'Uses: 2 of 10 left, Dawn',
        ])
        expect(
          await within(reactions).findByText(`Text ${TEXTS.shield}`),
        ).toBeInTheDocument()
      })
    })
  })

  describe('spells an item casts higher, and their later activities, from module 0.20.0', () => {
    const renderCasting = (
      sheet: CharacterSheet = castingSheet(),
      layout?: Layout,
    ) => {
      const onUse = jest.fn()
      render(
        <ActionsTab
          characterId='char-1'
          sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          onUse={onUse}
          layout={layout}
        />,
      )
      return { onUse }
    }
    const radiant = [{ formula: '3d8', type: 'Radiant', healing: false }]
    const self = {
      self: true,
      area: false,
      count: null,
      perLevel: null,
      affects: 'self',
    }
    const one = { ...self, self: false, count: 1, affects: 'creature' }
    it("says what a spell cast higher may cost, and lists the spell's later activities beneath its Cast, named for it", async () => {
      const user = userEvent.setup()
      const { onUse } = renderCasting()

      expect(rows(screen.getByRole('region', { name: 'Actions' }))).toEqual([
        'Bardic FlameAction · reach 5 ft · Bludgeoning · 2 more4/104 of 10 uses left+51d6 + 1',
        'Wand of Magic MissilesAction · 120 ft · Force · 1–3 charges7/77 of 7 uses left1d4 + 1',
      ])
      await user.click(flameRow('Actions'))
      expect(others('Bardic Flame')).toEqual([
        'HexBonus Action · 90 ft · 1 chargeCast',
        'Hex (Bonus Hex Damage)Special · 90 ft · Necrotic1d6',
      ])

      // Used as the copy's activity, it spends nothing, and is used rather than cast.
      await user.click(
        screen.getByRole('button', {
          name: 'Hex (Bonus Hex Damage) damage, 1d6',
        }),
      )
      expect(onUse.mock.calls[0][0]).toMatchObject({
        id: 'hex',
        name: 'Hex (Bonus Hex Damage)',
        activity: { id: 'hex-dmg' },
        consumesSlot: false,
      })
    })

    it("opens a later activity's spell, as the Spells tab lists it under the item", async () => {
      const user = userEvent.setup()
      renderCasting()
      await user.click(flameRow('Actions'))
      await user.click(about('Hex (Bonus Hex Damage)'))

      const dialog = screen.getByRole('dialog', { name: 'Hex' })
      expect(dialog).toHaveTextContent(
        'Level 1 · Enchantment · From Bardic Flame',
      )
    })

    it('fades a spell the item has too few charges left for at any level, but never a later activity that spends none', async () => {
      const user = userEvent.setup()
      const sheet = castingSheet()
      const [wand, flame] = sheet.actions[0].actions
      const short = { level: 1, concentration: false, charges: 1, short: true }
      sheet.actions[0].actions = [
        {
          ...wand,
          cast: {
            ...short,
            levels: WAND_LEVELS.map(level => ({ ...level, short: true })),
          },
        },
        {
          ...flame,
          activities: [
            flame.activities![0],
            { ...flame.activities![1], cast: short },
          ],
        },
      ]
      renderCasting(sheet)

      const wandRow = toggle('Wand of Magic Missiles')
      expect(wandRow).toHaveTextContent('No charges left')
      expect(wandRow).toHaveClass('opacity-60')
      await user.click(flameRow('Actions'))
      const [hex, bonus] = within(
        screen.getByRole('list', {
          name: 'Bardic Flame: its other activities',
        }),
      ).getAllByRole('listitem')
      expect(hex).toHaveTextContent('No charges left')
      expect(hex.firstElementChild).toHaveClass('opacity-60')
      expect(bonus).not.toHaveTextContent('charge')
      expect(bonus.firstElementChild).not.toHaveClass('opacity-60')
    })

    it('fades a later activity that spends charges, under a Cast too short of them, as its Cast is', async () => {
      const user = userEvent.setup()
      const sheet = castingSheet()
      const [wand, flame] = sheet.actions[0].actions
      const short = { level: 1, concentration: true, charges: 1, short: true }
      sheet.actions[0].actions = [
        wand,
        {
          ...flame,
          activities: [
            flame.activities![0],
            { ...flame.activities![1], cast: short },
          ],
        },
      ]
      // Hex's damage spends a charge too, as a later activity that spends a slot does.
      const [copies] = sheet.spells
      const [missile, hex] = copies.spells
      copies.spells = [
        missile,
        {
          ...hex,
          activities: [
            hex.activities![0],
            { ...hex.activities![1], consumesSlot: undefined },
          ],
        },
      ]
      renderCasting(sheet)

      await user.click(flameRow('Actions'))
      const [, bonus] = within(
        screen.getByRole('list', {
          name: 'Bardic Flame: its other activities',
        }),
      ).getAllByRole('listitem')
      expect(bonus).toHaveTextContent('Hex (Bonus Hex Damage)')
      expect(bonus).toHaveTextContent('No charges left')
      expect(bonus.firstElementChild).toHaveClass('opacity-60')
    })

    it("lists no later activities of a spell its item can't cast now", async () => {
      const user = userEvent.setup()
      const sheet = castingSheet()
      // The module sends none for such a copy; were any sent, they'd be the game's to refuse.
      const [copies] = sheet.spells
      const [missile, hex] = copies.spells
      copies.spells = [
        missile,
        {
          ...hex,
          castFrom: {
            id: 'flame',
            name: 'Bardic Flame',
            usable: false,
            attune: true,
          },
        },
      ]
      renderCasting(sheet)

      await user.click(flameRow('Actions'))
      expect(others('Bardic Flame')).toEqual([
        'HexBonus Action · 90 ft · 1 chargeCast',
      ])
    })

    it("lists each Cast's later activities after it, a wand's beneath it, a staff's of two spells each after its own", async () => {
      const user = userEvent.setup()
      const errors = jest.spyOn(console, 'error')
      const wand = { id: 'wand', name: 'Wand of Guardians' }
      const staff = { id: 'staff', name: 'Staff of Spirits' }
      const cast = { level: 3, concentration: true, charges: 1, short: false }
      const guardians = (id: string, from: typeof wand) =>
        copyOf({ id, name: 'Spirit Guardians' }, from, [
          spellActivity({
            id: 'dnd5eactivity000',
            name: 'Cast',
            activity: {
              id: 'dnd5eactivity000',
              type: 'utility',
              targets: self,
            },
          }),
          spellActivity({
            id: 'dnd5eactivity100',
            name: 'Emanation Save',
            type: 'save',
            activation: 'Special',
            activity: { id: 'dnd5eactivity100', type: 'save', targets: one },
            save: { ability: 'WIS', dc: 15 },
            damage: radiant,
            consumesSlot: false,
          }),
        ])
      const castActivity = (id: string, name: string, spellId: string) =>
        spellActivity({
          id,
          name,
          type: 'cast',
          activity: { id, type: 'utility', targets: self },
          cast,
          spellId,
        })
      renderCasting(
        castingWith(
          [
            sheetAction({
              ...wand,
              type: 'equipment',
              activity: { id: 'cast-wand', type: 'utility', targets: self },
              cast,
              spellId: 'wand-copy',
              uses: { value: 7, max: 7, recovery: 'Dawn' },
            }),
            sheetAction({
              ...staff,
              type: 'weapon',
              activity: { id: 'cast-sg', type: 'utility', targets: self },
              cast,
              spellId: 'staff-sg',
              activities: [
                castActivity('cast-sg', 'Spirit Guardians', 'staff-sg'),
                castActivity('cast-sg2', 'Spirit Guardians Again', 'staff-sg2'),
              ],
            }),
          ],
          [
            guardians('wand-copy', wand),
            guardians('staff-sg', staff),
            guardians('staff-sg2', staff),
          ],
        ),
      )

      expect(toggle('Wand of Guardians')).toHaveTextContent('1 more')
      expect(toggle('Staff of Spirits')).toHaveTextContent('3 more')
      await user.click(toggle('Wand of Guardians'))
      await user.click(toggle('Staff of Spirits'))
      expect(others('Wand of Guardians')).toEqual([
        'Spirit Guardians (Emanation Save)Special · Self · RadiantWIS 153d8',
      ])
      expect(others('Staff of Spirits')).toEqual([
        'Spirit Guardians (Emanation Save)Special · Self · RadiantWIS 153d8',
        'Spirit Guardians AgainSelf · 1 chargeCast',
        'Spirit Guardians (Emanation Save)Special · Self · RadiantWIS 153d8',
      ])
      expect(
        errors.mock.calls.some(call => String(call[0]).includes('same key')),
      ).toBe(false)
    })

    it("lists the later activities of a Cast that says nothing of how it's cast, such as one that summons first", async () => {
      const user = userEvent.setup()
      const staff = { id: 'magi', name: 'Staff of the Magi' }
      renderCasting(
        castingWith(
          [
            sheetAction({
              ...staff,
              type: 'weapon',
              toHit: 7,
              attackId: 'strike',
              damage: [
                { formula: '1d6 + 2', type: 'Bludgeoning', healing: false },
              ],
              activities: [
                spellActivity({
                  id: 'strike',
                  name: 'Attack',
                  type: 'attack',
                  toHit: 7,
                  attackId: 'strike',
                }),
                spellActivity({
                  id: 'cast-sphere',
                  name: 'Flaming Sphere',
                  type: 'cast',
                  spellId: 'sphere',
                }),
              ],
            }),
          ],
          [
            copyOf({ id: 'sphere', name: 'Flaming Sphere', level: 2 }, staff, [
              spellActivity({ id: 'summon', name: 'Summon', type: 'summon' }),
              spellActivity({
                id: 'ram',
                name: 'Ram',
                type: 'save',
                activity: { id: 'ram', type: 'save', targets: one },
                save: { ability: 'DEX', dc: 17 },
                damage: [{ formula: '2d6', type: 'Fire', healing: false }],
              }),
            ]),
          ],
        ),
      )

      await user.click(toggle('Staff of the Magi'))
      expect(others('Staff of the Magi')).toEqual([
        'Flaming SphereSelf · Used in Foundry',
        'Flaming Sphere (Ram)Self · FireDEX 172d6',
      ])
      expect(about('Flaming Sphere (Ram)')).toBeVisible()
    })

    it("says what a spell cast from an item costs, as how it's cast says", () => {
      const cast = { level: 1, concentration: false, charges: 1, short: false }
      expect(
        castNote({ ...cast, levels: castLevels(false, false, false) }),
      ).toBe('1–3 charges')
      expect(
        castNote({ ...cast, levels: castLevels(false, false, true) }),
      ).toBe('1–2 charges')
      expect(castNote({ ...cast, levels: castLevels(false, true, true) })).toBe(
        '1 charge',
      )
      expect(
        castNote({ ...cast, short: true, levels: castLevels(true, true) }),
      ).toBe('No charges left')
      expect(castNote(cast)).toBe('1 charge')
      expect(castNote({ ...cast, charges: 3 })).toBe('3 charges')
      expect(castNote({ ...cast, short: true })).toBe('No charges left')
      // One that spends nothing, or a formula, says nothing.
      expect(castNote({ ...cast, charges: null, short: false })).toBeUndefined()
      expect(
        castNote({
          ...cast,
          charges: null,
          levels: castLevels(false, false).map(level => ({
            ...level,
            charges: null,
          })),
        }),
      ).toBeUndefined()
      expect(castNote(null)).toBeUndefined()
    })

    it('uses, rather than casts, a later activity that spends nothing, even one the item casts', () => {
      const cast = { level: 1, concentration: false, charges: 1, short: false }
      const used = sheetAction({ id: 'wand', name: 'Wand', cast })
      expect(verbOf(used)).toBe('Cast')
      expect(verbOf({ ...used, consumesSlot: false })).toBe('Use')
      const spell = sheetAction({ id: 'hex', name: 'Hex', type: 'spell' })
      expect(verbOf(spell)).toBe('Cast')
      expect(verbOf({ ...spell, consumesSlot: false })).toBe('Use')
      expect(verbOf(sheetAction({ id: 'surge', name: 'Action Surge' }))).toBe(
        'Use',
      )
    })

    it('lists them in a table too, keyed apart, each after its Cast', async () => {
      const user = userEvent.setup()
      renderCasting(castingSheet(), 'table')
      await user.click(
        screen.getByRole('button', { name: /^Bardic Flame/, expanded: false }),
      )

      const table = screen.getByRole('table', { name: 'Actions' })
      const names = within(table)
        .getAllByRole('row')
        .map(row => row.querySelector('td')?.textContent)
      expect(names).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Wand of Magic Missiles.*1–3 charges/),
          expect.stringMatching(/^HexBonus Action · 1 charge/),
          expect.stringMatching(/^Hex \(Bonus Hex Damage\)/),
        ]),
      )
    })
  })

  it('says so when there are no actions to show, as from an older module', () => {
    renderTab(characterSheet())

    expect(screen.getByText('No actions to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('stars a favorite, in a list and in a table, and shows first what it is given, such as the favorites', () => {
    const sheet = toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')
    const tab = (layout: Layout) => (
      <FavoriteMarks keys={new Set(['item:warhammer'])}>
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          favorites={<p>Her favorites</p>}
          layout={layout}
        />
      </FavoriteMarks>
    )
    render(tab('list'))

    expect(
      screen.getByRole('button', { name: /^Warhammer\s*, favorite/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(', favorite')).toHaveLength(1)
    expect(
      screen
        .getByText('Her favorites')
        .compareDocumentPosition(
          screen.getByRole('heading', { level: 2, name: 'Actions' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    cleanup()
    render(tab('table'))
    expect(
      within(screen.getAllByRole('table')[0]).getByRole('button', {
        name: /^Warhammer\s*, favorite/,
      }),
    ).toBeInTheDocument()
  })
})

describe('components/character-sheet/actions-tab: a recharge in the table, from module 0.36.0', () => {
  afterEach(cleanup)

  const renderTable = (recharges: boolean) =>
    render(
      <ActionsTab
        characterId='spirit'
        sheet={toTableSheet(
          spiritSheet([fireBreath(), lightningBreath()]),
          'https://my-game.forge-vtt.com',
        )}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        onRollFormula={jest.fn()}
        tableDamage={{
          modifies: true,
          dueFor: jest.fn(),
          sendsAlone: false,
          recharges,
        }}
        layout='table'
      />,
    )

  it('puts the Recharge chip in the Uses cell, left of the count', () => {
    renderTable(true)

    const row = screen
      .getByRole('button', { name: /^Fire Breath/, expanded: false })
      .closest('tr') as HTMLElement
    const cell = within(row).getAllByRole('cell').at(-1) as HTMLElement
    const recharge = within(cell).getByRole('button', {
      name: 'Roll Fire Breath’s recharge: 5 or more on a d6',
    })
    const count = within(cell).getByText('0 of 1 uses left')
    expect(recharge.compareDocumentPosition(count)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(recharge.parentElement).toHaveClass(
      'flex',
      'items-center',
      'justify-end',
      'gap-1',
    )
    expect(
      within(
        screen
          .getByRole('button', { name: /^Lightning Breath/, expanded: false })
          .closest('tr') as HTMLElement,
      ).getByRole('button', {
        name: 'Roll Lightning Breath’s recharge: a 6 on a d6',
      }),
    ).toBeInTheDocument()
  })

  it('shows no Recharge chip where the game takes none from here', () => {
    renderTable(false)

    expect(screen.queryByRole('button', { name: /recharge/ })).toBeNull()
    expect(screen.getByText('0 of 1 uses left')).toBeInTheDocument()
  })

  it('begins its sections’ ids with its pane’s prefix, a companion’s (module 0.36.0)', () => {
    const sheet = toTableSheet(
      characterSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [sheetAction({ id: 'rend', name: 'Rend' })],
          },
          {
            id: 'legendary',
            label: 'Legendary Actions',
            actions: [sheetAction({ id: 'wing', name: 'Wing Attack' })],
          },
        ],
      }),
      'https://my-game.forge-vtt.com',
    )
    render(
      <SheetIdPrefix value='creature-drake-'>
        <ActionsTab
          characterId='char-1'
          sheet={sheet}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
        />
      </SheetIdPrefix>,
    )
    const legendary = screen.getByRole('region', { name: 'Legendary Actions' })
    expect(legendary).toHaveAttribute(
      'aria-labelledby',
      'creature-drake-actions-1',
    )
    expect(
      within(legendary).getByRole('heading', { name: 'Legendary Actions' }),
    ).toHaveAttribute('id', 'creature-drake-actions-1')
    cleanup()
    // At the character's own pane, as ever.
    render(
      <ActionsTab
        characterId='char-1'
        sheet={sheet}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
      />,
    )
    expect(
      screen.getByRole('region', { name: 'Legendary Actions' }),
    ).toHaveAttribute('aria-labelledby', 'actions-1')
  })
})
