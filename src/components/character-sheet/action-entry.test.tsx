/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  forwardNote,
  useDamageRolls,
  type DamageTarget,
  type TableDamage,
} from './action-entry'
import { ActionsTab } from './actions-tab'
import {
  DescriptionLinks,
  sheetTools,
  type DescriptionActions,
} from './description-actions'
import { RollsLocked } from '@/hooks/use-rolls-locked'
import {
  fireBreath,
  lightningBreath,
  longsword,
  spiritSheet,
} from '@/mocks/alone'
import {
  characterSheet,
  checkingSheet,
  MAZE_CHECK,
  sheetAction,
  sheetSpell,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Layout } from './actions-layout'
import type {
  CharacterSheet,
  DamagePreview,
  SheetAction,
  SheetActivity,
} from '@/types/sending-stone'

/*
 * The checks activities ask for, and activities that use others, as the Actions tab shows them,
 * from module 0.21.0: Rook, a Thief, with Fast Hands, Thieves' Tools, Maze and Bless.
 */

/** What the sheet gives its descriptions, and so its checks, to act with, each a mock. */
const actionsFor = (
  sheet: CharacterSheet,
  fields: Partial<DescriptionActions> = {},
): DescriptionActions => ({
  roll: jest.fn(),
  rollDamage: jest.fn(),
  rollFormula: jest.fn(),
  takes: () => true,
  ask: jest.fn(),
  abilities: sheet.abilities,
  skills: sheet.skills,
  tools: sheetTools(sheet),
  proficiency: sheet.proficiency,
  conditions: [],
  rules: 'modern',
  showConditions: jest.fn(),
  ...fields,
})

/**
 * Rook's Actions tab, in a sheet whose descriptions act as given, using spells and features in the
 * game where `using`.
 */
const renderRook = ({
  sheet = checkingSheet(),
  using = true,
  actions = {},
  layout,
}: {
  sheet?: CharacterSheet
  using?: boolean
  actions?: Partial<DescriptionActions>
  layout?: Layout
} = {}) => {
  const onUse = jest.fn()
  const described = actionsFor(sheet, actions)
  render(
    <DescriptionLinks actions={described}>
      <ActionsTab
        characterId='char-rook'
        sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
        onRoll={jest.fn()}
        onRollDamage={jest.fn()}
        {...(using && { onUse })}
        layout={layout}
      />
    </DescriptionLinks>,
  )
  return { onUse, roll: described.roll as jest.Mock }
}

/** The button that opens an action, named for it. */
const toggle = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`), expanded: false })

/** What's listed beneath an action, of its other activities. */
const others = (name: string) =>
  within(screen.getByRole('list', { name: `${name}: its other activities` }))
    .getAllByRole('listitem')
    .map(item => item.textContent)

/** The menu's items, as named, with what each says under it. */
const itemsOf = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map(item => {
      // What it says under it, where it says anything, is the one part of it named by an id.
      const note = item.querySelector('[id]')?.textContent
      const name = item.getAttribute('aria-label') ?? item.textContent
      return note ? `${name} — ${note}` : name
    })

/** The row of an action, as the list shows it. */
const rowOf = (name: string) => toggle(name).closest('li')!

/** Escape Plants', the 2014 Entangle's check, which a creature it restrains makes: STR, DC 18. */
const ESCAPE_CHECK = {
  checks: [{ type: 'check' as const, ability: 'str' }],
  dc: 18,
  own: false,
}

/**
 * Rook with the 2014 Entangle too, as the module sends it from 0.21.0: led by its saving throw,
 * which casts it, though dnd5e sorts its check first; then that check, which has no activation of
 * its own, used without a slot. Neither he nor the spell has any 1st-level slots left, and his
 * 8th-level slots are as many as given.
 */
const entangling = (eighth = 1): CharacterSheet => {
  const sheet = checkingSheet()
  const cast: SheetActivity = {
    id: 'entangle-cast',
    name: 'Cast',
    type: 'save',
    activation: '1 Action',
    activationType: 'action',
    range: '90 ft',
    target: '20 ft Square',
    toHit: null,
    attackId: null,
    activity: {
      id: 'entangle-cast',
      type: 'save',
      targets: {
        self: false,
        area: true,
        count: null,
        perLevel: null,
        affects: null,
      },
    },
    save: { ability: 'STR', dc: 18 },
    damage: [],
    uses: null,
  }
  const escape: SheetActivity = {
    id: 'escape-plants',
    name: 'Escape Plants Check',
    type: 'check',
    activation: null,
    activationType: null,
    range: 'Special',
    target: null,
    toHit: null,
    attackId: null,
    activity: {
      id: 'escape-plants',
      type: 'check',
      targets: {
        self: false,
        area: false,
        count: 1,
        perLevel: null,
        affects: 'creature',
      },
    },
    save: null,
    damage: [],
    consumesSlot: false,
    check: ESCAPE_CHECK,
    uses: null,
  }
  const entangle = {
    range: '90 ft',
    target: '20 ft Square',
    concentration: true,
    activity: cast.activity,
    save: cast.save,
    damage: [],
    activities: [cast, escape],
  }
  sheet.actions[0].actions.push(
    sheetAction({
      id: 'entangle',
      name: 'Entangle',
      type: 'spell',
      activation: '1 Action',
      activationType: 'action',
      level: 1,
      ...entangle,
    }),
  )
  const [first, last] = sheet.spells
  first.spells.push(
    sheetSpell({
      id: 'entangle',
      name: 'Entangle',
      school: 'Conjuration',
      prepared: 1,
      toHit: null,
      ...entangle,
    }),
  )
  last.slots = { value: eighth, max: 1, level: 8 }
  return sheet
}

describe('action-entry: checks activities ask for, and activities that use others', () => {
  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
  })

  it("shows a check's chip in place of the Use chip: one way's name and its DC, with a hammer for a tool's", () => {
    renderRook()

    const lock = within(rowOf("Thieves' Tools")).getByRole('button', {
      name: "Thieves' Tools, DC 15 Dexterity (Thieves' Tools) check",
    })
    expect(lock).toHaveTextContent("Thieves' ToolsDC 15")
    expect(lock).toHaveAttribute('aria-haspopup', 'menu')
    expect(lock.querySelector('.lucide-hammer')).not.toBeNull()
    const hands = within(rowOf('Fast Hands')).getByRole('button', {
      name: 'Fast Hands, Dexterity (Sleight of Hand) check',
    })
    expect(hands).toHaveTextContent(/^Sleight of Hand$/)
    expect(hands.querySelector('.lucide-search')).not.toBeNull()
    // No Use chip beside it.
    expect(
      screen.queryByRole('button', {
        name: /^Use (Thieves' Tools|Fast Hands)/,
      }),
    ).toBeNull()
    // Nor is either used only in Foundry.
    expect(rowOf('Fast Hands')).not.toHaveTextContent('Used in Foundry')
  })

  it("opens a check of the player's own to ask the table, saying what that does, or roll their own, which spends nothing", async () => {
    const user = userEvent.setup()
    renderRook()

    await user.click(
      screen.getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
    )
    expect(screen.getByRole('menu')).toHaveAccessibleName(
      "DC 15 Dexterity (Thieves' Tools) check",
    )
    expect(itemsOf()).toEqual([
      "Ask the table — Uses Thieves' Tools",
      "Roll my Thieves' Tools check (+6) — Spends nothing",
      'Roll with advantage',
      'Roll with disadvantage',
      'Modify roll…',
    ])
  })

  it("rolls the player's own against its DC, for the game to make it against the activity, its tool's bonus added", async () => {
    const user = userEvent.setup()
    const { roll, onUse } = renderRook()

    await user.click(
      screen.getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
    )
    await user.click(
      screen.getByRole('menuitem', {
        name: "Roll my Thieves' Tools check (+6)",
      }),
    )
    expect(roll).toHaveBeenCalledWith({
      label: "Thieves' Tools check",
      modifier: 6,
      advantage: undefined,
      source: { kind: 'tool', key: 'thief', item: 'tools', activity: 'pick' },
      explicit: false,
      dc: 15,
    })

    await user.click(screen.getByRole('button', { name: /^Fast Hands, / }))
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
    )
    expect(roll).toHaveBeenLastCalledWith({
      label: 'Sleight of Hand check',
      modifier: 5,
      advantage: 'dis',
      source: {
        kind: 'skill',
        key: 'slt',
        item: 'fast-hands',
        activity: 'fh-slt',
      },
      explicit: true,
    })
    expect(onUse).not.toHaveBeenCalled()
  })

  it('asks the table for it by using the activity in the game', async () => {
    const user = userEvent.setup()
    const { onUse, roll } = renderRook()

    await user.click(screen.getByRole('button', { name: /^Fast Hands, / }))
    await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))
    expect(onUse).toHaveBeenCalledTimes(1)
    const [used] = onUse.mock.calls[0] as [SheetAction]
    expect(used).toMatchObject({
      id: 'fast-hands',
      activity: { id: 'fh-slt', type: 'check' },
    })
    expect(roll).not.toHaveBeenCalled()
  })

  it("offers the later activities' checks beneath their item, each its own", async () => {
    const user = userEvent.setup()
    const { roll } = renderRook()

    await user.click(toggle('Fast Hands'))
    expect(others('Fast Hands')).toEqual([
      "Thieves' ToolsThieves' Tools",
      'Use an ObjectUse',
    ])
    await user.click(
      screen.getByRole('button', {
        name: "Fast Hands (Thieves' Tools), Dexterity (Thieves' Tools) check",
      }),
    )
    await user.click(
      screen.getByRole('menuitem', {
        name: "Roll my Thieves' Tools check (+5)",
      }),
    )
    expect(roll).toHaveBeenCalledWith(
      expect.objectContaining({
        modifier: 5,
        source: {
          kind: 'tool',
          key: 'thief',
          item: 'fast-hands',
          activity: 'fh-thief',
        },
      }),
    )
    expect(roll.mock.calls[0][0]).not.toHaveProperty('dc')
  })

  it('uses a check another creature makes, as a saving throw’s chip does, with no roll of the player’s own', async () => {
    const user = userEvent.setup()
    const { onUse } = renderRook()

    const maze = screen.getByRole('button', {
      name: 'Maze, DC 20 Intelligence (Investigation) check',
    })
    expect(maze).toHaveTextContent('InvestigationDC 20')
    expect(maze).not.toHaveAttribute('aria-haspopup')
    await user.click(maze)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onUse.mock.calls[0][0]).toMatchObject({
      id: 'maze',
      check: MAZE_CHECK,
    })
  })

  it('names several ways to make it a check, and only shows one another creature makes while the game takes no uses', async () => {
    const user = userEvent.setup()
    const sheet = checkingSheet()
    const [, maze] = sheet.actions[0].actions
    sheet.actions[0].actions[1] = {
      ...maze,
      check: {
        ...MAZE_CHECK,
        checks: [
          { type: 'skill', ability: 'int', key: 'inv' },
          { type: 'check', ability: 'str' },
        ],
      },
    }
    const { onUse } = renderRook({ sheet, using: false })

    const chip = within(rowOf('Maze')).getByTitle(
      'DC 20 Intelligence (Investigation) or Strength check',
    )
    expect(chip.tagName).toBe('SPAN')
    expect(chip).toHaveTextContent('CheckDC 20')
    await user.click(chip)
    expect(onUse).not.toHaveBeenCalled()
  })

  it("says why the table can't be asked while the game takes no uses, the player's own still rolled", async () => {
    const user = userEvent.setup()
    const sendRolls = jest.fn()
    const { roll } = renderRook({
      using: false,
      actions: {
        useBlocked: 'this device doesn’t send your rolls to the table',
        sendRolls,
      },
    })

    await user.click(
      screen.getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
    )
    expect(
      screen.getByRole('menuitem', { name: 'Ask the table' }),
    ).toBeDisabled()
    expect(itemsOf().slice(0, 2)).toEqual([
      'Ask the table — This device doesn’t send your rolls to the table.',
      'Send my rolls to the table',
    ])
    await user.click(
      screen.getByRole('menuitem', { name: 'Send my rolls to the table' }),
    )
    expect(sendRolls).toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
    )
    await user.click(
      screen.getByRole('menuitem', {
        name: "Roll my Thieves' Tools check (+6)",
      }),
    )
    expect(roll).toHaveBeenCalledTimes(1)
  })

  it('keeps an activity a sheet from an older module says nothing of used in Foundry', () => {
    const sheet = checkingSheet()
    const [fastHands] = sheet.actions[1].actions
    sheet.actions[1].actions[0] = {
      ...fastHands,
      activity: null,
      check: undefined,
      activities: fastHands.activities!.map(activity => ({
        ...activity,
        check: undefined,
        activity: activity.type === 'check' ? null : activity.activity,
      })),
    }
    renderRook({ sheet })

    expect(rowOf('Fast Hands')).toHaveTextContent('Used in Foundry')
    expect(screen.queryByRole('button', { name: /^Fast Hands, / })).toBeNull()
  })

  it('casts a spell through its free casting, saying what that spends, its slots offered by none', async () => {
    const user = userEvent.setup()
    const { onUse } = renderRook()

    await user.click(toggle('Bless'))
    const [free] = within(
      screen.getByRole('list', { name: 'Bless: its other activities' }),
    ).getAllByRole('listitem')
    expect(free).toHaveTextContent('Cast (free casting)1 use')
    expect(free.querySelector('.opacity-60')).toBeNull()
    await user.click(
      within(free).getByRole('button', {
        name: 'Cast Bless (Cast (free casting))',
      }),
    )
    expect(onUse.mock.calls[0][0]).toMatchObject({
      id: 'bless',
      activity: { id: 'bless-free', type: 'utility' },
      forward: { charges: 1, short: false },
    })
  })

  it('dims a free casting with no uses left, saying so', async () => {
    const user = userEvent.setup()
    const sheet = checkingSheet()
    const bless = sheet.actions[0].actions[2]
    const [cast, free] = bless.activities!
    sheet.actions[0].actions[2] = {
      ...bless,
      uses: { value: 0, max: 1, recovery: 'Long Rest' },
      activities: [
        cast,
        {
          ...free,
          forward: { charges: 1, short: true },
          uses: { value: 0, max: 1, recovery: 'Long Rest' },
        },
      ],
    }
    renderRook({ sheet })

    await user.click(toggle('Bless'))
    const [row] = within(
      screen.getByRole('list', { name: 'Bless: its other activities' }),
    ).getAllByRole('listitem')
    expect(row).toHaveTextContent('Cast (free casting)No uses left')
    expect(row.querySelector('.opacity-60')).not.toBeNull()
  })

  it('shows its check in a table too, in its column', async () => {
    const user = userEvent.setup()
    const { onUse } = renderRook({ layout: 'table' })

    const table = screen.getByRole('table', { name: 'Actions' })
    const maze = within(table).getByRole('button', {
      name: 'Maze, DC 20 Intelligence (Investigation) check',
    })
    await user.click(maze)
    expect(onUse).toHaveBeenCalledTimes(1)
    await user.click(
      within(table).getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
    )
    expect(screen.getByRole('menu')).toBeVisible()
  })

  it('says nothing of what an activity that uses another spends where it spends none, or where the sheet can’t count it', () => {
    expect(forwardNote({ charges: 0, short: false })).toBeUndefined()
    expect(forwardNote({ charges: null, short: false })).toBeUndefined()
    expect(forwardNote({ charges: 1, short: false })).toBe('1 use')
  })

  it("leads a spell with how it's cast, its check with no activation of its own beneath it, used as a saving throw's chip is", async () => {
    const user = userEvent.setup()
    const { onUse, roll } = renderRook({ sheet: entangling() })

    const row = rowOf('Entangle')
    // The spell's saving throw, which casts it, on its row; no check of its own there.
    const save = within(row).getByRole('button', {
      name: 'Entangle, STR saving throw DC 18',
    })
    expect(within(row).queryByRole('button', { name: /check$/ })).toBeNull()
    expect(toggle('Entangle')).not.toHaveClass('opacity-60')
    await user.click(save)
    expect(onUse.mock.calls[0][0]).toMatchObject({
      id: 'entangle',
      activity: { id: 'entangle-cast', type: 'save' },
    })
    expect(onUse.mock.calls[0][0]).not.toHaveProperty('consumesSlot')

    await user.click(toggle('Entangle'))
    const [escape] = within(
      screen.getByRole('list', { name: 'Entangle: its other activities' }),
    ).getAllByRole('listitem')
    expect(escape).not.toHaveTextContent('Used in Foundry')
    const chip = within(escape).getByRole('button', {
      name: 'Entangle (Escape Plants Check), DC 18 Strength check',
    })
    expect(chip).toHaveTextContent(/^StrengthDC 18$/)
    expect(chip).not.toHaveAttribute('aria-haspopup')
    await user.click(chip)
    // Another creature makes it: it's used in the game at once, with no menu, and nothing rolled.
    expect(screen.queryByRole('menu')).toBeNull()
    expect(roll).not.toHaveBeenCalled()
    expect(onUse).toHaveBeenCalledTimes(2)
    expect(onUse.mock.calls[1][0]).toMatchObject({
      id: 'entangle',
      activity: { id: 'escape-plants', type: 'check' },
      check: ESCAPE_CHECK,
      consumesSlot: false,
    })
  })

  it('dims a spell with no slots left, but not its check with no activation of its own, which spends none', async () => {
    const user = userEvent.setup()
    const { onUse } = renderRook({ sheet: entangling(0) })

    expect(toggle('Entangle')).toHaveClass('opacity-60')
    expect(toggle('Entangle')).toHaveTextContent('No slots left')
    await user.click(toggle('Entangle'))
    const [escape] = within(
      screen.getByRole('list', { name: 'Entangle: its other activities' }),
    ).getAllByRole('listitem')
    expect(escape.querySelector('.opacity-60')).toBeNull()
    expect(escape).not.toHaveTextContent('No slots left')
    await user.click(
      within(escape).getByRole('button', {
        name: 'Entangle (Escape Plants Check), DC 18 Strength check',
      }),
    )
    expect(onUse.mock.calls[0][0]).toMatchObject({
      activity: { id: 'escape-plants' },
      consumesSlot: false,
    })
  })
})

describe('action-entry: formulas with what Foundry does with their dice', () => {
  afterEach(cleanup)

  /** A Great Weapon Fighting greatsword, with Divine Favor's d8, and a cleric's radiant formula. */
  const actions = [
    sheetAction({
      id: 'greatsword',
      name: 'Greatsword',
      type: 'weapon',
      attackId: 'greatswordAttack',
      toHit: 7,
      damage: [
        { formula: '2d6r<=2 + 7 + 1d8', type: 'Slashing', healing: false },
      ],
    }),
    sheetAction({
      id: 'flail',
      name: 'Thundering Flail',
      type: 'weapon',
      attackId: 'flailAttack',
      toHit: 6,
      damage: [{ formula: '1d6x + 2', type: 'Thunder', healing: false }],
    }),
    sheetAction({
      id: 'symbol',
      name: 'Holy Symbol',
      rollFormula: { formula: '2d6[radiant]', name: 'Radiance' },
    }),
  ]
  const sheet: CharacterSheet = {
    ...characterSheet(),
    actions: [{ id: 'action', label: 'Actions', actions }],
  }
  const renderTab = (layout?: Layout) => {
    const onRollDamage = jest.fn()
    const onRollFormula = jest.fn()
    render(
      <ActionsTab
        characterId='char-1'
        sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
        onRoll={jest.fn()}
        onRollDamage={onRollDamage}
        onRollFormula={onRollFormula}
        layout={layout}
      />,
    )
    return { onRollDamage, onRollFormula }
  }

  it.each<[string, Layout | undefined]>([
    ['a list', undefined],
    ['a table', 'table'],
  ])(
    'rolls damage whose dice are rerolled as a chip of its own, in %s',
    async (_name, layout) => {
      const user = userEvent.setup()
      const { onRollDamage } = renderTab(layout)

      const chip = screen.getByRole('button', {
        name: 'Greatsword damage, 2d6r<=2 + 7 + 1d8',
      })
      expect(chip).toBeEnabled()
      await user.click(chip)
      expect(onRollDamage).toHaveBeenCalledWith({
        label: 'Greatsword damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
              { sign: 1, flat: 7 },
              { sign: 1, count: 1, sides: 8 },
            ],
            type: 'Slashing',
          },
        ],
        healing: false,
        critical: false,
        source: { item: 'greatsword', activity: 'greatswordAttack' },
      })
    },
  )

  it('offers its highest, but not for dice that explode', () => {
    renderTab()

    fireEvent.contextMenu(
      screen.getByRole('button', {
        name: 'Greatsword damage, 2d6r<=2 + 7 + 1d8',
      }),
    )
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll critical damage', 'Roll maximum damage', 'Modify damage…'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    cleanup()

    renderTab()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Thundering Flail damage, 1d6x + 2' }),
    )
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll critical damage', 'Modify damage…'])
  })

  it.each<[string, DamagePreview, string[] | undefined]>([
    [
      'the game rolls itself: no menu',
      {
        critical: false,
        plannable: false,
        rolls: [{ formula: '1d6x + 1d3', type: 'Thunder', dice: [] }],
      },
      undefined,
    ],
    [
      'the app can’t read against its dice: no maximum',
      {
        critical: false,
        plannable: true,
        rolls: [
          {
            formula: '1d6x + 120',
            type: 'Thunder',
            dice: [{ faces: 6, number: 1 }],
          },
        ],
      },
      ['Modify damage…'],
    ],
  ])(
    'offers no maximum for damage due whose dice explode, which %s',
    (_, damage, items) => {
      render(
        <ActionsTab
          characterId='char-1'
          sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          // Changed on purpose (round 0.36.0 §12): `TableDamage` says whether damage goes on its
          // own and recharges are taken, neither here.
          tableDamage={{
            modifies: true,
            dueFor: () => ({ use: 'req-1', damage }),
            sendsAlone: false,
            recharges: false,
          }}
        />,
      )

      fireEvent.contextMenu(
        screen.getByRole('button', {
          name: 'Thundering Flail damage, 1d6x + 2',
        }),
      )
      const menu = screen.queryByRole('menu')
      if (items) {
        expect(
          within(menu as HTMLElement)
            .getAllByRole('menuitem')
            .map(item => item.textContent),
        ).toEqual(items)
      } else {
        expect(menu).toBeNull()
      }
    },
  )

  it('rolls a formula with a flavor', async () => {
    const user = userEvent.setup()
    const { onRollFormula } = renderTab()

    await user.click(
      screen.getByRole('button', {
        name: 'Roll Holy Symbol: Radiance, 2d6[radiant]',
      }),
    )
    expect(onRollFormula).toHaveBeenCalledWith({
      label: 'Holy Symbol: Radiance',
      terms: [{ sign: 1, count: 2, sides: 6 }],
    })
  })
})

/** What the game does with damage: here, it sends it on its own, unless given otherwise. */
const tableOf = (fields: Partial<TableDamage> = {}): TableDamage => ({
  modifies: true,
  dueFor: jest.fn(),
  sendsAlone: true,
  recharges: false,
  ...fields,
})

/** A chip, by its accessible name. */
const chip = (name: string) => screen.getByRole('button', { name })

/** The Draconic Spirit's Actions tab, its spells and features used in the game. */
const renderSpirit = ({
  table = tableOf(),
  sheet = spiritSheet(),
  layout,
  locked = false,
}: {
  table?: TableDamage
  sheet?: CharacterSheet
  layout?: Layout
  locked?: boolean
} = {}) => {
  const onRollDamage = jest.fn()
  const onRollFormula = jest.fn()
  const onUse = jest.fn()
  const tab = (shown: TableDamage) => (
    <RollsLocked value={locked}>
      <ActionsTab
        characterId='spirit'
        sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
        onRoll={jest.fn()}
        onRollDamage={onRollDamage}
        onRollFormula={onRollFormula}
        onUse={onUse}
        tableDamage={shown}
        layout={layout}
      />
    </RollsLocked>
  )
  const { rerender } = render(tab(table))
  return {
    onRollDamage,
    onRollFormula,
    onUse,
    rerender: (next: TableDamage) => rerender(tab(next)),
  }
}

/** The ways a chip's menu offers, as named. */
const menuOf = (name: string) => {
  fireEvent.contextMenu(chip(name))
  const menu = screen.queryByRole('menu')
  const items = menu
    ? within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    : undefined
  if (menu) fireEvent.keyDown(menu, { key: 'Escape' })
  return items
}

describe('action-entry: damage on its own and recharges, from module 0.36.0', () => {
  afterEach(cleanup)

  it('rolls a save activity’s damage on its own, rather than using it, its save chip still using it', async () => {
    const user = userEvent.setup()
    const { onRollDamage, onUse } = renderSpirit()

    await user.click(
      chip('Fire Breath damage, 2d6, goes to the table on its own'),
    )
    expect(onUse).not.toHaveBeenCalled()
    expect(onRollDamage).toHaveBeenCalledTimes(1)
    expect(onRollDamage).toHaveBeenCalledWith({
      label: 'Fire Breath damage',
      critical: false,
      healing: false,
      exact: true,
      perDie: 1,
      parts: [{ type: 'Fire', terms: [{ sign: 1, count: 2, sides: 6 }] }],
      alone: { item: 'fireBreath', activity: 'breathSave', critical: false },
    })

    await user.click(chip('Fire Breath, DEX saving throw DC 14'))
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fireBreath' }),
    )
    expect(onRollDamage).toHaveBeenCalledTimes(1)
  })

  it('uses a save activity from its damage chip while damage doesn’t go on its own, as ever', async () => {
    const user = userEvent.setup()
    const { onRollDamage, onUse } = renderSpirit({
      table: tableOf({ sendsAlone: false }),
    })

    await user.click(chip('Fire Breath damage, 2d6'))
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fireBreath' }),
    )
    expect(onRollDamage).not.toHaveBeenCalled()
  })

  it('rolls a heal activity’s healing on its own', async () => {
    const user = userEvent.setup()
    const { onRollDamage, onUse } = renderSpirit()

    await user.click(
      chip('Second Wind healing, 1d10 + 5, goes to the table on its own'),
    )
    expect(onUse).not.toHaveBeenCalled()
    expect(onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Second Wind healing',
        healing: true,
        alone: { item: 'secondWind', activity: 'windHeal', critical: false },
      }),
    )
  })

  it("rolls an attack's damage on its own as the game's plan, a critical hit's from its menu", async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderSpirit()

    await user.click(
      chip('Longsword damage, 1d8 + 4, goes to the table on its own'),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Longsword damage',
        critical: false,
        parts: [
          {
            type: 'Slashing',
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
        ],
        alone: {
          item: 'longsword',
          activity: 'longswordAttack',
          critical: false,
        },
      }),
    )
    // Never named twice over.
    expect(onRollDamage.mock.lastCall?.[0].label).toBe('Longsword damage')

    fireEvent.contextMenu(
      chip('Longsword damage, 1d8 + 4, goes to the table on its own'),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll critical damage' }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Longsword damage',
        critical: true,
        perDie: 2,
        parts: [
          {
            type: 'Slashing',
            terms: [
              { sign: 1, count: 2, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
        ],
        alone: {
          item: 'longsword',
          activity: 'longswordAttack',
          critical: true,
        },
      }),
    )
  })

  it.each<[string, boolean, string, string[] | undefined]>([
    [
      "an attack's: critical, then the changes",
      true,
      'Longsword damage, 1d8 + 4, goes to the table on its own',
      ['Roll critical damage', 'Roll maximum damage', 'Modify damage…'],
    ],
    [
      "a save's: no critical, which it has none of",
      true,
      'Fire Breath damage, 2d6, goes to the table on its own',
      ['Roll maximum damage', 'Modify damage…'],
    ],
    [
      "a heal's: no critical",
      true,
      'Second Wind healing, 1d10 + 5, goes to the table on its own',
      ['Roll maximum healing', 'Modify healing…'],
    ],
    [
      "an attack's where the game takes no damage changed: critical only",
      false,
      'Longsword damage, 1d8 + 4, goes to the table on its own',
      ['Roll critical damage'],
    ],
    [
      "a save's where the game takes no damage changed: none",
      false,
      'Fire Breath damage, 2d6, goes to the table on its own',
      undefined,
    ],
  ])('offers in its menu, for %s', (_, modifies, name, items) => {
    renderSpirit({ table: tableOf({ modifies }) })

    expect(menuOf(name)).toEqual(items)
  })

  it('asks the kind first from the chip, where the plan offers a choice, and sends the one chosen', async () => {
    const user = userEvent.setup()
    const { onRollDamage } = renderSpirit()
    const orb = chip('Chromatic Orb damage, 3d8, goes to the table on its own')

    await user.click(orb)
    expect(onRollDamage).not.toHaveBeenCalled()
    const menu = screen.getByRole('menu', { name: 'Chromatic Orb 3d8' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll Fire damage', 'Roll Cold damage'])
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Roll Cold damage' }),
    )

    expect(onRollDamage).toHaveBeenCalledTimes(1)
    expect(onRollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Chromatic Orb damage',
        types: ['cold'],
        parts: [{ type: 'Cold', terms: [{ sign: 1, count: 3, sides: 8 }] }],
        alone: { item: 'orb', activity: 'orbAttack', critical: false },
      }),
    )

    // A critical hit's from its menu, then its kind, said so.
    fireEvent.contextMenu(orb)
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll critical damage' }),
    )
    const kinds = screen.getByRole('menu', {
      name: 'Chromatic Orb 3d8 · Critical hit',
    })
    await user.click(
      within(kinds).getByRole('menuitem', {
        name: 'Roll critical Fire damage',
      }),
    )
    expect(onRollDamage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        critical: true,
        types: ['fire'],
        parts: [{ type: 'Fire', terms: [{ sign: 1, count: 6, sides: 8 }] }],
        alone: { item: 'orb', activity: 'orbAttack', critical: true },
      }),
    )
  })

  it('says only where it will go on its own, never with its damage due, which goes on its attack', async () => {
    const user = userEvent.setup()
    const due = {
      use: 'req-1',
      damage: longsword().tableDamage!.normal,
    }
    const { onRollDamage, rerender } = renderSpirit({
      table: tableOf({ sendsAlone: false }),
    })
    const look = chip('Longsword damage, 1d8 + 4').className

    rerender(tableOf({ sendsAlone: true }))
    // Its look the same, whichever way it goes: its name says so.
    expect(
      chip('Longsword damage, 1d8 + 4, goes to the table on its own'),
    ).toHaveProperty('className', look)

    rerender(
      tableOf({
        sendsAlone: true,
        dueFor: source => (source.item === 'longsword' ? due : undefined),
      }),
    )
    const longswordChip = chip('Longsword damage, 1d8 + 4')
    expect(
      screen.getByRole('button', {
        name: 'Fire Breath damage, 2d6, goes to the table on its own',
      }),
    ).toBeInTheDocument()
    await user.click(longswordChip)
    // For the pane to roll on its attack, as it's due: no way of its own.
    expect(onRollDamage).toHaveBeenCalledWith({
      label: 'Longsword damage',
      parts: [
        {
          type: 'Slashing',
          terms: [
            { sign: 1, count: 1, sides: 8 },
            { sign: 1, flat: 4 },
          ],
        },
      ],
      healing: false,
      critical: false,
      source: { item: 'longsword', activity: 'longswordAttack' },
    })
  })

  it('rolls a chip the game plans nothing of as ever, and says nothing of going on its own', async () => {
    const user = userEvent.setup()
    const { onRollDamage, onUse } = renderSpirit({
      sheet: spiritSheet([
        longsword({ tableDamage: null }),
        fireBreath({ tableDamage: null }),
      ]),
    })

    await user.click(chip('Longsword damage, 1d8 + 4'))
    expect(onRollDamage).toHaveBeenCalledWith(
      expect.not.objectContaining({ alone: expect.anything() }),
    )
    // A save activity's damage uses it, as it can't go on its own.
    await user.click(chip('Fire Breath damage, 2d6'))
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fireBreath' }),
    )
  })

  it('goes on its own only where there is a plan', () => {
    const { result } = renderHook(() =>
      useDamageRolls(jest.fn(), tableOf(), {
        open: jest.fn(),
        modify: jest.fn(),
        damage: jest.fn(),
      }),
    )
    const target: DamageTarget = {
      label: 'Longsword damage',
      parts: [],
      formula: '1d8 + 4',
      alone: { item: 'longsword', activity: 'longswordAttack' },
    }

    expect(result.current.actions.goesAlone(target)).toBe(false)
    expect(
      result.current.actions.goesAlone({
        ...target,
        alone: { ...target.alone!, plan: longsword().tableDamage! },
      }),
    ).toBe(true)
  })

  it('says what recharges its uses last on the row, as dnd5e’s stat block says it', () => {
    renderSpirit()

    expect(rowOf('Fire Breath')).toHaveTextContent(
      '30 ft cone · Fire · Recharge 5–6',
    )
    expect(rowOf('Lightning Breath')).toHaveTextContent(
      'Lightning · Recharge 6',
    )
    expect(rowOf('Fire Breath')).not.toHaveTextContent('[5+]')
  })

  it('opens to its uses as dnd5e says its recharge', async () => {
    const user = userEvent.setup()
    renderSpirit()

    const row = rowOf('Fire Breath')
    await user.click(toggle('Fire Breath'))
    expect(row).toHaveTextContent('0 of 1 left, Recharge 5–6')
  })

  it('puts the Recharge chip first, left of the uses count, which shows with it in a narrow list', () => {
    renderSpirit({ table: tableOf({ recharges: true }) })

    const recharge = within(rowOf('Fire Breath')).getByRole('button', {
      name: 'Roll Fire Breath’s recharge: 5 or more on a d6',
    })
    const count = within(rowOf('Fire Breath')).getByText('0 of 1 uses left')
    const uses = count.closest('[data-uses]') as HTMLElement
    expect(recharge.compareDocumentPosition(uses)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    // Before every other chip of the row.
    const chips = recharge.parentElement as HTMLElement
    expect(chips.querySelector('button')).toBe(recharge)
    expect(uses).not.toHaveClass('hidden')
  })

  it('shows the Recharge chip with uses spent, not at full, and not where the game takes no recharge from here', () => {
    const { rerender } = renderSpirit({
      table: tableOf({ recharges: true }),
      sheet: spiritSheet([
        fireBreath({
          uses: { ...fireBreath().uses!, value: 1, max: 1 },
        }),
        lightningBreath(),
      ]),
    })
    expect(
      within(rowOf('Fire Breath')).queryByRole('button', { name: /recharge/ }),
    ).toBeNull()
    // One of two left: something spent.
    expect(
      within(rowOf('Lightning Breath')).getByRole('button', {
        name: 'Roll Lightning Breath’s recharge: a 6 on a d6',
      }),
    ).toBeInTheDocument()

    rerender(tableOf({ recharges: false }))
    expect(screen.queryByRole('button', { name: /recharge/ })).toBeNull()
    // Its uses fold away in a narrow list again, as a save's do.
    expect(
      within(rowOf('Lightning Breath'))
        .getByText('1 of 2 uses left')
        .closest('[data-uses]'),
    ).toHaveClass('hidden', '@md:inline')
  })

  it('wraps a row’s chips under its name where both don’t fit, its name at least 8.5 rem', () => {
    renderSpirit({ table: tableOf({ recharges: true }) })

    const name = toggle('Fire Breath')
    expect(name).toHaveClass('min-w-[8.5rem]', 'flex-1')
    expect(name).not.toHaveClass('min-w-0')
    expect(name.parentElement).toHaveClass(
      'flex',
      'flex-wrap',
      'items-center',
      'gap-x-2',
      'gap-y-0',
      'rounded-xl',
      'py-1.5',
      'pr-1.5',
      'pl-1',
    )
    const chips = within(rowOf('Fire Breath')).getByRole('button', {
      name: /recharge/,
    }).parentElement
    expect(chips).toHaveClass(
      'ml-auto',
      'flex',
      'max-w-full',
      'shrink-0',
      'flex-wrap',
      'items-center',
      'justify-end',
      'gap-1',
    )
    expect(chips?.parentElement).toBe(name.parentElement)
  })

  it("disables an activity's own formula and own check while the pane's rolls are locked", () => {
    const sheet = checkingSheet()
    render(
      <RollsLocked value>
        <ActionsTab
          characterId='char-rook'
          sheet={toTableSheet(
            {
              ...sheet,
              actions: [
                ...sheet.actions,
                {
                  id: 'other',
                  label: 'Other',
                  actions: [
                    sheetAction({
                      id: 'symbol',
                      name: 'Holy Symbol',
                      rollFormula: { formula: '2d6', name: 'Radiance' },
                    }),
                  ],
                },
              ],
            },
            'https://my-game.forge-vtt.com',
          )}
          onRoll={jest.fn()}
          onRollDamage={jest.fn()}
          onRollFormula={jest.fn()}
        />
      </RollsLocked>,
    )

    expect(
      screen.getByRole('button', { name: 'Roll Holy Symbol: Radiance, 2d6' }),
    ).toBeDisabled()
    expect(
      within(rowOf("Thieves' Tools")).getByRole('button', {
        name: "Thieves' Tools, DC 15 Dexterity (Thieves' Tools) check",
      }),
    ).toBeDisabled()
  })

  it('disables the Recharge chip while the pane’s rolls are locked', () => {
    renderSpirit({ table: tableOf({ recharges: true }), locked: true })

    expect(
      screen.getByRole('button', {
        name: 'Roll Fire Breath’s recharge: 5 or more on a d6',
      }),
    ).toBeDisabled()
  })
})

describe('an attack’s chips in a pane whose rolls are locked (module 0.36.0)', () => {
  it('disables its attack and damage, which roll nothing, its row still opening', async () => {
    const user = userEvent.setup()
    const onRoll = jest.fn()
    const onRollDamage = jest.fn()
    render(
      <RollsLocked value>
        <ActionsTab
          characterId='char-1'
          sheet={toTableSheet(
            characterSheet({
              actions: [
                {
                  id: 'action',
                  label: 'Actions',
                  actions: [
                    sheetAction({
                      id: 'bite',
                      name: 'Bite',
                      type: 'weapon',
                      toHit: 4,
                      damage: [
                        {
                          formula: '1d8 + 3',
                          type: 'Piercing',
                          healing: false,
                        },
                      ],
                    }),
                  ],
                },
              ],
            }),
            'https://my-game.forge-vtt.com',
          )}
          onRoll={onRoll}
          onRollDamage={onRollDamage}
        />
      </RollsLocked>,
    )
    const attack = screen.getByRole('button', { name: 'Bite attack, +4' })
    const damage = screen.getByRole('button', { name: /^Bite damage/ })
    for (const chip of [attack, damage]) {
      expect(chip).toBeDisabled()
      expect(chip).toHaveClass('cursor-not-allowed', 'opacity-50')
      fireEvent.click(chip)
      fireEvent.contextMenu(chip, { button: 2 })
    }
    expect(onRoll).not.toHaveBeenCalled()
    expect(onRollDamage).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(
      screen.getByRole('button', { name: /^Bite/, expanded: false }),
    )
    expect(
      screen.getByRole('button', { name: /^Bite/, expanded: true }),
    ).toBeInTheDocument()
  })
})
