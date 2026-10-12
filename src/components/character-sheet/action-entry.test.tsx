/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardNote } from './action-entry'
import { ActionsTab } from './actions-tab'
import {
  DescriptionLinks,
  sheetTools,
  type DescriptionActions,
} from './description-actions'
import {
  checkingSheet,
  MAZE_CHECK,
  sheetAction,
  sheetSpell,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type {
  CharacterSheet,
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
}: {
  sheet?: CharacterSheet
  using?: boolean
  actions?: Partial<DescriptionActions>
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
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
    const { onUse } = renderRook()

    await user.click(screen.getByRole('button', { name: 'Table' }))
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
