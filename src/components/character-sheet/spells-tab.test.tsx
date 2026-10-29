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
import { Favoriting } from './favoriting'
import { Preparing, usePreparing } from './preparing'
import { SpellsTab } from './spells-tab'
import { useWildShape, WildShaping } from './wild-shape'
import {
  castingSheet,
  characterSheet,
  checkingSheet,
  druidSheet,
  fullerSheet,
  moonBlock,
  offeringFavorites,
  shapedSheet,
  sheetSpell,
  TEXTS,
  utilityUse,
  wolfForm,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type {
  CharacterSheet,
  SheetSpellcasting,
  SheetUse,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <SpellsTab
      characterId='char-1'
      onRoll={jest.fn()}
      onRollDamage={jest.fn()}
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

/** Healing on a creature touched, as Cure Wounds is cast. */
const mend: SheetUse = {
  id: 'mend',
  type: 'heal',
  targets: {
    self: false,
    area: false,
    count: 1,
    perLevel: null,
    affects: 'creature',
  },
}

/**
 * Thorin's spells, of which Cure Wounds heals, Fire Bolt and Witch Bolt attack, and Witch Bolt
 * isn't prepared.
 */
const rolling = (): CharacterSheet => {
  const sheet = fullerSheet()
  const [, first, ...spellbook] = sheet.spells
  return {
    ...sheet,
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [
          sheetSpell({
            id: 'fire-bolt',
            name: 'Fire Bolt',
            level: 0,
            school: 'Evocation',
            range: '120 ft',
            toHit: 4,
            attackId: 'boltAttack',
            damage: [{ formula: '2d10', type: 'Fire', healing: false }],
          }),
        ],
      },
      {
        ...first,
        spells: first.spells.map(spell =>
          spell.id === 'cure'
            ? {
                ...spell,
                range: 'Touch',
                target: '1 Creature',
                activity: mend,
                damage: [
                  { formula: '2d8 + 3', type: 'Healing', healing: true },
                ],
              }
            : spell,
        ),
      },
      {
        id: 'spell1b',
        label: 'Not prepared',
        slots: null,
        spells: [
          sheetSpell({
            id: 'witch',
            name: 'Witch Bolt',
            concentration: true,
            prepared: 0,
            toHit: 4,
            attackId: 'witchAttack',
            damage: [{ formula: '1d12', type: 'Lightning', healing: false }],
          }),
        ],
      },
      ...spellbook,
    ],
  }
}

const row = (name: string) =>
  screen.getByText(name).closest('summary') as HTMLElement

const rows = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map(item => item.querySelector('summary, div')?.textContent)

describe('components/character-sheet/spells-tab', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html: '<p>An invisible barrier of magical force appears.</p>',
          }),
        }) as Response,
    )
  })

  it('shows how the character casts', () => {
    renderTab()

    const casting = within(screen.getByRole('region', { name: 'Spellcasting' }))
    expect(casting.getAllByRole('term').map(term => term.textContent)).toEqual([
      'Ability',
      'Spell save DC',
      'Spell attack',
    ])
    expect(
      casting.getAllByRole('definition').map(value => value.textContent),
    ).toEqual(['Wisdom', '12', '+4'])
    // With one spellcasting class, its are the character's.
    expect(casting.queryByRole('list', { name: 'By class' })).toBeNull()
  })

  it("shows each spellcasting class's own, for a character with more than one", () => {
    renderTab(
      fullerSheet({
        spellcasting: {
          ability: 'Wisdom',
          dc: 13,
          attack: 5,
          classes: [
            { name: 'Cleric', ability: 'Wisdom', dc: 13, attack: 5 },
            { name: 'Wizard', ability: null, dc: null, attack: null },
          ],
        },
      }),
    )

    const classes = screen.getByRole('list', { name: 'By class' })
    expect(
      within(classes)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['ClericWisdomDC 13+5 to hit', 'Wizard'])
  })

  it('leaves out what it does not know of how the character casts', () => {
    renderTab(
      fullerSheet({
        spellcasting: { ability: null, dc: 10, attack: null, classes: [] },
      }),
    )

    const casting = within(screen.getByRole('region', { name: 'Spellcasting' }))
    expect(casting.getAllByRole('term').map(term => term.textContent)).toEqual([
      'Spell save DC',
    ])
  })

  it('shows nothing of how the character casts when nothing is known', () => {
    renderTab(
      fullerSheet({
        spellcasting: { ability: null, dc: null, attack: null, classes: [] },
      }),
    )

    expect(screen.queryByRole('region', { name: 'Spellcasting' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Cantrips' })).toBeInTheDocument()
  })

  it("lists spells by section, with each section's slots left", () => {
    renderTab()

    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['Spellcasting', 'Cantrips', '1st Level', 'Innate'])

    const first = screen.getByRole('region', { name: '1st Level' })
    expect(within(first).getByText('1 of 2 spell slots left')).toHaveClass(
      'sr-only',
    )
    const pips = within(first).getByText('1/2').previousSibling as HTMLElement
    expect([...pips.children].map(pip => pip.className)).toEqual([
      expect.stringContaining('bg-primary'),
      expect.not.stringContaining('bg-primary'),
    ])
    expect(rows(first)).toEqual([
      'Shield1 Reaction · Self',
      'Alarm1 Action · SelfNot preparedRRitual',
      'Cure Wounds1 Action · SelfAlwaysAlways prepared',
    ])
    expect(rows(screen.getByRole('region', { name: 'Cantrips' }))).toEqual([
      'Guidance1 Action · SelfCConcentration',
    ])
    expect(rows(screen.getByRole('region', { name: 'Innate' }))).toEqual([
      'Misty Step1 Action · Self0/10 of 1 uses left',
    ])
  })

  it('mutes a spell that is not prepared', () => {
    renderTab()

    expect(row('Alarm')).toHaveClass('opacity-60')
    expect(row('Shield')).not.toHaveClass('opacity-60')
    expect(row('Cure Wounds')).not.toHaveClass('opacity-60')
  })

  it('opens a spell to how it is cast, and its description', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByText('Shield'))

    const shield = screen.getByText('Shield').closest('li') as HTMLElement
    expect(within(shield).getByText('Level 1 · Abjuration')).toBeInTheDocument()
    expect(
      within(shield)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Casting time: 1 Reaction',
      'Range: Self',
      'Duration: 1 Round',
      'Components: V, S',
    ])
    expect(
      await within(shield).findByText(
        'An invisible barrier of magical force appears.',
      ),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.shield}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  it("names a spell's materials, and that one isn't prepared", async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByText('Alarm'))

    const alarm = screen.getByText('Alarm').closest('li') as HTMLElement
    expect(
      within(alarm).getByText('Level 1 · Abjuration · Not prepared'),
    ).toBeInTheDocument()
    expect(within(alarm).getByText('Components').nextSibling).toHaveTextContent(
      'V, S, M (A tiny bell)',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("calls a cantrip a cantrip, and gives a spell's target", async () => {
    const user = userEvent.setup()
    renderTab(
      fullerSheet({
        spells: [
          {
            id: 'spell0',
            label: 'Cantrips',
            slots: null,
            spells: [
              sheetSpell({
                id: 'fire-bolt',
                name: 'Fire Bolt',
                level: 0,
                school: 'Evocation',
                target: '1 Creature',
                range: '120 ft',
              }),
            ],
          },
        ],
      }),
    )

    expect(rows(screen.getByRole('region', { name: 'Cantrips' }))).toEqual([
      'Fire Bolt1 Action · 120 ft',
    ])
    await user.click(screen.getByText('Fire Bolt'))
    expect(screen.getByText('Cantrip · Evocation')).toBeInTheDocument()
    expect(screen.getByText('Target').nextSibling).toHaveTextContent(
      '1 Creature',
    )
  })

  it('shows a spell level with slots but no spells, whose slots can cast a lower level’s', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      spells: sheet.spells.map(section =>
        section.id === 'spell2'
          ? { ...section, slots: { value: 1, max: 1 } }
          : section,
      ),
    })

    const second = screen.getByRole('region', { name: '2nd Level' })
    expect(second).toHaveTextContent('No spells of this level.')
    expect(
      within(second).getByText('1 of 1 spell slots left'),
    ).toBeInTheDocument()
  })

  it('shows many slots as a number', () => {
    renderTab(
      fullerSheet({
        spells: [
          {
            id: 'pact',
            label: 'Pact Magic',
            slots: { value: 10, max: 12 },
            spells: [sheetSpell({ id: 'hex', name: 'Hex' })],
          },
          {
            id: 'spell3',
            label: '3rd Level',
            slots: { value: 0, max: 0 },
            spells: [sheetSpell({ id: 'fly', name: 'Fly', level: 3 })],
          },
        ],
      }),
    )

    const pact = screen.getByRole('region', { name: 'Pact Magic' })
    expect(within(pact).getByText('10/12').previousSibling).toBeNull()
    // A section without slots to use shows no slots at all.
    const third = screen.getByRole('region', { name: '3rd Level' })
    expect(within(third).queryByText(/slots left/)).toBeNull()
  })

  it('names the item a spell is cast from', () => {
    renderTab(
      fullerSheet({
        spells: [
          {
            id: 'item',
            label: 'Additional Spells',
            slots: null,
            spells: [
              sheetSpell({
                id: 'wand-missile',
                name: 'Magic Missile',
                activation: '1 Action',
                range: '120 ft',
                castFrom: { id: 'wand', name: 'Wand of Magic Missiles' },
              }),
            ],
          },
        ],
      }),
    )

    expect(
      rows(screen.getByRole('region', { name: 'Additional Spells' })),
    ).toEqual(['Magic Missile1 Action · 120 ft · From Wand of Magic Missiles'])
  })

  it('lists a spell its item can’t cast now, muted, saying why, and without its rolls', async () => {
    renderTab(
      fullerSheet({
        spells: [
          {
            id: 'item',
            label: 'Additional Spells',
            slots: null,
            spells: [
              sheetSpell({
                id: 'flame-barbs',
                name: 'Silvery Barbs',
                activation: '1 Reaction',
                range: '60 ft',
                castFrom: {
                  id: 'flame',
                  name: 'Worn Bardic Eternal Flame',
                  usable: false,
                  attune: true,
                },
              }),
              sheetSpell({
                id: 'staff-light',
                name: 'Light',
                activation: '1 Action',
                range: 'Touch',
                castFrom: { id: 'staff', name: 'Staff', usable: false },
              }),
              sheetSpell({
                id: 'wand-missile',
                name: 'Magic Missile',
                activation: '1 Action',
                range: '120 ft',
                castFrom: { id: 'wand', name: 'Wand of Magic Missiles' },
              }),
            ],
          },
        ],
      }),
    )

    expect(
      rows(screen.getByRole('region', { name: 'Additional Spells' })),
    ).toEqual([
      'Silvery BarbsNeeds attuning · From Worn Bardic Eternal Flame · 1 Reaction',
      'LightCan’t be cast now · From Staff · 1 Action',
      'Magic Missile1 Action · 120 ft · From Wand of Magic Missiles',
    ])
    expect(row('Silvery Barbs')).toHaveClass('opacity-60')
    expect(row('Light')).toHaveClass('opacity-60')
    expect(row('Magic Missile')).not.toHaveClass('opacity-60')
    expect(screen.queryByRole('button', { name: /Silvery Barbs/ })).toBeNull()
    // Opened, it says so again, beyond where a narrow row cuts it short.
    await userEvent.setup().click(row('Silvery Barbs'))
    expect(
      await within(row('Silvery Barbs').parentElement!).findByText(
        /· Needs attuning · From Worn Bardic Eternal Flame$/,
      ),
    ).toBeInTheDocument()
  })

  it("puts nothing to read about beside a spell's own activities, as the spell opens to its own description", async () => {
    const user = userEvent.setup()
    const { targets } = mend
    const activity = {
      activation: 'Action',
      range: 'Self',
      target: null,
      toHit: null,
      attackId: null,
      save: null,
      damage: [],
      uses: null,
    }
    renderTab(
      fullerSheet({
        spells: [
          {
            id: 'item',
            label: 'Additional Spells',
            slots: null,
            spells: [
              sheetSpell({
                id: 'staff-guardians',
                name: 'Spirit Guardians',
                level: 3,
                castFrom: { id: 'staff', name: 'Staff of the Guardians' },
                activity: { id: 'call', type: 'utility', targets },
                activities: [
                  {
                    ...activity,
                    id: 'call',
                    name: 'Cast',
                    type: 'utility',
                    activity: { id: 'call', type: 'utility', targets },
                  },
                  {
                    ...activity,
                    id: 'aura',
                    name: 'Emanation Save',
                    type: 'save',
                    activity: { id: 'aura', type: 'save', targets },
                    save: { ability: 'WIS', dc: 14 },
                  },
                ],
              }),
            ],
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: /^Spirit Guardians/,
        expanded: false,
      }),
    )
    expect(
      within(
        screen.getByRole('list', {
          name: 'Spirit Guardians: its other activities',
        }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^Emanation Save/)
    expect(screen.queryByRole('button', { name: /^About / })).toBeNull()
  })

  it("says what a spell cast from an item costs, as the item's Cast of it says, from module 0.20.0, and nothing for a later activity that spends none", async () => {
    const user = userEvent.setup()
    renderTab(castingSheet())

    const listed = within(
      screen.getByRole('region', { name: 'Item Spells' }),
    ).getAllByRole('button', { expanded: false })
    expect(listed.map(button => button.textContent)).toEqual([
      'Magic MissileFrom Wand of Magic Missiles · 1 Action · 120 ft · Force · 1–3 charges',
      'HexFrom Bardic Flame · 1 Bonus Action · 90 ft · 1 charge · 1 more',
    ])
    await user.click(listed[1])
    expect(
      within(
        screen.getByRole('list', { name: 'Hex: its other activities' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^Bonus Hex DamageSpecial · Necrotic1d6$/)
  })

  it('lists a spell’s free casting beneath it, cast by a chip of its own, saying what it spends, from module 0.21.0', async () => {
    const user = userEvent.setup()
    const onUse = jest.fn()
    render(
      <SpellsTab
        characterId='char-rook'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        onUse={onUse}
        sheet={toTableSheet(checkingSheet(), 'https://my-game.forge-vtt.com')}
      />,
    )

    // The spell itself is cast with a slot, an 8th-level one being left.
    const bless = screen.getByRole('button', {
      name: /^Bless/,
      expanded: false,
    })
    expect(bless).not.toHaveTextContent('No slots left')
    await user.click(bless)
    const [free] = within(
      screen.getByRole('list', { name: 'Bless: its other activities' }),
    ).getAllByRole('listitem')
    expect(free).toHaveTextContent(/^Cast \(free casting\)1 useCast$/)
    await user.click(
      within(free).getByRole('button', {
        name: 'Cast Bless (Cast (free casting))',
      }),
    )
    expect(onUse.mock.calls[0][0]).toMatchObject({
      id: 'bless',
      activity: { id: 'bless-free' },
      consumesSlot: false,
      forward: { charges: 1, short: false },
    })
  })

  it('lists one free casting of a spell, and dims the spell itself once no slot is left, its own uses spent only by that, from module 0.21.0', async () => {
    const user = userEvent.setup()
    const onUse = jest.fn()
    const sheet = checkingSheet()
    const [first, last] = sheet.spells
    last.slots = { value: 0, max: 1, level: 8 }
    render(
      <SpellsTab
        characterId='char-rook'
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        onUse={onUse}
        sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
      />,
    )

    // Bless has a use of its own left, but that's its free casting's, beneath it.
    expect(first.spells[0].uses).toEqual({
      value: 1,
      max: 1,
      recovery: 'Long Rest',
    })
    const bless = screen.getByRole('button', {
      name: /^Bless/,
      expanded: false,
    })
    expect(bless).toHaveClass('opacity-60')
    expect(bless).toHaveTextContent('No slots left')
    await user.click(bless)
    const free = within(
      screen.getByRole('list', { name: 'Bless: its other activities' }),
    ).getAllByRole('listitem')
    expect(free).toHaveLength(1)
    expect(free[0]).toHaveTextContent(/^Cast \(free casting\)1 useCast$/)
    expect(free[0].querySelector('.opacity-60')).toBeNull()
    await user.click(
      within(free[0]).getByRole('button', {
        name: 'Cast Bless (Cast (free casting))',
      }),
    )
    expect(onUse.mock.calls[0][0]).toMatchObject({
      id: 'bless',
      activity: { id: 'bless-free' },
      forward: { charges: 1, short: false },
    })
  })

  it('searches spells by name, whatever its case, once there are more than four', async () => {
    const user = userEvent.setup()
    renderTab(rolling())
    const search = screen.getByRole('searchbox', {
      name: 'Search spells by name',
    })

    await user.type(search, 'BOLT')
    expect(screen.getByText('2 spells found')).toHaveClass('sr-only')
    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['Spellcasting', 'Cantrips', 'Not prepared'])
    expect(rows(screen.getByRole('region', { name: 'Cantrips' }))).toEqual([
      expect.stringMatching(/^Fire Bolt/),
    ])
    expect(screen.queryByText('Shield')).toBeNull()

    // A section with slots but no spell found is left out while searching.
    await user.clear(search)
    await user.type(search, 'cure')
    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['Spellcasting', '1st Level'])

    await user.clear(search)
    await user.type(search, '  wish ')
    expect(screen.getByText('No spells match “wish”.')).toBeInTheDocument()
    // A screen reader hears what the search found.
    expect(screen.getByText('No spells found')).toHaveAttribute(
      'aria-live',
      'polite',
    )

    await user.clear(search)
    expect(screen.getByRole('region', { name: 'Innate' })).toBeInTheDocument()
    expect(screen.getByText('Shield')).toBeInTheDocument()
  })

  it('searches spells word by word, whatever their accents or quotes', async () => {
    const user = userEvent.setup()
    const sheet = rolling()
    sheet.spells[1].spells.push(
      sheetSpell({ id: 'melf', name: 'Mélf’s Acid Arrow', level: 2 }),
    )
    renderTab(sheet)
    const search = screen.getByRole('searchbox', {
      name: 'Search spells by name',
    })
    // 16px, so iOS doesn't zoom into it.
    expect(search).toHaveClass('text-base')

    await user.type(search, "melf's arrow")
    expect(screen.getByText('1 spell found')).toHaveClass('sr-only')
    expect(rows(screen.getByRole('region', { name: '1st Level' }))).toEqual([
      expect.stringMatching(/^Mélf’s Acid Arrow/),
    ])

    // Each word anywhere in the name, in any order: of the two bolts, only Fire Bolt.
    await user.clear(search)
    await user.type(search, 'bolt fi')
    expect(screen.getByText('1 spell found')).toBeInTheDocument()
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument()
    expect(screen.queryByText('Witch Bolt')).toBeNull()

    // Escape clears it first.
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(screen.getByText('Witch Bolt')).toBeInTheDocument()
  })

  it('offers no search for four spells or fewer', () => {
    const sheet = fullerSheet()
    renderTab({
      ...sheet,
      spells: sheet.spells.map(section =>
        section.id === 'innate' ? { ...section, spells: [] } : section,
      ),
    })

    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByText('Shield')).toBeInTheDocument()
  })

  it('shows what a spell rolls beside it, rolling it here or casting it in the game', async () => {
    const user = userEvent.setup()
    const onRoll = jest.fn()
    const onRollDamage = jest.fn()
    const onUse = jest.fn()
    render(
      <SpellsTab
        characterId='char-1'
        sheet={toTableSheet(rolling(), 'https://my-game.forge-vtt.com')}
        onRoll={onRoll}
        onRollDamage={onRollDamage}
        onUse={onUse}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Fire Bolt attack, +4' }),
    )
    expect(onRoll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Fire Bolt attack',
        modifier: 4,
        source: { kind: 'attack', item: 'fire-bolt', activity: 'boltAttack' },
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Fire Bolt damage, 2d10' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Fire Bolt damage',
        source: { item: 'fire-bolt', activity: 'boltAttack' },
      }),
    )
    // Cast in the game, its healing following.
    await user.click(
      screen.getByRole('button', { name: 'Cure Wounds healing, 2d8 + 3' }),
    )
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cure', type: 'spell', activity: mend }),
    )
    // Not prepared, it's rolled here only, as the game would have it prepared first.
    await user.click(
      screen.getByRole('button', { name: 'Witch Bolt attack, +4' }),
    )
    expect(onRoll.mock.lastCall?.[0]).toMatchObject({
      label: 'Witch Bolt attack',
      source: undefined,
    })
    expect(
      screen.getByRole('button', { name: /^Witch Bolt/, expanded: false }),
    ).toHaveClass('opacity-60')
    // The rest of the spellbook is as it was.
    expect(row('Shield')).toBeInTheDocument()
  })

  it('rolls damage whose dice Foundry rerolls, as a chip of its own', async () => {
    const user = userEvent.setup()
    const onRollDamage = jest.fn()
    const sheet = rolling()
    const [cantrips, ...spellbook] = sheet.spells
    const blade = sheetSpell({
      id: 'blade',
      name: 'Booming Blade',
      level: 0,
      school: 'Evocation',
      toHit: 7,
      attackId: 'bladeAttack',
      damage: [
        { formula: '2d6r<=2 + 7 + 1d8', type: 'Thunder', healing: false },
      ],
    })
    render(
      <SpellsTab
        characterId='char-1'
        sheet={toTableSheet(
          {
            ...sheet,
            spells: [{ ...cantrips, spells: [blade] }, ...spellbook],
          },
          'https://my-game.forge-vtt.com',
        )}
        onRoll={jest.fn()}
        onRollDamage={onRollDamage}
      />,
    )

    const chip = screen.getByRole('button', {
      name: 'Booming Blade damage, 2d6r<=2 + 7 + 1d8',
    })
    expect(chip).toBeEnabled()
    await user.click(chip)
    expect(onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Booming Blade damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
              { sign: 1, flat: 7 },
              { sign: 1, count: 1, sides: 8 },
            ],
            type: 'Thunder',
          },
        ],
      }),
    )
  })

  it('opens a spell that rolls to how it is cast, as any other, and what it rolls', async () => {
    const user = userEvent.setup()
    render(
      <SpellsTab
        characterId='char-1'
        sheet={toTableSheet(rolling(), 'https://my-game.forge-vtt.com')}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /^Cure Wounds/, expanded: false }),
    )
    await user.click(
      screen.getByRole('button', { name: /^Witch Bolt/, expanded: false }),
    )

    const cure = screen
      .getByRole('button', { name: /^Cure Wounds/, expanded: true })
      .closest('li') as HTMLElement
    expect(within(cure).getByText('Level 1 · Evocation')).toBeInTheDocument()
    expect(
      within(cure)
        .getAllByRole('term')
        .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`),
    ).toEqual([
      'Casting time: 1 Action',
      'Range: Touch',
      'Target: 1 Creature',
      'Duration: Instantaneous',
      'Components: V, S',
      'Healing: 2d8 + 3',
      'Cast at: 1st 1/21st Level, 1 of 2 slots left',
    ])
    const witch = screen
      .getByRole('button', { name: /^Witch Bolt/, expanded: true })
      .closest('li') as HTMLElement
    expect(
      within(witch).getByText('Level 1 · Abjuration · Not prepared'),
    ).toBeInTheDocument()
    expect(within(witch).getByText('Concentration')).toHaveClass('sr-only')
    // Cast here, it's the player's to say which slot it takes.
    expect(within(witch).queryByText('Cast at')).toBeNull()
  })

  it('says so when there are no spells to show', () => {
    renderTab(characterSheet())

    expect(screen.getByText('No spells to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('stars a favorite, and shows first what it is given, such as the favorites', () => {
    render(
      <FavoriteMarks keys={new Set(['item:shield'])}>
        <SpellsTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
          favorites={<p>Her favorites</p>}
        />
      </FavoriteMarks>,
    )

    expect(
      screen.getAllByText(', favorite').map(star => star.closest('summary')),
    ).toEqual([row('Shield')])
    expect(
      screen
        .getByText('Her favorites')
        .compareDocumentPosition(
          screen.getByRole('heading', { name: 'Spellcasting' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})

/** A spell's row, by its name: its summary, its plain row, or its name's button. */
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.querySelector('button') ??
    item.firstElementChild) as HTMLElement
}

describe('components/character-sheet/spells-tab, favorites, from module 0.37.0', () => {
  /** The tab, inside a pane that offers favorites, Shield already one. */
  const renderOffered = () => {
    const offering = offeringFavorites(['item:shield'])
    render(
      <Favoriting value={offering.value}>
        <SpellsTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        />
      </Favoriting>,
    )
    return offering
  }

  it('offers Add of a spell that isn’t one, and Remove of one that is, as the spell', async () => {
    const user = userEvent.setup()
    const offering = renderOffered()
    fireEvent.contextMenu(rowOf('Alarm'), { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Alarm' })).getByRole(
        'menuitem',
        { name: 'Add to favorites' },
      ),
    )
    fireEvent.contextMenu(rowOf('Shield'), { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Shield' })).getByRole(
        'menuitem',
        { name: 'Remove from favorites' },
      ),
    )
    expect(offering.chosen).toEqual([
      { target: { type: 'item', id: 'alarm' }, name: 'Alarm', op: 'add' },
      { target: { type: 'item', id: 'shield' }, name: 'Shield', op: 'remove' },
    ])
  })

  it('opens it by Shift+F10 from a row that takes focus, and none without a pane offering it', () => {
    renderOffered()
    const alarm = rowOf('Alarm')
    alarm.focus()
    expect(fireEvent.contextMenu(alarm, { button: -1 })).toBe(false)
    expect(screen.getByRole('menu', { name: 'Alarm' })).toBeVisible()
    cleanup()

    renderTab()
    expect(fireEvent.contextMenu(rowOf('Alarm'), { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('components/character-sheet/spells-tab, Wild Shape, from module 0.40.0', () => {
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
        <SpellsTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={table}
        />
      </Shaping>,
    )
  }

  it('says first, in a dashed callout, that Elowen casts nothing as the form, and which slots wait', () => {
    const { container } = renderShaped()

    const note = screen.getByText(
      'Elowen can’t cast spells as a Wolf. The spell slots wait: 4 of 4 1st level, 3 of 3 2nd level.',
    )
    expect(note).toHaveClass('border-dashed')
    expect((container.firstElementChild as HTMLElement).firstElementChild).toBe(
      note,
    )
  })

  it('says a druid of the Circle of the Moon casts only that circle’s spells as the form', () => {
    renderShaped(shapedSheet({ wildShape: moonBlock() }))

    expect(
      screen.getByText(
        'As a Wolf, Elowen can cast only Circle of the Moon spells.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/The spell slots wait/)).toBeNull()
  })

  it('says nothing of the Moon’s spells for another transformation, such as a Polymorph, as they’re Wild Shape’s (round 0.40.0 review)', () => {
    renderShaped(
      shapedSheet({
        wildShape: moonBlock(),
        form: wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          hours: null,
          minutesLeft: null,
          profile: null,
        }),
      }),
    )

    expect(screen.queryByText(/Circle of the Moon/)).toBeNull()
    expect(
      screen.getByText(
        'Elowen can’t cast spells as a Giant Ape. The spell slots wait: 4 of 4 1st level, 3 of 3 2nd level.',
      ),
    ).toBeVisible()
  })

  it('says nothing of it unshaped, nor at the Gamemaster’s page', () => {
    const { unmount } = renderShaped(druidSheet())
    expect(screen.queryByText(/as a Wolf/)).toBeNull()
    expect(screen.getByText('Goodberry')).toBeVisible()
    unmount()

    renderShaped(shapedSheet(), 'gm')
    expect(screen.queryByText(/can’t cast spells/)).toBeNull()
  })
})

/**
 * Thorin's spells, as `rolling` has them, with Bless besides: a utility, so a row that rolls
 * nothing while it isn't prepared, and an action's once it is, as the game may cast it then.
 */
const preparing = (
  { witch = 0, bless = 0 }: { witch?: 0 | 1; bless?: 0 | 1 } = {},
  fields: Partial<CharacterSheet> = {},
): CharacterSheet => {
  const sheet = rolling()
  return {
    ...sheet,
    ...fields,
    spells: sheet.spells.map(section => ({
      ...section,
      spells: [
        ...section.spells.map(spell =>
          spell.id === 'witch' ? { ...spell, prepared: witch } : spell,
        ),
        ...(section.id === 'spell1'
          ? [
              sheetSpell({
                id: 'bless',
                name: 'Bless',
                concentration: true,
                prepared: bless,
                activity: utilityUse('blessUse'),
              }),
            ]
          : []),
      ],
    })),
  }
}

/** A spell's name button, as a spell that rolls is drawn: its menu opens from it. */
const nameOf = (name: string) =>
  screen.getByRole('button', {
    name: new RegExp(`^${name}`),
    expanded: false,
  })

/** What a spell's row's menu offers, opened by a right-click; none for no menu. */
const menuOf = async (anchor: HTMLElement, name: string) => {
  fireEvent.contextMenu(anchor, { button: 2 })
  const menu = screen.queryByRole('menu', { name })
  const items = menu
    ? within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    : undefined
  if (menu) await userEvent.keyboard('{Escape}')
  return items
}

describe('components/character-sheet/spells-tab, spells prepared and unprepared, from module 0.42.1 (round 0.42.1 §P.4)', () => {
  /** The tab inside a pane that prepares its spells, as the pane does, by the states given. */
  function Preparer({
    sheet,
    states,
    send,
  }: Readonly<{
    sheet: TableSheet
    states: ReadonlyMap<string, TableRollState>
    send: () => string
  }>) {
    const value = usePreparing({
      on: true,
      spells: sheet.spells,
      states,
      send,
    })
    return (
      <Preparing value={value}>
        <SpellsTab
          characterId='char-1'
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          sheet={sheet}
        />
      </Preparing>
    )
  }

  const renderPreparing = (sheet: CharacterSheet = preparing()) => {
    const send = jest.fn(() => 'use-1')
    const table = (next: CharacterSheet) =>
      toTableSheet(next, 'https://my-game.forge-vtt.com')
    const view = render(
      <Preparer sheet={table(sheet)} states={new Map()} send={send} />,
    )
    const redraw = (
      next: CharacterSheet,
      states: ReadonlyMap<string, TableRollState>,
    ) =>
      view.rerender(
        <Preparer sheet={table(next)} states={states} send={send} />,
      )
    return { send, redraw }
  }

  it('offers Prepare of a spell not prepared, and Unprepare of one prepared, whichever row draws it', async () => {
    renderPreparing(preparing({ witch: 0 }))
    // A spell that rolls, from its name; one that rolls nothing, from its row.
    expect(await menuOf(nameOf('Witch Bolt'), 'Witch Bolt')).toEqual([
      'Prepare',
    ])
    expect(await menuOf(rowOf('Alarm'), 'Alarm')).toEqual(['Prepare'])
    expect(await menuOf(rowOf('Shield'), 'Shield')).toEqual(['Unprepare'])
    cleanup()

    renderPreparing(preparing({ witch: 1 }))
    expect(await menuOf(nameOf('Witch Bolt'), 'Witch Bolt')).toEqual([
      'Unprepare',
    ])
  })

  it('offers neither of one always prepared, a cantrip, one at will, or one an item casts', async () => {
    renderPreparing()
    expect(await menuOf(nameOf('Cure Wounds'), 'Cure Wounds')).toBeUndefined()
    expect(await menuOf(nameOf('Fire Bolt'), 'Fire Bolt')).toBeUndefined()
    expect(await menuOf(rowOf('Misty Step'), 'Misty Step')).toBeUndefined()
    cleanup()

    renderPreparing(castingSheet())
    expect(
      await menuOf(nameOf('Magic Missile'), 'Magic Missile'),
    ).toBeUndefined()
  })

  it('sends what is chosen, and goes on waiting by the spell’s id as the sheet redraws a utility’s row as an action’s', async () => {
    const user = userEvent.setup()
    const { send, redraw } = renderPreparing()
    const sending = new Map([['use-1', { status: 'rolling' }]]) as ReadonlyMap<
      string,
      TableRollState
    >

    // Bless rolls nothing while it isn't prepared: its row's menu.
    expect(screen.getByText('Bless').closest('summary')).not.toBeNull()
    fireEvent.contextMenu(rowOf('Bless'), { button: 2 })
    await user.click(screen.getByRole('menuitem', { name: 'Prepare' }))
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bless' }),
      'prepare',
    )

    redraw(preparing(), sending)
    fireEvent.contextMenu(rowOf('Bless'), { button: 2 })
    expect(screen.getByRole('menuitem', { name: 'Prepare' })).toBeDisabled()
    await user.keyboard('{Escape}')

    // The sheet comes before the game's answer: prepared, it's an action's row now, which waits.
    redraw(preparing({ bless: 1 }), sending)
    expect(screen.getByText('Bless').closest('summary')).toBeNull()
    fireEvent.contextMenu(nameOf('Bless'), { button: 2 })
    const entry = screen.getByRole('menuitem', { name: 'Unprepare' })
    expect(entry).toBeDisabled()
    expect(entry).toHaveAccessibleDescription('It’s on its way already')
    await user.keyboard('{Escape}')

    // Made, as the sheet already says.
    redraw(
      preparing({ bless: 1 }),
      new Map([['use-1', { status: 'done', visible: true }]]),
    )
    fireEvent.contextMenu(nameOf('Bless'), { button: 2 })
    expect(screen.getByRole('menuitem', { name: 'Unprepare' })).toBeEnabled()
  })

  it('offers neither outside a pane that prepares spells, the menus as they were', async () => {
    renderTab(preparing({ witch: 1 }))
    expect(await menuOf(nameOf('Witch Bolt'), 'Witch Bolt')).toBeUndefined()
    expect(await menuOf(rowOf('Alarm'), 'Alarm')).toBeUndefined()
  })

  it('says “Not prepared” in words on a closed row of a spell not prepared, however it’s drawn, and nothing of one prepared', () => {
    renderTab(preparing({ witch: 0, bless: 1 }))

    for (const name of ['Alarm', 'Witch Bolt']) {
      const item = screen.getByText(name).closest('li') as HTMLElement
      const mark = within(item).getByText('Not prepared')
      expect(mark).not.toHaveClass('sr-only')
      expect(mark).toHaveClass('border', 'border-border', 'uppercase')
      expect(mark).toHaveClass('text-[10px]', 'text-text-secondary')
      expect(mark).toBeVisible()
    }
    for (const name of ['Shield', 'Bless', 'Cure Wounds']) {
      const item = screen.getByText(name).closest('li') as HTMLElement
      expect(within(item).queryByText('Not prepared')).toBeNull()
    }
    // Its text, and the row's, as the unseen mark read before.
    expect(rowOf('Alarm')).toHaveTextContent(
      'Alarm1 Action · SelfNot preparedRRitual',
    )
    // Still faded, as before.
    expect(rowOf('Alarm')).toHaveClass('opacity-60')
  })
})

/** How the character casts, as the Spells tab shows it first. */
const castingRegion = () =>
  within(screen.getByRole('region', { name: 'Spellcasting' }))

/** The facts of how the character casts, by their labels. */
const castingFacts = () =>
  castingRegion()
    .getAllByRole('term')
    .map(term => term.textContent)

describe('components/character-sheet/spells-tab, how many are prepared, from module 0.42.1 (round 0.42.1 §P amendment)', () => {
  type Classes = SheetSpellcasting['classes']
  const cleric: Classes[number] = {
    name: 'Cleric',
    ability: 'Wisdom',
    dc: 13,
    attack: 5,
  }
  const casting = (classes: Classes): SheetSpellcasting => ({
    ability: 'Wisdom',
    dc: 13,
    attack: 5,
    classes,
  })

  it('says how many of a lone class’s spells are prepared, of how many, beside its other facts', () => {
    renderTab(
      fullerSheet({
        spellcasting: casting([{ ...cleric, prepared: { value: 5, max: 6 } }]),
      }),
    )
    expect(castingFacts()).toEqual([
      'Ability',
      'Spell save DC',
      'Spell attack',
      'Prepared',
    ])
    const value = castingRegion()
      .getAllByRole('definition')
      .at(-1) as HTMLElement
    expect(value).toHaveTextContent('5 / 65 of 6')
    // Seen as dnd5e shows it, and read in words.
    expect(within(value).getByText('5 / 6')).toHaveAttribute('aria-hidden')
    expect(within(value).getByText('5 of 6')).toHaveClass('sr-only')
  })

  it('shows past the limit as it is, as dnd5e never refuses one more, and the count alone with no limit', () => {
    renderTab(
      fullerSheet({
        spellcasting: casting([{ ...cleric, prepared: { value: 7, max: 6 } }]),
      }),
    )
    const over = castingRegion()
      .getAllByRole('definition')
      .at(-1) as HTMLElement
    // No colour of its own, nor any warning.
    expect(within(over).getByText('7 / 6').className).toBe(
      'text-lg font-bold tabular-nums',
    )
    expect(within(over).getByText('7 of 6')).toBeInTheDocument()
    cleanup()

    // A homebrew class that may prepare none, with some prepared.
    renderTab(
      fullerSheet({
        spellcasting: casting([{ ...cleric, prepared: { value: 5, max: 0 } }]),
      }),
    )
    const bare = castingRegion()
      .getAllByRole('definition')
      .at(-1) as HTMLElement
    expect(bare).toHaveTextContent(/^55$/)
    expect(
      within(bare).getByText('5', { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('shows nothing where the class counts none, or an older module doesn’t say', () => {
    renderTab(fullerSheet({ spellcasting: casting([cleric]) }))
    expect(castingFacts()).toEqual(['Ability', 'Spell save DC', 'Spell attack'])
    cleanup()

    renderTab(
      fullerSheet({
        spellcasting: casting([{ ...cleric, prepared: { value: 0, max: 0 } }]),
      }),
    )
    expect(castingFacts()).toEqual(['Ability', 'Spell save DC', 'Spell attack'])
    expect(screen.queryByText(/Prepared/)).toBeNull()
  })

  it('says each class’s own on its row for a character with more than one, and none of its own on top', () => {
    renderTab(
      fullerSheet({
        spellcasting: casting([
          { ...cleric, prepared: { value: 5, max: 6 } },
          {
            name: 'Wizard',
            ability: 'Intelligence',
            dc: 14,
            attack: 6,
            prepared: { value: 7, max: 6 },
          },
          { name: 'Sorcerer', ability: 'Charisma', dc: 13, attack: 5 },
        ]),
      }),
    )
    expect(castingFacts()).toEqual(['Ability', 'Spell save DC', 'Spell attack'])
    const classes = within(screen.getByRole('list', { name: 'By class' }))
    expect(
      classes.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'ClericWisdomDC 13+5 to hitPrepared 5 / 6Prepared 5 of 6',
      'WizardIntelligenceDC 14+6 to hitPrepared 7 / 6Prepared 7 of 6',
      'SorcererCharismaDC 13+5 to hit',
    ])
    expect(classes.getByText('Prepared 5 of 6')).toHaveClass('sr-only')
    expect(classes.getByText('5 / 6')).toHaveClass('font-semibold')
  })
})
