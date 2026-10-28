/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Effecting,
  NO_EFFECTS,
  useEffectChoice,
  useEffectControls,
  useSpent,
  type Effects,
} from './effect-controls'
import { EffectsTab } from './effects-tab'
import { fullerSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { EffectOp } from '@/constants/sending-stone'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { CharacterSheet, SheetEffect } from '@/types/sending-stone'

// How long a control waits for the sheet, here 7 seconds, so that the test proves the constant is
// what it waits for.
jest.mock('@/constants/sending-stone', () => ({
  ...jest.requireActual('@/constants/sending-stone'),
  EFFECT_SETTLE: 7000,
}))

const GAME = 'https://my-game.forge-vtt.com'

type Props = {
  on?: boolean
  sheet?: CharacterSheet
  states?: ReadonlyMap<string, TableRollState>
}

/**
 * Thorin's Effects tab in its panel, as a pane draws it, its effects' controls as given: each
 * change sent with a local id of its own, its way as `states` says.
 */
const renderControls = (initial: Props = {}) => {
  let sent = 0
  const send = jest.fn<string, [SheetEffect, EffectOp]>(() => `use-${++sent}`)
  function Pane({
    on = true,
    sheet = fullerSheet(),
    states = new Map(),
  }: Readonly<Props>) {
    const table = toTableSheet(sheet, GAME)
    const value = useEffectControls({
      on,
      character: 'Thorin Oakenshield',
      effects: table.effects,
      states,
      send,
    })
    return (
      <Effecting value={value}>
        <div role='tabpanel' aria-label='Effects' tabIndex={-1}>
          <EffectsTab characterId='char-1' sheet={table} />
        </div>
      </Effecting>
    )
  }
  const rendered = render(<Pane {...initial} />)
  return {
    ...rendered,
    send,
    // Awaited, so that what a confirm's async action began has settled first.
    rerender: async (props: Props) =>
      act(async () => rendered.rerender(<Pane {...props} />)),
  }
}

/** A section of the Effects tab, by its heading. */
const section = (name: string) => screen.getByRole('region', { name })

/** An effect's row in a section: its list item. */
const rowIn = (sectionName: string, name: string) =>
  within(section(sectionName)).getByText(name).closest('li') as HTMLElement

/** What opens a row: its summary. */
const summaryOf = (row: HTMLElement) =>
  row.querySelector(':scope > details > summary') as HTMLElement

/** Thorin's sheet with its effects as given, by section. */
const withEffects = (
  temporary: SheetEffect[],
  inactive: SheetEffect[] = [],
): CharacterSheet =>
  fullerSheet({
    effects: [
      { id: 'temporary', label: 'Temporary Effects', effects: temporary },
      ...(inactive.length > 0
        ? [{ id: 'inactive', label: 'Inactive Effects', effects: inactive }]
        : []),
    ],
  })

/** Thorin's effects as fullerSheet has them, by id. */
const [BLESS, RAGE] = fullerSheet().effects[0].effects
const [SHIELD] = fullerSheet().effects[1].effects

/** Deletes an effect from its dialog, once it has closed, as its confirm has acted. */
const confirmDelete = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(
    within(screen.getByRole('dialog', { name: `Delete ${name}?` })).getByRole(
      'button',
      { name: 'Delete' },
    ),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: `Delete ${name}?` }),
    ).toBeNull(),
  )
}

/** One sent, in the state given. */
const one = (state: TableRollState) =>
  new Map([['use-1', state]]) as ReadonlyMap<string, TableRollState>

describe('components/character-sheet/effect-controls, from module 0.39.0', () => {
  beforeEach(() => {
    // An opened row's description, read from the app, never comes.
    globalThis.fetch = jest.fn(
      () => new Promise<Response>(() => {}),
    ) as typeof fetch
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('offers, inside each opened row, what its `ops` say: Turn off or Turn on, then Delete…, each named with the effect', async () => {
    const user = userEvent.setup()
    renderControls()

    const bless = rowIn('Temporary Effects', 'Bless')
    // Nothing on the row itself, which opens it.
    expect(within(summaryOf(bless)).queryByRole('button')).toBeNull()
    await user.click(summaryOf(bless))
    const buttons = within(bless).getAllByRole('button')
    expect(
      buttons.map(button => [
        button.textContent,
        button.getAttribute('aria-label'),
      ]),
    ).toEqual([
      ['Turn off', 'Turn off Bless'],
      ['Delete…', 'Delete Bless'],
    ])
    for (const button of buttons) {
      expect(button.closest('summary')).toBeNull()
      // 32 pixels tall at least, as End's own isn't.
      expect(button).toHaveClass('min-h-8')
    }
    expect(buttons[0].parentElement).toHaveClass('flex', 'flex-wrap', 'gap-2')
    expect(buttons[1]).toHaveClass('text-danger')
    expect(buttons[1]).toHaveAttribute('aria-haspopup', 'dialog')

    // Rage, on its feature, with no text of its own: it opens all the same, to Turn off alone.
    const rage = rowIn('Temporary Effects', 'Rage')
    await user.click(summaryOf(rage))
    expect(
      within(rage)
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['Turn off'])

    // Shield of Faith, turned off from the app: Turn on, and Delete….
    const shield = rowIn('Inactive Effects', 'Shield of Faith')
    await user.click(summaryOf(shield))
    expect(
      within(shield)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['Turn on Shield of Faith', 'Delete Shield of Faith'])
  })

  it('offers none while the pane doesn’t, nor where the sheet gives no `ops`, as from an older module; nor on a condition', async () => {
    const { rerender } = renderControls({ on: false })
    // Rage, with no text, has nothing to open to.
    expect(summaryOf(rowIn('Temporary Effects', 'Rage'))).toBeNull()
    expect(screen.queryByRole('button', { name: /^Turn|^Delete/ })).toBeNull()

    // As an older module sends them: with no `ops`.
    await rerender({
      sheet: withEffects([
        { ...BLESS, ops: undefined },
        { ...RAGE, ops: undefined },
      ]),
    })
    expect(summaryOf(rowIn('Temporary Effects', 'Rage'))).toBeNull()
    await userEvent
      .setup()
      .click(summaryOf(rowIn('Temporary Effects', 'Bless')))
    expect(
      within(rowIn('Temporary Effects', 'Bless')).getByText('Loading…'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Turn|^Delete/ })).toBeNull()

    // The conditions are no effects of the player's to change.
    await rerender({})
    expect(
      within(section('Conditions')).queryAllByRole('button', {
        name: /^Turn|^Delete/,
      }),
    ).toEqual([])
  })

  it('sends Turn off at once, then waits, the button pressed turning, until the sheet agrees; the moved row open in Inactive, its summary focused', async () => {
    const user = userEvent.setup()
    const { send, rerender } = renderControls()
    const bless = rowIn('Temporary Effects', 'Bless')
    await user.click(summaryOf(bless))
    const off = within(bless).getByRole('button', { name: 'Turn off Bless' })
    await user.click(off)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blessed', name: 'Bless' }),
      'disable',
    )

    await rerender({ states: one({ status: 'sending' }) })
    expect(off).toBeDisabled()
    expect(
      off.querySelector(String.raw`svg.motion-safe\:animate-spin`),
    ).not.toBeNull()
    const remove = within(bless).getByRole('button', { name: 'Delete Bless' })
    expect(remove).toBeDisabled()
    // Only the one pressed turns.
    expect(
      remove.querySelector(String.raw`svg.motion-safe\:animate-spin`),
    ).toBeNull()
    // Pressed again, nothing more is sent.
    fireEvent.click(off)
    expect(send).toHaveBeenCalledTimes(1)

    // Made, but the sheet the page holds doesn't say so yet.
    const made = one({
      status: 'done',
      changed: { id: 'blessed', disabled: true, deleted: false },
    })
    await rerender({ states: made })
    expect(off).toBeDisabled()

    // The sheet comes: Bless off, under Inactive, open there, its summary taking focus, its own
    // Turn on a Tab away.
    await rerender({
      states: made,
      sheet: withEffects(
        [RAGE],
        [{ ...BLESS, disabled: true, ops: ['enable', 'delete'] }, SHIELD],
      ),
    })
    const moved = rowIn('Inactive Effects', 'Bless')
    expect(moved.querySelector('details')).toHaveAttribute('open')
    expect(summaryOf(moved)).toHaveFocus()
    const on = within(moved).getByRole('button', { name: 'Turn on Bless' })
    expect(on).toBeEnabled()
    await user.tab()
    expect(on).toHaveFocus()
  })

  it('stops waiting once the sheet should have come, after EFFECT_SETTLE, whatever it says', async () => {
    const { rerender } = renderControls()
    await userEvent
      .setup()
      .click(summaryOf(rowIn('Temporary Effects', 'Bless')))
    // From the press on, the page's clock is the test's.
    jest.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off Bless' }))
    await rerender({
      states: one({
        status: 'done',
        changed: { id: 'blessed', disabled: true, deleted: false },
      }),
    })
    const off = screen.getByRole('button', { name: 'Turn off Bless' })
    act(() => jest.advanceTimersByTime(6999))
    expect(off).toBeDisabled()
    act(() => jest.advanceTimersByTime(1))
    expect(off).toBeEnabled()
  })

  it.each([
    ['failed', { status: 'failed', reason: 'gone' }],
    ['refused', { status: 'refused', reason: 'moving' }],
    ['lost', { status: 'lost' }],
  ] as [string, TableRollState][])(
    'never waits once it %s, so it can be tried again',
    async (_name, state) => {
      const user = userEvent.setup()
      const { rerender } = renderControls()
      await user.click(summaryOf(rowIn('Temporary Effects', 'Bless')))
      await user.click(screen.getByRole('button', { name: 'Turn off Bless' }))
      await rerender({ states: one(state) })
      expect(
        screen.getByRole('button', { name: 'Turn off Bless' }),
      ).toBeEnabled()
    },
  )

  it('asks before deleting, in the danger dialog, Keep sending nothing', async () => {
    const user = userEvent.setup()
    const { send } = renderControls()
    const bless = rowIn('Temporary Effects', 'Bless')
    await user.click(summaryOf(bless))
    await user.click(
      within(bless).getByRole('button', { name: 'Delete Bless' }),
    )

    const asked = screen.getByRole('dialog', { name: 'Delete Bless?' })
    expect(asked).toHaveTextContent(
      'It’s removed from Thorin Oakenshield in Foundry, and can’t be undone.',
    )
    // The row's own, outside what opens.
    expect(asked.closest('details')).toBeNull()
    expect(asked.closest('li')).toBe(bless)
    expect(within(asked).getByRole('button', { name: 'Delete' })).toHaveClass(
      'bg-danger',
    )
    await user.click(within(asked).getByRole('button', { name: 'Keep' }))
    expect(screen.queryByRole('dialog', { name: 'Delete Bless?' })).toBeNull()
    expect(send).not.toHaveBeenCalled()

    await user.click(
      within(bless).getByRole('button', { name: 'Delete Bless' }),
    )
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete Bless?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blessed' }),
      'delete',
    )
  })

  it('offers Turn off or Turn on, then Delete…, in a closed row’s menu, whose Delete… opens the dialog, Delete sending one delete', async () => {
    const user = userEvent.setup()
    const { send } = renderControls()
    const shield = rowIn('Inactive Effects', 'Shield of Faith')
    expect(shield.querySelector('details')).not.toHaveAttribute('open')

    fireEvent.contextMenu(summaryOf(shield), { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Shield of Faith' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(({ textContent }) => textContent),
    ).toEqual(['Turn on', 'Delete…'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))

    const asked = screen.getByRole('dialog', {
      name: 'Delete Shield of Faith?',
    })
    // The row stays closed: the dialog is the row's, outside what opens.
    expect(shield.querySelector('details')).not.toHaveAttribute('open')
    await user.click(within(asked).getByRole('button', { name: 'Delete' }))
    expect(send.mock.calls.map(([effect, op]) => [effect.id, op])).toEqual([
      ['shieldOfFaith', 'delete'],
    ])

    // Turn off from Bless's menu sends at once; while it waits, the menu says why it can't.
    fireEvent.contextMenu(summaryOf(rowIn('Temporary Effects', 'Bless')), {
      button: 2,
    })
    await user.click(
      within(screen.getByRole('menu', { name: 'Bless' })).getByRole(
        'menuitem',
        { name: 'Turn off' },
      ),
    )
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'blessed' }),
      'disable',
    )
  })

  it('says in the menu that one on its way is on its way already', async () => {
    const user = userEvent.setup()
    const { rerender } = renderControls()
    await user.click(summaryOf(rowIn('Temporary Effects', 'Bless')))
    await user.click(screen.getByRole('button', { name: 'Turn off Bless' }))
    await rerender({ states: one({ status: 'rolling' }) })
    fireEvent.contextMenu(summaryOf(rowIn('Temporary Effects', 'Bless')), {
      button: 2,
    })
    const menu = screen.getByRole('menu', { name: 'Bless' })
    for (const name of ['Turn off', 'Delete…']) {
      const item = within(menu).getByRole('menuitem', { name })
      expect(item).toBeDisabled()
      expect(item).toHaveAccessibleDescription('It’s on its way already')
    }
  })

  it.each([
    ['the next row’s summary', 'Bless', 'Rage'],
    ['else the previous one’s', 'Rage', 'Bless'],
  ])(
    'gives focus, once a deleted effect has gone, to %s',
    async (_where, deleted, left) => {
      const user = userEvent.setup()
      // Both may be deleted here.
      const both = [
        BLESS,
        { ...RAGE, ops: ['disable', 'delete'] as EffectOp[] },
      ]
      const { rerender } = renderControls({
        sheet: withEffects(both, [SHIELD]),
      })
      const row = rowIn('Temporary Effects', deleted)
      await user.click(summaryOf(row))
      await user.click(
        within(row).getByRole('button', { name: `Delete ${deleted}` }),
      )
      await confirmDelete(user, deleted)
      const gone = one({
        status: 'done',
        changed: {
          id: both.find(({ name }) => name === deleted)!.id,
          disabled: null,
          deleted: true,
        },
      })
      // Made, the sheet not yet come: the row's still there.
      await rerender({ sheet: withEffects(both, [SHIELD]), states: gone })
      expect(rowIn('Temporary Effects', deleted)).toBeInTheDocument()
      await rerender({
        sheet: withEffects(
          both.filter(({ name }) => name === left),
          [SHIELD],
        ),
        states: gone,
      })
      expect(
        within(section('Temporary Effects')).queryByText(deleted),
      ).toBeNull()
      expect(summaryOf(rowIn('Temporary Effects', left))).toHaveFocus()
    },
  )

  it('gives focus to the next row’s summary, not the previous one’s, where a deleted effect had both', async () => {
    const user = userEvent.setup()
    // Three that may be deleted, Rage between the other two.
    const three = [
      BLESS,
      { ...RAGE, ops: ['disable', 'delete'] as EffectOp[] },
      { ...BLESS, id: 'heroism', name: 'Heroism', source: 'Heroism' },
    ]
    const { rerender } = renderControls({ sheet: withEffects(three, [SHIELD]) })
    const rage = rowIn('Temporary Effects', 'Rage')
    await user.click(summaryOf(rage))
    await user.click(within(rage).getByRole('button', { name: 'Delete Rage' }))
    await confirmDelete(user, 'Rage')
    const gone = one({
      status: 'done',
      changed: { id: RAGE.id, disabled: null, deleted: true },
    })
    await rerender({ sheet: withEffects(three, [SHIELD]), states: gone })
    await rerender({
      sheet: withEffects(
        three.filter(({ name }) => name !== 'Rage'),
        [SHIELD],
      ),
      states: gone,
    })
    expect(within(section('Temporary Effects')).queryByText('Rage')).toBeNull()
    expect(summaryOf(rowIn('Temporary Effects', 'Heroism'))).toHaveFocus()
  })

  it('gives focus to the tab’s panel once the last row of its section is deleted', async () => {
    const user = userEvent.setup()
    const { rerender } = renderControls()
    const shield = rowIn('Inactive Effects', 'Shield of Faith')
    await user.click(summaryOf(shield))
    await user.click(
      within(shield).getByRole('button', { name: 'Delete Shield of Faith' }),
    )
    await confirmDelete(user, 'Shield of Faith')
    const gone = one({
      status: 'done',
      changed: { id: 'shieldOfFaith', disabled: null, deleted: true },
    })
    await rerender({ states: gone, sheet: withEffects([BLESS, RAGE]) })
    expect(
      screen.queryByRole('region', { name: 'Inactive Effects' }),
    ).toBeNull()
    expect(screen.getByRole('tabpanel', { name: 'Effects' })).toHaveFocus()
  })

  it('takes no focus from where the player has gone since', async () => {
    const user = userEvent.setup()
    const { rerender } = renderControls()
    const bless = rowIn('Temporary Effects', 'Bless')
    await user.click(summaryOf(bless))
    await user.click(
      within(bless).getByRole('button', { name: 'Turn off Bless' }),
    )
    // Elsewhere meanwhile: Rage's row.
    const rage = summaryOf(rowIn('Temporary Effects', 'Rage'))
    rage.focus()
    const made = one({
      status: 'done',
      changed: { id: 'blessed', disabled: true, deleted: false },
    })
    await rerender({
      states: made,
      sheet: withEffects(
        [RAGE],
        [{ ...BLESS, disabled: true, ops: ['enable', 'delete'] }, SHIELD],
      ),
    })
    expect(rage).toHaveFocus()
  })

  it('takes no focus from where the player has gone since a Delete either', async () => {
    const user = userEvent.setup()
    const both = [BLESS, { ...RAGE, ops: ['disable', 'delete'] as EffectOp[] }]
    const { rerender } = renderControls({ sheet: withEffects(both, [SHIELD]) })
    const bless = rowIn('Temporary Effects', 'Bless')
    await user.click(summaryOf(bless))
    await user.click(
      within(bless).getByRole('button', { name: 'Delete Bless' }),
    )
    await confirmDelete(user, 'Bless')
    const gone = one({
      status: 'done',
      changed: { id: BLESS.id, disabled: null, deleted: true },
    })
    // Made, the sheet not yet come; elsewhere meanwhile: Shield of Faith's row.
    await rerender({ sheet: withEffects(both, [SHIELD]), states: gone })
    const shield = summaryOf(rowIn('Inactive Effects', 'Shield of Faith'))
    shield.focus()
    await rerender({
      sheet: withEffects(
        both.filter(({ name }) => name !== 'Bless'),
        [SHIELD],
      ),
      states: gone,
    })
    expect(within(section('Temporary Effects')).queryByText('Bless')).toBeNull()
    expect(shield).toHaveFocus()
  })

  it('sends one change of an effect at a time, whatever asks for another while it waits', async () => {
    const user = userEvent.setup()
    let sent = 0
    const send = jest.fn<string, [SheetEffect, EffectOp]>(() => `use-${++sent}`)
    /** Asks for Bless's Turn off from a button that, unlike the row's, never waits. */
    function Asker() {
      const { choice } = useEffectChoice(BLESS)
      return (
        <button type='button' onClick={() => choice?.choose('disable')}>
          Ask
        </button>
      )
    }
    function Pane({
      states = new Map(),
    }: Readonly<{ states?: ReadonlyMap<string, TableRollState> }>) {
      const value = useEffectControls({
        on: true,
        character: 'Thorin Oakenshield',
        effects: toTableSheet(fullerSheet(), GAME).effects,
        states,
        send,
      })
      return (
        <Effecting value={value}>
          <Asker />
        </Effecting>
      )
    }
    const { rerender } = render(<Pane />)
    const ask = screen.getByRole('button', { name: 'Ask' })
    await user.click(ask)
    await user.click(ask)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: BLESS.id }),
      'disable',
    )
    // Refused, it may be tried again.
    await act(async () =>
      rerender(<Pane states={one({ status: 'refused', reason: 'moving' })} />),
    )
    await user.click(ask)
    expect(send).toHaveBeenCalledTimes(2)
  })
})

describe('components/character-sheet/effect-controls, the effects a die offered spent, from module 0.42.1', () => {
  /** What the controls give, as a pane's would, each effect's ops as Thorin's sheet has them. */
  function setUp({
    on = true,
    states = new Map(),
    sheet = fullerSheet(),
  }: {
    on?: boolean
    states?: ReadonlyMap<string, TableRollState>
    sheet?: CharacterSheet
  } = {}) {
    const send = jest.fn<string, [SheetEffect, EffectOp, number?]>(
      () => 'use-1',
    )
    const got: {
      effects?: Effects
      spent?: ReturnType<ReturnType<typeof useSpent>>
    } = {}
    /** What it says of Bless, as though a roll had spent it, drawn as nothing. */
    function Spent() {
      got.spent = useSpent()(BLESS.id)
      return false
    }
    function Pane(props: {
      on: boolean
      states: typeof states
      sheet: typeof sheet
    }) {
      const value = useEffectControls({
        on: props.on,
        character: 'Thorin Oakenshield',
        effects: toTableSheet(props.sheet, GAME).effects,
        states: props.states,
        send,
      })
      got.effects = value
      return (
        <Effecting value={value}>
          <Spent />
        </Effecting>
      )
    }
    const rendered = render(<Pane on={on} states={states} sheet={sheet} />)
    return {
      got,
      send,
      rerender: (props: {
        on?: boolean
        states?: ReadonlyMap<string, TableRollState>
        sheet?: CharacterSheet
      }) =>
        rendered.rerender(
          <Pane
            on={props.on ?? on}
            states={props.states ?? states}
            sheet={props.sheet ?? sheet}
          />,
        ),
    }
  }

  it('finds an effect on the sheet by its id, and none gone or nowhere', () => {
    const { got } = setUp()

    expect(got.effects?.effectOf(BLESS.id)).toMatchObject({
      id: BLESS.id,
      name: 'Bless',
    })
    expect(got.effects?.effectOf(SHIELD.id)).toMatchObject({ id: SHIELD.id })
    expect(got.effects?.effectOf('gone')).toBeUndefined()
    expect(NO_EFFECTS.effectOf(BLESS.id)).toBeUndefined()
  })

  it('hands the pane the time a change is logged at, where one is given', () => {
    const { got, send } = setUp()

    act(() => {
      got.effects?.send(
        got.effects.effectOf(BLESS.id) as SheetEffect,
        'delete',
        999,
      )
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: BLESS.id }),
      'delete',
      999,
    )
  })

  it('says an effect spent may be removed, then is being removed, then is gone', () => {
    const { got, rerender } = setUp()
    expect(got.spent).toEqual({ gone: false, removing: false, removable: true })

    act(() => {
      got.effects?.send(
        got.effects.effectOf(BLESS.id) as SheetEffect,
        'delete',
        999,
      )
    })
    expect(got.spent).toEqual({ gone: false, removing: true, removable: true })

    rerender({ sheet: withEffects([RAGE]) })
    expect(got.spent).toEqual({ gone: true, removing: false, removable: false })
  })

  it('says one may not be removed where the controls are off, or its ops don’t delete', () => {
    const off = setUp({ on: false })
    expect(off.got.spent).toEqual({
      gone: false,
      removing: false,
      removable: false,
    })

    const disabling = setUp({
      sheet: withEffects([{ ...BLESS, ops: ['disable'] }]),
    })
    expect(disabling.got.spent).toEqual({
      gone: false,
      removing: false,
      removable: false,
    })
  })
})
