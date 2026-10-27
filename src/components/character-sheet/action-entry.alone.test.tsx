/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { ALONE_SPEND_KEY } from './use-picker'
import { ALONE_KEY } from '@/hooks/use-table-rolls'
import { chromaticOrb } from '@/mocks/alone'
import {
  battleaxeAction,
  burningHandsAction,
  characterSheet,
  hellishRebukeAction,
  longbowAction,
  pactSpells,
  potionAction,
  sheetAction,
  sheetSpell,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { RollFeature, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  DamagePreview,
  SheetAction,
} from '@/types/sending-stone'

/*
 * Damage on its own's choices from a chip, from module 0.41.0 (round 0.41.0 §2.3.7-§2.3.10): the
 * picker first, then the kind menu from the plan picked, then the roll with the picks; through
 * Thorin's whole pane, as the pane holds the picker.
 */

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** What the game takes from the player, damage on its own among it. */
const KINDS: RollKind[] = ['attack', 'damage', 'use', 'itemDamage']

/** Chromatic Orb's dice, 3d8 or, at 2nd level, 4d8, fire or cold. */
const orbPlan = (count: number, critical = false): DamagePreview => ({
  critical,
  plannable: true,
  rolls: [
    {
      formula: `${count}d8`,
      type: null,
      types: [
        { key: 'fire', label: 'Fire' },
        { key: 'cold', label: 'Cold' },
      ],
      dice: [{ faces: 8, number: count }],
      perDie: critical ? 2 : 1,
    },
  ],
})

/** Chromatic Orb, as module 0.41.0 sends it: a d8 more at 2nd level, spending a slot. */
const orb = () =>
  chromaticOrb({
    tableDamage: {
      normal: orbPlan(3),
      critical: orbPlan(6, true),
      choices: [{ level: 2, normal: orbPlan(4), critical: orbPlan(8, true) }],
      spends: ['slot'],
    },
  })

/** A Longsword: nothing to choose, nothing spent. */
const longsword = () =>
  sheetAction({
    id: 'longsword',
    name: 'Longsword',
    type: 'weapon',
    toHit: 7,
    attackId: 'longswordAttack',
    damage: [{ formula: '1d8 + 4', type: 'Slashing', healing: false }],
    tableDamage: {
      normal: {
        critical: false,
        plannable: true,
        rolls: [
          {
            formula: '1d8 + 4',
            type: 'Slashing',
            dice: [{ faces: 8, number: 1 }],
          },
        ],
      },
      critical: null,
      choices: [],
      spends: [],
    },
  })

/**
 * A Longbow with 70 ammunitions, more plans than the game sends a row: it sends it none, as an
 * older module would, so it rolls as before (round 0.41.0 §0.7.15).
 */
const quiverful = () => {
  const bow = longbowAction()
  const { normal, critical } = bow.tableDamage!
  return longbowAction({
    id: 'greatbow',
    name: 'Greatbow',
    attackId: 'greatbowAttack',
    ammunition: Array.from({ length: 70 }, (_, index) => ({
      id: `arrows${index}`,
      name: `Arrows ${index + 1}`,
      quantity: 10,
    })),
    tableDamage: { normal, critical },
  })
}

/** Thorin, two 1st-level slots and one 2nd-level, Burning Hands and Chromatic Orb among them. */
const thorin = (actions: SheetAction[]): CharacterSheet =>
  characterSheet({
    actions: [{ id: 'action', label: 'Actions', actions }],
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 2, level: 1 },
        spells: [
          sheetSpell({ id: 'hands', name: 'Burning Hands' }),
          sheetSpell({ id: 'orb', name: 'Chromatic Orb' }),
        ],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 1, max: 1, level: 2 },
        spells: [],
      },
    ],
  })

/** Everything posted to the game, in order; each roll it's asked after made as given. */
const answering = (answers: Record<string, Record<string, unknown>> = {}) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = String(url).split('/').at(-1) ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...(answers[id] ?? { status: 'pending' }) }),
    } as Response
  }) as typeof fetch
  return posted
}

/** A die thrown, whatever it came up. */
const die = (faces: number, count = 1) => ({
  faces,
  results: Array.from({ length: count }, () => expect.any(Number)),
})

const renderThorin = ({
  actions = [burningHandsAction(), orb(), longsword(), potionAction()],
  features = ['modifiers', 'aloneChoices'],
  sheet = thorin(actions),
}: {
  actions?: SheetAction[]
  features?: RollFeature[]
  sheet?: CharacterSheet
} = {}) =>
  render(
    <CharacterPane
      characterId='char-1'
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet, GAME)}
      rollsToTable={KINDS}
      rollFeatures={features}
    />,
  )

const showActions = () =>
  userEvent.setup().click(screen.getByRole('tab', { name: /^Actions/ }))

const chip = (name: string) => screen.getByRole('button', { name })

const HANDS = 'Burning Hands damage, 3d6, goes to the table on its own'
const ORB = 'Chromatic Orb damage, 3d8, goes to the table on its own'

describe('components/character-sheet/action-entry, damage on its own’s choices, from module 0.41.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
  })

  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

  it('asks Burning Hands’ level from its chip, then rolls and sends it at that level, spending the slot', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin()
    await showActions()

    await user.click(chip(HANDS))
    const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
    expect(posted).toHaveLength(0)
    await user.click(within(picker).getByRole('radio', { name: /^2nd Level/ }))
    await user.click(
      within(picker).getByRole('button', { name: 'Roll damage' }),
    )

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      kind: 'itemDamage',
      item: 'hands',
      activity: 'handsSave',
      slot: 'spell2',
      consume: true,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [die(6, 4)],
    })
    expect(screen.queryByRole('dialog', { name: 'Burning Hands' })).toBeNull()
  })

  it('sends nothing spent with the switch off, as this device last left it for Thorin', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.setItem(`${ALONE_SPEND_KEY}:player:char-1`, 'off')
    const posted = answering()
    renderThorin()
    await showActions()

    await user.click(chip(HANDS))
    expect(screen.getByRole('switch')).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    // The slot it's rolled at, always named: the spell's own, 3d6.
    expect(posted[0]).toMatchObject({ slot: 'spell1', dice: [die(6, 3)] })
    expect(posted[0]).not.toHaveProperty('consume')
  })

  it('asks the kind of Chromatic Orb from the plan picked, named by its dice there, after its level', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin()
    await showActions()

    await user.click(chip(ORB))
    const picker = screen.getByRole('dialog', { name: 'Chromatic Orb' })
    await user.click(within(picker).getByRole('radio', { name: /^2nd Level/ }))
    await user.click(
      within(picker).getByRole('button', { name: 'Roll damage' }),
    )

    const kinds = screen.getByRole('menu', { name: 'Chromatic Orb 4d8' })
    expect(
      within(kinds)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Roll Fire damage', 'Roll Cold damage'])
    expect(posted).toHaveLength(0)
    await user.click(
      within(kinds).getByRole('menuitem', { name: 'Roll Cold damage' }),
    )

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      kind: 'itemDamage',
      item: 'orb',
      activity: 'orbAttack',
      slot: 'spell2',
      consume: true,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [die(8, 4)],
      types: ['cold'],
    })
    // Asked once: the picker isn't opened again after the kind.
    expect(screen.queryByRole('dialog', { name: 'Chromatic Orb' })).toBeNull()
  })

  it('asks the kind the plan picked offers, though the row’s own offers none', async () => {
    const user = userEvent.setup()
    const posted = answering()
    const bow = longbowAction()
    const { normal, critical } = bow.tableDamage!
    // Elemental Arrows add a d4 of fire or cold, as their roller chooses.
    const elemental: DamagePreview = {
      ...normal,
      rolls: [
        ...normal.rolls,
        {
          formula: '1d4',
          type: null,
          types: [
            { key: 'fire', label: 'Fire' },
            { key: 'cold', label: 'Cold' },
          ],
          dice: [{ faces: 4, number: 1 }],
        },
      ],
    }
    renderThorin({
      actions: [
        longbowAction({
          ammunition: [
            { id: 'arrows', name: 'Arrows', quantity: 20 },
            { id: 'elemental', name: 'Elemental Arrows', quantity: 5 },
          ],
          tableDamage: {
            normal,
            critical,
            choices: [{ ammunition: 'elemental', normal: elemental, critical }],
            spends: ['ammunition'],
          },
        }),
      ],
    })
    await showActions()

    await user.click(
      chip('Longbow damage, 1d8 + 2, goes to the table on its own'),
    )
    await user.click(
      screen.getByRole('radio', { name: 'Elemental Arrows, 5 left' }),
    )
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    const kinds = screen.getByRole('menu', { name: 'Longbow 1d8 + 2 + 1d4' })
    await user.click(
      within(kinds).getByRole('menuitem', { name: 'Roll Cold damage' }),
    )

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      ammunition: 'elemental',
      consume: true,
      dice: [die(8), die(4)],
      types: [null, 'cold'],
    })
  })

  it('opens the damage menu on a long-press, then the picker, its choice kept', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin()
    await showActions()

    fireEvent.contextMenu(chip(HANDS))
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll maximum damage' }),
    )
    const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
    await user.click(
      within(picker).getByRole('button', { name: 'Roll damage' }),
    )

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      kind: 'itemDamage',
      slot: 'spell1',
      consume: true,
      modifiers: { maximize: true },
      dice: [{ faces: 6, results: [6, 6, 6] }],
    })
  })

  it('gives focus to the level chosen as the picker opens, and back to the chip as it’s closed, sending nothing', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin()
    await showActions()

    await user.click(chip(HANDS))
    const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
    expect(
      within(picker).getByRole('radio', { name: '1st Level, 2 slots left' }),
    ).toHaveFocus()

    // The browser closes the dialog on Escape, firing close.
    act(() => (picker as HTMLDialogElement).close())
    expect(screen.queryByRole('dialog', { name: 'Burning Hands' })).toBeNull()
    expect(chip(HANDS)).toHaveFocus()
    expect(posted).toHaveLength(0)
  })

  it('rolls a pact-only warlock’s spell at its pact slot’s level, naming it', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin({
      sheet: characterSheet({
        actions: [
          { id: 'action', label: 'Actions', actions: [hellishRebukeAction()] },
        ],
        spells: pactSpells(),
      }),
    })
    await showActions()

    await user.click(
      chip('Hellish Rebuke damage, 2d10, goes to the table on its own'),
    )
    const picker = screen.getByRole('dialog', { name: 'Hellish Rebuke' })
    expect(within(picker).getByRole('switch')).toHaveAccessibleName(
      'Spend a pact slot (3rd level)',
    )
    await user.click(
      within(picker).getByRole('button', { name: 'Roll damage' }),
    )

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      kind: 'itemDamage',
      item: 'rebuke',
      slot: 'pact',
      consume: true,
      dice: [die(10, 4)],
    })
  })

  it('names the slot a spell is rolled at where nothing is asked, as dnd5e would pick it', async () => {
    const user = userEvent.setup()
    const posted = answering()
    const hands = burningHandsAction()
    renderThorin({
      actions: [
        burningHandsAction({
          tableDamage: { ...hands.tableDamage!, choices: [], spends: [] },
        }),
      ],
    })
    await showActions()

    await user.click(chip(HANDS))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ slot: 'spell1', dice: [die(6, 3)] })
    expect(posted[0]).not.toHaveProperty('consume')
  })

  it('rolls a row with nothing to choose or spend at once, as ever', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin()
    await showActions()

    await user.click(
      chip('Longsword damage, 1d8 + 4, goes to the table on its own'),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      kind: 'itemDamage',
      item: 'longsword',
      activity: 'longswordAttack',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [die(8)],
    })
  })

  it('asks a versatile weapon’s mode and a bow’s ammunition, and sends them', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin({ actions: [battleaxeAction(), longbowAction()] })
    await showActions()

    await user.click(
      chip('Battleaxe damage, 1d8 + 3, goes to the table on its own'),
    )
    await user.click(screen.getByRole('radio', { name: 'Two-Handed' }))
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      kind: 'itemDamage',
      item: 'battleaxe',
      attackMode: 'twoHanded',
      dice: [die(10)],
    })
    expect(posted[0]).not.toHaveProperty('consume')

    await user.click(
      chip('Longbow damage, 1d8 + 2, goes to the table on its own'),
    )
    expect(screen.getByRole('switch')).toHaveAccessibleName(
      'Spend an Arrows of Fire',
    )
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    await waitFor(() => expect(posted).toHaveLength(2))
    // With Arrows of Fire, its 1d4 fire too.
    expect(posted[1]).toMatchObject({
      kind: 'itemDamage',
      item: 'longbow',
      ammunition: 'arrowsFire',
      consume: true,
      dice: [die(8), die(4)],
    })
    expect(posted[1]).not.toHaveProperty('attackMode')
  })

  it('rolls a row the game sent no choices for, past its most, as before, naming nothing', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin({ actions: [quiverful()] })
    await showActions()

    await user.click(
      chip('Greatbow damage, 1d8 + 2, goes to the table on its own'),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(posted).toHaveLength(1))
    for (const key of ['slot', 'attackMode', 'ammunition', 'consume']) {
      expect(posted[0]).not.toHaveProperty(key)
    }
    expect(posted[0]).toMatchObject({ dice: [die(8)] })
  })

  it('opens no picker without aloneChoices in the game’s features, rolling the base as before', async () => {
    const user = userEvent.setup()
    const posted = answering()
    renderThorin({ features: ['modifiers'] })
    await showActions()

    await user.click(chip(HANDS))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      kind: 'itemDamage',
      item: 'hands',
      activity: 'handsSave',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [die(6, 3)],
    })

    // And the kind menu is the base plan's.
    await user.click(chip(ORB))
    expect(
      screen.getByRole('menu', { name: 'Chromatic Orb 3d8' }),
    ).toBeInTheDocument()
  })

  it('leaves damage due on an attack made at the table to that attack, opening no picker', async () => {
    const user = userEvent.setup()
    const preview = longsword().tableDamage!.normal
    const posted = answering({
      'req-1': {
        status: 'done',
        visible: true,
        total: 19,
        attack: { critical: false, fumble: false, outcome: 'hit' },
        damage: preview,
      },
    })
    renderThorin()
    await showActions()

    await user.click(
      screen.getByRole('button', { name: 'Longsword attack, +7' }),
    )
    await waitFor(() => expect(posted).toHaveLength(1))
    const due = await screen.findByRole(
      'button',
      { name: 'Longsword damage, 1d8 + 4' },
      { timeout: 3000 },
    )
    await user.click(due)

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(posted).toHaveLength(2))
    expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
  })
})
