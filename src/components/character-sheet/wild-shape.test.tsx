/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionsTab } from './actions-tab'
import { FeaturesTab } from './features-tab'
import {
  LAST_FORM_KEY,
  useWildShape,
  WildShapeRibbon,
  WildShaping,
} from './wild-shape'
import {
  beastsResult,
  druidSheet,
  FORM_IDS,
  KNOWN_FORMS,
  knownForm,
  moonBlock,
  shapedSheet,
  sheetAction,
  wildShapeBlock,
  wolfForm,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { TableRollState, WildShapeForms } from '@/hooks/use-table-rolls'
import type { WildShapeInput } from '@/types/roll'
import type { CharacterSheet, SheetCondition } from '@/types/sending-stone'
import type { SeatRole } from '@/utils/seat-words'
import type { WildShapeLogged } from '@/utils/wild-shape-words'

// How long a change waits for the sheet, here 7 seconds, so that the test proves the constant is
// what it waits for.
jest.mock('@/constants/sending-stone', () => ({
  ...jest.requireActual('@/constants/sending-stone'),
  WILD_SHAPE_SETTLE: 7000,
}))

const GAME = 'https://my-game.forge-vtt.com'

type Props = {
  on?: boolean
  pane?: boolean
  role?: SeatRole
  sheet?: CharacterSheet
  states?: ReadonlyMap<string, TableRollState>
  tab?: 'actions' | 'features'
}

type Send = (
  input: Exclude<WildShapeInput, { op: 'forms' }>,
  logged: WildShapeLogged,
) => string

/** The shown tab's panel, which takes focus after a return. */
const panel = () => document.querySelector<HTMLElement>('#sheet-panel')

/**
 * Elowen's pane as it draws Wild Shape: the ribbon above its tab's panel, the Actions or Features
 * tab inside it, each command sent with a local id of its own, its way as `states` says, and the
 * Beasts to learn as `read` gives them.
 */
const renderPane = (
  initial: Props = {},
  read: () => Promise<WildShapeForms> = () =>
    new Promise<WildShapeForms>(() => {}),
) => {
  let sent = 0
  const send = jest.fn<string, Parameters<Send>>(() => `use-${++sent}`)
  const reads = jest.fn(read)
  function Pane({
    on = true,
    pane = true,
    role = 'player',
    sheet = druidSheet(),
    states = new Map(),
    tab = 'actions',
  }: Readonly<Props>) {
    const table = toTableSheet(sheet, GAME)
    const value = useWildShape({
      on,
      pane,
      role,
      name: 'Elowen',
      sheet: table,
      characterId: 'char-1',
      effects: true,
      states,
      send,
      read: reads,
      panel,
    })
    return (
      <WildShaping value={value}>
        <WildShapeRibbon />
        <div id='sheet-panel' role='tabpanel' aria-label={tab} tabIndex={-1}>
          {tab === 'actions' ? (
            <ActionsTab
              characterId='char-1'
              sheet={table}
              onRoll={jest.fn()}
              onRollDamage={jest.fn()}
            />
          ) : (
            <FeaturesTab
              characterId='char-1'
              sheet={table}
              onRoll={jest.fn()}
              onRollDamage={jest.fn()}
            />
          )}
        </div>
      </WildShaping>
    )
  }
  const rendered = render(<Pane {...initial} />)
  return {
    ...rendered,
    send,
    reads,
    rerender: async (props: Props) =>
      act(async () => rendered.rerender(<Pane {...props} />)),
  }
}

/** The Wild Shape row, wherever it's drawn: its list item. */
const wildRow = () =>
  screen
    .getAllByText('Wild Shape')
    .map(each => each.closest('li'))
    .find(Boolean) as HTMLElement

/** The pane's one Wild Shape dialog, by its title. */
const dialog = (name = 'Wild Shape') => screen.getByRole('dialog', { name })

/** The picker's card of a known form, by its name's start. */
const card = (name: string) =>
  within(screen.getByRole('radiogroup', { name: 'Known forms' })).getByRole(
    'radio',
    { name: new RegExp(`^${name}`) },
  )

/** One sent, in the state given. */
const one = (state: TableRollState, id = 'use-1') =>
  new Map([[id, state]]) as ReadonlyMap<string, TableRollState>

/** A condition on the sheet. */
const condition = (id: string, name: string): SheetCondition => ({
  id,
  name,
  img: null,
  level: null,
  detail: null,
  text: null,
})

/** Opens the picker from the row's Change. */
const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(wildRow()).getByRole('button', { name: 'Change' }))
  return dialog()
}

beforeEach(() => {
  globalThis.localStorage.clear()
  // An opened row's description, read from the app, never comes.
  globalThis.fetch = jest.fn(
    () => new Promise<Response>(() => {}),
  ) as typeof fetch
})

afterEach(() => {
  jest.useRealTimers()
})

describe('components/character-sheet/wild-shape: the row, from module 0.40.0', () => {
  it('offers Change at the end of the row, beside its uses, never on what opens it, with what a change gives', () => {
    renderPane()

    const row = wildRow()
    const change = within(row).getByRole('button', { name: 'Change' })
    expect(change).toHaveAttribute('aria-haspopup', 'dialog')
    expect(change).not.toHaveAttribute('aria-disabled')
    expect(change.closest('summary')).toBeNull()
    // Beside the row's own uses, today's chip.
    expect(within(row).getByText('2 of 2 uses left')).toBeInTheDocument()
    expect(
      within(row).getByText('Change into a known Beast form for 2 hours.'),
    ).toBeVisible()
  })

  it("is no other row's, nor the druid's without the module's Wild Shape", async () => {
    const druid = druidSheet()
    const { rerender } = renderPane({
      sheet: druidSheet({
        actions: [
          {
            ...druid.actions[0],
            actions: [
              ...druid.actions[0].actions,
              sheetAction({ id: 'shillelagh', name: 'Shillelagh' }),
            ],
          },
        ],
      }),
    })
    expect(screen.getAllByRole('button', { name: 'Change' })).toHaveLength(1)
    const other = screen.getByText('Shillelagh').closest('li') as HTMLElement
    expect(within(other).queryByRole('button', { name: 'Change' })).toBeNull()
    expect(other).not.toHaveTextContent(/known Beast form/)

    await rerender({ sheet: druidSheet({ wildShape: undefined }) })

    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    expect(screen.queryByText(/known Beast form/)).toBeNull()
  })

  it.each([
    [
      'with Wild Resurgence',
      true,
      'No uses left. You regain one on a Short Rest, and all on a Long Rest. Or spend a spell slot with Wild Resurgence.',
    ],
    [
      'without',
      false,
      'No uses left. You regain one on a Short Rest, and all on a Long Rest.',
    ],
  ])(
    'says so where no use is left, %s, Change disabled and opening nothing',
    async (_, resurgence, line) => {
      const user = userEvent.setup()
      renderPane({
        sheet: druidSheet({
          wildShape: wildShapeBlock({
            uses: { value: 0, max: 2 },
            resurgence,
          }),
        }),
      })

      const row = wildRow()
      expect(within(row).getByText(line)).toBeVisible()
      const change = within(row).getByRole('button', { name: 'Change' })
      expect(change).toHaveAttribute('aria-disabled', 'true')
      await user.click(change)
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )

  it.each([
    ['at 0 hit points', { hp: { value: 0, max: 38, temp: 0 } }],
    ['Paralyzed', { conditions: [condition('paralyzed', 'Paralyzed')] }],
    ['Unconscious', { conditions: [condition('unconscious', 'Unconscious')] }],
    ['dead', { conditions: [condition('dead', 'Dead')] }],
  ])(
    'says an Incapacitated druid can’t use it, %s, before the uses',
    async (_, fields) => {
      const user = userEvent.setup()
      renderPane({ sheet: druidSheet(fields) })

      const row = wildRow()
      expect(
        within(row).getByText(
          'Elowen can’t use Wild Shape while Incapacitated.',
        ),
      ).toBeVisible()
      expect(within(row).queryByText(/known Beast form/)).toBeNull()
      const change = within(row).getByRole('button', { name: 'Change' })
      expect(change).toHaveAttribute('aria-disabled', 'true')
      await user.click(change)
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )

  it('offers Return and Change while shaped, and says so', () => {
    renderPane({ sheet: shapedSheet() })

    const row = wildRow()
    expect(
      within(row).getByText(
        'Elowen is a Wolf. Returning takes a Bonus Action.',
      ),
    ).toBeVisible()
    expect(within(row).getByRole('button', { name: 'Return' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
    expect(within(row).getByRole('button', { name: 'Change' })).toBeVisible()
  })

  it('offers no Change while shaped with no use left, but says why, beside Return', () => {
    renderPane({
      sheet: shapedSheet({
        wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }),
      }),
    })

    const row = wildRow()
    expect(
      within(row).getByText(
        'Elowen is a Wolf. Returning takes a Bonus Action. No uses left. You regain one on a Short Rest, and all on a Long Rest. Or spend a spell slot with Wild Resurgence.',
      ),
    ).toBeVisible()
    expect(within(row).getByRole('button', { name: 'Return' })).toBeVisible()
    expect(within(row).getByRole('button', { name: 'Change' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('offers nothing for a form the module doesn’t time, which ends in Foundry', () => {
    renderPane({
      sheet: shapedSheet({
        form: wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          hours: null,
          minutesLeft: null,
          profile: null,
        }),
      }),
    })

    const row = wildRow()
    expect(
      within(row).getByText(
        'Elowen is a Giant Ape. That form ends in Foundry.',
      ),
    ).toBeVisible()
    expect(within(row).queryByRole('button', { name: 'Return' })).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Change' })).toBeNull()
  })

  it('offers Known forms… on Features alone, with what Wild Shape gives in its description', async () => {
    const user = userEvent.setup()
    renderPane({ tab: 'features' })

    const row = wildRow()
    expect(
      within(row).getByRole('button', { name: 'Known forms…' }),
    ).toHaveAttribute('aria-haspopup', 'dialog')
    expect(within(row).getByRole('button', { name: 'Change' })).toBeVisible()
    await user.click(within(row).getByRole('button', { name: /^Wild Shape/ }))
    expect(
      within(row).getByText(
        'Bonus Action. 6 known forms, up to CR 1/2, none with a Fly Speed. Lasts 2 hours. Elowen gains 5 temporary hit points.',
      ),
    ).toBeVisible()
  })

  it('says the Moon’s AC floor and fly limit in Features’ line', async () => {
    const user = userEvent.setup()
    renderPane({
      tab: 'features',
      sheet: druidSheet({ wildShape: moonBlock() }),
    })

    await user.click(
      within(wildRow()).getByRole('button', { name: /^Wild Shape/ }),
    )
    expect(
      within(wildRow()).getByText(
        'Bonus Action. 6 known forms, up to CR 1, none with a Fly Speed. Lasts 2 hours. Elowen gains 15 temporary hit points. AC at least 16.',
      ),
    ).toBeVisible()
    expect(
      within(screen.getByRole('tabpanel')).queryByRole('button', {
        name: 'Known forms…',
      }),
    ).toBeVisible()
  })

  it('offers nothing at the Gamemaster’s page, nor where the view doesn’t offer it, nor at a creature’s pane', async () => {
    const { rerender } = renderPane({
      role: 'gm',
      on: false,
      sheet: shapedSheet(),
    })

    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Return/ })).toBeNull()
    expect(screen.queryByText(/Returning takes/)).toBeNull()
    // The ribbon says where it ends, with no Return.
    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(within(ribbon).getByText('It ends in Foundry.')).toBeVisible()

    await rerender({ on: false, sheet: druidSheet() })
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()

    await rerender({ on: false, pane: false, sheet: shapedSheet() })
    expect(screen.queryByRole('region', { name: 'Wild Shape' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
  })
})

describe('components/character-sheet/wild-shape: the picker, from module 0.40.0', () => {
  it('lists the known forms as radios, the chips of what a change gives, and Become a Wolf', async () => {
    const user = userEvent.setup()
    renderPane()

    const picker = await openPicker(user)
    expect(
      within(within(picker).getByRole('list', { name: 'What happens' }))
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual([
      'Bonus Action',
      '2 hours',
      '+5 temporary hit points',
      'Keeps hit points, Int, Wis, Cha and features',
      'No spellcasting',
    ])
    const radios = within(
      within(picker).getByRole('radiogroup', { name: 'Known forms' }),
    ).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('aria-label'))).toEqual([
      'Wolf, Medium, CR 1/4, AC 12, Walk 40 ft, Bite +4 · 1d6 + 2',
      'Black Bear, Medium, CR 1/2, AC 11, Walk 30 ft, Climb 30 ft, Swim 30 ft, Rend +4 · 1d6 + 2',
      'Panther, Medium, CR 1/4, AC 13, Walk 50 ft, Climb 40 ft, Rend +5 · 1d6 + 3',
      'Giant Badger, Medium, CR 1/4, AC 13, Walk 30 ft, Burrow 10 ft, Bite +3 · 2d4 + 1',
      'Crocodile, Large, CR 1/2, AC 12, Walk 20 ft, Swim 30 ft, Bite +4 · 1d8 + 2',
      'Reef Shark, Medium, CR 1/2, AC 12, Walk 5 ft, Swim 30 ft, Bite +4 · 2d4 + 2',
    ])
    expect(card('Wolf')).toHaveAttribute('aria-checked', 'true')
    expect(card('Wolf')).toHaveTextContent('Medium · CR 1/4')
    expect(card('Wolf')).toHaveTextContent('Bite +4 · 1d6 + 2')
    expect(within(picker).getByText('6 of 6 known forms')).toBeVisible()
    expect(
      within(picker).getByRole('button', { name: 'Known forms…' }),
    ).toBeVisible()
    expect(
      within(picker).getByText('2 of 2 uses left · this uses one'),
    ).toBeVisible()
    expect(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    ).not.toHaveAttribute('aria-disabled')
    // The note and Become in the footer, in view under the cards as they scroll.
    expect(picker.querySelector('footer')).toHaveTextContent(
      '2 of 2 uses left · this uses oneBecome a Wolf',
    )
    // A sheet from the bottom of a phone's screen, a dialog wider.
    expect(picker).toHaveClass('max-sm:mt-auto', 'sm:max-w-160')
  })

  it('gives first focus to the checked card, and focus back to Change as it closes', async () => {
    const user = userEvent.setup()
    renderPane()

    const change = within(wildRow()).getByRole('button', { name: 'Change' })
    const picker = await openPicker(user)
    expect(card('Wolf')).toHaveFocus()
    await user.click(within(picker).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    expect(change).toHaveFocus()
  })

  it('says the Moon’s chips: its temporary hit points, its AC floor and its circle’s spells, and the floor on each card', async () => {
    const user = userEvent.setup()
    renderPane({ sheet: druidSheet({ wildShape: moonBlock() }) })

    const picker = await openPicker(user)
    expect(
      within(within(picker).getByRole('list', { name: 'What happens' }))
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual([
      'Bonus Action',
      '2 hours',
      '+15 temporary hit points',
      'AC at least 16',
      'Keeps hit points, Int, Wis, Cha and features',
      'Circle of the Moon spells only',
    ])
    expect(card('Brown Bear')).toHaveTextContent('AC 16')
    expect(card('Dire Wolf')).toHaveTextContent('AC 16')
  })

  it('moves the check with the arrows, wrapping, skipping the cards not offered', async () => {
    const user = userEvent.setup()
    const sheet = shapedSheet({
      wildShape: wildShapeBlock({
        known: [
          KNOWN_FORMS.wolf,
          { ...KNOWN_FORMS.blackBear, fits: false },
          KNOWN_FORMS.panther,
          { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
          KNOWN_FORMS.crocodile,
        ],
      }),
    })
    renderPane({ sheet })

    await openPicker(user)
    // The Wolf is the form she is in: Panther is checked.
    expect(card('Panther')).toHaveAttribute('aria-checked', 'true')
    expect(card('Panther')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(card('Crocodile')).toHaveAttribute('aria-checked', 'true')
    expect(card('Crocodile')).toHaveFocus()
    expect(card('Panther')).toHaveAttribute('aria-checked', 'false')
    expect(card('Panther')).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowRight}')
    expect(card('Panther')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(card('Crocodile')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(card('Panther')).toHaveFocus()
    for (const name of ['Wolf', 'Black Bear', 'Giant Elk']) {
      expect(card(name)).toHaveAttribute('aria-checked', 'false')
    }
    expect(
      within(dialog()).getByRole('button', { name: 'Become a Panther' }),
    ).toBeVisible()
  })

  it('marks each card not offered, and says each is used only in Foundry: outside the rules, outside the compendiums, not found, and Now', async () => {
    const user = userEvent.setup()
    renderPane({
      sheet: shapedSheet({
        wildShape: wildShapeBlock({
          known: [
            KNOWN_FORMS.wolf,
            { ...KNOWN_FORMS.blackBear, fits: false },
            { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
            { ...KNOWN_FORMS.crocodile, found: false },
            KNOWN_FORMS.panther,
          ],
        }),
      }),
    })

    await openPicker(user)
    expect(card('Wolf')).toHaveAccessibleName(/, now$/)
    expect(card('Wolf')).toHaveTextContent('Now')
    expect(card('Wolf')).not.toHaveTextContent('Only in Foundry.')
    expect(card('Black Bear')).toHaveAccessibleName(/, outside the rules$/)
    expect(card('Black Bear')).toHaveTextContent('Outside the rules')
    expect(card('Giant Elk')).toHaveAccessibleName(
      'Giant Elk, not from your Gamemaster’s compendiums',
    )
    expect(card('Giant Elk')).toHaveTextContent(
      'Giant ElkNot from your Gamemaster’s compendiumsOnly in Foundry.',
    )
    expect(card('Crocodile')).toHaveAccessibleName(/, not found in Foundry$/)
    expect(card('Crocodile')).toHaveTextContent('Not found in Foundry')
    for (const name of ['Wolf', 'Black Bear', 'Giant Elk', 'Crocodile']) {
      expect(card(name)).toHaveAttribute('aria-disabled', 'true')
    }
    for (const name of ['Black Bear', 'Giant Elk', 'Crocodile']) {
      expect(card(name)).toHaveTextContent('Only in Foundry.')
    }
    await user.click(card('Black Bear'))
    expect(card('Black Bear')).toHaveAttribute('aria-checked', 'false')
    expect(card('Panther')).toHaveAttribute('aria-checked', 'true')
  })

  it('checks the last form taken from this device, where it’s offered, else the first other than Now', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.setItem(`${LAST_FORM_KEY}:char-1`, FORM_IDS.panther)
    const { rerender } = renderPane()

    let picker = await openPicker(user)
    expect(card('Panther')).toHaveAttribute('aria-checked', 'true')
    expect(card('Panther')).toHaveFocus()
    await user.click(within(picker).getByRole('button', { name: 'Close' }))

    // The last taken is the form she is in now: the first other.
    globalThis.localStorage.setItem(`${LAST_FORM_KEY}:char-1`, FORM_IDS.wolf)
    await rerender({ sheet: shapedSheet() })
    picker = await openPicker(user)
    expect(card('Black Bear')).toHaveAttribute('aria-checked', 'true')
    expect(card('Wolf')).toHaveAttribute('aria-checked', 'false')
    expect(
      within(picker).getByRole('button', { name: 'Become a Black Bear' }),
    ).toBeVisible()
  })

  it('says no other known form can be taken where none is offered, Become disabled', async () => {
    const user = userEvent.setup()
    const { send } = renderPane({
      sheet: shapedSheet({
        wildShape: wildShapeBlock({
          known: [KNOWN_FORMS.wolf, { ...KNOWN_FORMS.panther, fits: false }],
        }),
      }),
    })

    const picker = await openPicker(user)
    expect(
      within(picker).getByText('No other known form can be taken from here.'),
    ).toBeVisible()
    const become = within(picker).getByRole('button', { name: 'Become' })
    expect(become).toHaveAttribute('aria-disabled', 'true')
    await user.click(become)
    expect(send).not.toHaveBeenCalled()
  })

  it('asks to choose forms first where the druid knows none, and offers no Become', async () => {
    const user = userEvent.setup()
    renderPane({
      sheet: druidSheet({ wildShape: wildShapeBlock({ known: [] }) }),
    })

    const picker = await openPicker(user)
    expect(within(picker).getByText('Elowen knows no forms yet.')).toBeVisible()
    const choose = within(picker).getByRole('button', { name: 'Choose forms…' })
    expect(choose).toHaveFocus()
    expect(within(picker).queryByRole('button', { name: /^Become/ })).toBeNull()
    // Nor an empty bar where Become would be (round 0.40.0 review).
    expect(picker.querySelector('footer')).toBeNull()
    await user.click(choose)
    expect(dialog('Known forms')).toBeVisible()
  })

  it('becomes the form checked: Changing…, kept disabled by aria-disabled and focused, sent once', async () => {
    const user = userEvent.setup()
    const { send, rerender } = renderPane()

    const picker = await openPicker(user)
    const become = within(picker).getByRole('button', { name: 'Become a Wolf' })
    await user.click(become)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      { op: 'transform', form: FORM_IDS.wolf },
      { op: 'transform', form: 'Wolf', character: 'Elowen' },
    )
    await rerender({ states: one({ status: 'rolling' }) })
    expect(become).toHaveTextContent('Changing…')
    expect(become).toHaveAttribute('aria-disabled', 'true')
    expect(become).not.toBeDisabled()
    expect(become).toHaveFocus()
    // A second press does nothing while it's on its way.
    await user.click(become)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stays open while the game answers, and says why it didn’t change in its footer, picking another clearing it', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({
      states: one({ status: 'refused', reason: 'unavailable' }),
    })
    expect(dialog()).toBeVisible()
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t change: your Gamemaster’s game isn’t taking Wild Shape now. Try again in a moment.',
    )
    expect(within(picker).queryByText(/uses left/)).toBeNull()
    expect(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    ).not.toHaveAttribute('aria-disabled')

    await user.click(card('Panther'))
    expect(within(picker).queryByRole('alert')).toBeNull()
    expect(
      within(picker).getByText('2 of 2 uses left · this uses one'),
    ).toBeVisible()
  })

  it('says a refusal of its own words without asking to try again, as for no use left', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'failed', reason: 'consume' }) })
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      /^Elowen didn’t change: no uses of Wild Shape are left\.$/,
    )
  })

  it('stays open as the view stops offering Wild Shape, Become then saying so in its footer, sending nothing', async () => {
    const user = userEvent.setup()
    const { send, rerender } = renderPane()

    await openPicker(user)
    await rerender({ on: false })
    const picker = dialog()
    await user.click(card('Black Bear'))
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Black Bear' }),
    )
    expect(send).not.toHaveBeenCalled()
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t change: your Gamemaster’s game isn’t taking Wild Shape now. Try again in a moment.',
    )
  })

  it('closes once the sheet says the form was taken, focus on the ribbon’s heading, the tab kept', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    await openPicker(user)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
    )
    // Made, the sheet still her own: it waits.
    await rerender({ states: one({ status: 'done', visible: true }) })
    expect(
      within(dialog()).getByRole('button', { name: 'Changing…' }),
    ).toHaveAttribute('aria-disabled', 'true')
    // Then the sheet agrees.
    await rerender({
      sheet: shapedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(
      within(ribbon).getByRole('heading', { name: 'Wild Shape · Wolf' }),
    ).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('actions')
    // Kept as the last taken from this device.
    expect(globalThis.localStorage.getItem(`${LAST_FORM_KEY}:char-1`)).toBe(
      FORM_IDS.wolf,
    )
  })

  it('waits for the sheet no longer than its settle once made', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { rerender } = renderPane()

    await openPicker(user)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'done', visible: true }) })
    await act(async () => {
      jest.advanceTimersByTime(6900)
    })
    expect(
      within(dialog()).getByRole('button', { name: 'Changing…' }),
    ).toBeVisible()
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
  })

  it('is rendered once, by the pane, outliving the row it was opened from as a new sheet arrives mid Changing…', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    await openPicker(user)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
    )
    // The Actions tab now without its Wild Shape row, as a sheet might arrive.
    await rerender({
      sheet: druidSheet({ actions: [] }),
      states: one({ status: 'rolling' }),
    })
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    expect(screen.getAllByRole('dialog', { name: 'Wild Shape' })).toHaveLength(
      1,
    )
    expect(
      within(dialog()).getByRole('button', { name: 'Changing…' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('components/character-sheet/wild-shape: the ribbon, from module 0.40.0', () => {
  it('names the form above the tabs, its time left as the module last sent it, and Return to Elowen', () => {
    renderPane({ sheet: shapedSheet() })

    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(ribbon.nextElementSibling).toBe(screen.getByRole('tabpanel'))
    const heading = within(ribbon).getByRole('heading', {
      name: 'Wild Shape · Wolf',
    })
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(within(ribbon).getByText('1 h 58 m left')).toBeVisible()
    expect(
      within(ribbon).getByRole('button', { name: 'Return to Elowen' }),
    ).toHaveAttribute('aria-haspopup', 'dialog')
    expect(within(ribbon).queryByText('It ends in Foundry.')).toBeNull()
  })

  it.each([
    [30, '30 m left'],
    [0, 'Less than a minute left'],
  ])('says %i minutes left as %s', (minutesLeft, words) => {
    renderPane({ sheet: shapedSheet({ form: wolfForm({ minutesLeft }) }) })

    expect(
      within(screen.getByRole('region', { name: 'Wild Shape' })).getByText(
        words,
      ),
    ).toBeVisible()
  })

  it('never counts the time down here, as world time jumps', async () => {
    jest.useFakeTimers()
    renderPane({ sheet: shapedSheet() })

    await act(async () => {
      jest.advanceTimersByTime(3 * 60 * 1000)
    })
    expect(
      within(screen.getByRole('region', { name: 'Wild Shape' })).getByText(
        '1 h 58 m left',
      ),
    ).toBeVisible()
  })

  it('says another transformation ends in Foundry, with no time and no Return', () => {
    renderPane({
      sheet: shapedSheet({
        form: wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          hours: null,
          minutesLeft: null,
          profile: null,
        }),
      }),
    })

    const ribbon = screen.getByRole('region', { name: 'Transformed' })
    expect(
      within(ribbon).getByRole('heading', { name: 'Transformed · Giant Ape' }),
    ).toBeVisible()
    expect(within(ribbon).getByText('It ends in Foundry.')).toBeVisible()
    expect(within(ribbon).queryByText(/left$/)).toBeNull()
    expect(within(ribbon).queryByRole('button')).toBeNull()
  })

  it('says it ends in Foundry with the campaign’s switch off, as the module times nothing then', () => {
    renderPane({
      on: false,
      sheet: shapedSheet({ form: wolfForm({ minutesLeft: null }) }),
    })

    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(within(ribbon).getByText('It ends in Foundry.')).toBeVisible()
    expect(within(ribbon).queryByRole('button')).toBeNull()
  })

  it('says the game isn’t taking Wild Shape now where the module times it but the view stops offering it', async () => {
    const { rerender } = renderPane({ sheet: shapedSheet() })

    await rerender({ on: false, sheet: shapedSheet() })
    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(
      within(ribbon).getByText(
        'Your Gamemaster’s game isn’t taking Wild Shape now.',
      ),
    ).toBeVisible()
    expect(within(ribbon).getByText('1 h 58 m left')).toBeVisible()
    expect(within(ribbon).queryByRole('button')).toBeNull()
  })
})

describe('components/character-sheet/wild-shape: Return, from module 0.40.0', () => {
  it('asks first, saying what ending it does and what Elowen keeps, Stay a Wolf focused first', async () => {
    const user = userEvent.setup()
    renderPane({ sheet: shapedSheet() })

    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    const asked = screen.getByRole('dialog', { name: 'Return to Elowen?' })
    expect(asked).toHaveTextContent(
      'Return to Elowen?Wild Shape ends. It takes a Bonus Action.Elowen keeps 5 temporary hit points.',
    )
    await waitFor(() =>
      expect(
        within(asked).getByRole('button', { name: 'Stay a Wolf' }),
      ).toHaveFocus(),
    )
    expect(within(asked).getByRole('button', { name: 'Return' })).toBeVisible()
  })

  it('says nothing of temporary hit points she hasn’t, and "1 temporary hit point" for one', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane({
      sheet: shapedSheet({ hp: { value: 31, max: 38, temp: 0 } }),
    })

    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    expect(
      screen.getByRole('dialog', { name: 'Return to Elowen?' }),
    ).toHaveTextContent(
      /^Return to Elowen\?Wild Shape ends\. It takes a Bonus Action\.Stay a WolfReturn$/,
    )
    await user.keyboard('{Escape}')

    await rerender({
      sheet: shapedSheet({ hp: { value: 31, max: 38, temp: 1 } }),
    })
    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    expect(
      screen.getByRole('dialog', { name: 'Return to Elowen?' }),
    ).toHaveTextContent('Elowen keeps 1 temporary hit point.')
  })

  it('gives focus back to the Return that opened it on Escape and Stay: the row’s, not always the ribbon’s', async () => {
    const user = userEvent.setup()
    const { send } = renderPane({ sheet: shapedSheet() })

    const own = within(wildRow()).getByRole('button', { name: 'Return' })
    await user.click(own)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stay a Wolf' })).toHaveFocus(),
    )
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    expect(own).toHaveFocus()

    const ribbon = screen.getByRole('button', { name: 'Return to Elowen' })
    await user.click(ribbon)
    await user.click(screen.getByRole('button', { name: 'Stay a Wolf' }))
    expect(ribbon).toHaveFocus()
    expect(send).not.toHaveBeenCalled()
  })

  it('returns Elowen on Return: Returning…, focus kept; once the sheet is hers, focus to the tab’s panel', async () => {
    const user = userEvent.setup()
    const { send, rerender } = renderPane({ sheet: shapedSheet() })

    const ribbonReturn = screen.getByRole('button', {
      name: 'Return to Elowen',
    })
    await user.click(ribbonReturn)
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Return to Elowen?' }),
      ).getByRole('button', { name: 'Return' }),
    )
    expect(send).toHaveBeenCalledWith(
      { op: 'revert' },
      { op: 'revert', form: 'Wolf', character: 'Elowen', temp: 5 },
    )
    await rerender({ sheet: shapedSheet(), states: one({ status: 'rolling' }) })
    const returning = within(
      screen.getByRole('region', { name: 'Wild Shape' }),
    ).getByRole('button', { name: 'Returning…' })
    expect(returning).toHaveAttribute('aria-disabled', 'true')
    expect(returning).toHaveFocus()
    expect(
      within(wildRow()).getByRole('button', { name: 'Returning…' }),
    ).toHaveAttribute('aria-disabled', 'true')

    await rerender({
      sheet: druidSheet({ hp: { value: 31, max: 38, temp: 5 } }),
      states: one({ status: 'done', visible: true }),
    })
    expect(screen.queryByRole('region', { name: 'Wild Shape' })).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveFocus()
  })

  it('moves focus to the panel as the game ends it while focus is in the ribbon, and leaves it elsewhere', async () => {
    const { rerender } = renderPane({ sheet: shapedSheet() })

    screen.getByRole('button', { name: 'Return to Elowen' }).focus()
    await rerender({ sheet: druidSheet() })
    expect(screen.getByRole('tabpanel')).toHaveFocus()

    await rerender({ sheet: shapedSheet() })
    const change = within(wildRow()).getByRole('button', { name: 'Change' })
    change.focus()
    await rerender({ sheet: druidSheet() })
    expect(
      within(wildRow()).getByRole('button', { name: 'Change' }),
    ).toHaveFocus()
  })
})

describe('components/character-sheet/wild-shape: the Known forms manager, from module 0.40.0', () => {
  it('says what Elowen knows of how many, from the picker with a Back, focus on it, and back to Known forms…', async () => {
    const user = userEvent.setup()
    renderPane({
      sheet: druidSheet({
        wildShape: wildShapeBlock({
          known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther],
        }),
      }),
    })

    const picker = await openPicker(user)
    expect(within(picker).getByText('2 of 6 known forms')).toBeVisible()
    await user.click(
      within(picker).getByRole('button', { name: 'Known forms…' }),
    )
    const manager = dialog('Known forms')
    const back = within(manager).getByRole('button', {
      name: 'Back to Wild Shape',
    })
    expect(back).toHaveTextContent('Back')
    expect(back).toHaveFocus()
    expect(
      within(manager).getByText(
        'Elowen knows 2 of 6 forms: Beasts up to CR 1/2, none with a Fly Speed.',
      ),
    ).toBeVisible()
    expect(within(manager).getAllByText('An empty place')).toHaveLength(4)
    expect(
      within(manager).getAllByRole('button', { name: 'Learn a form…' }),
    ).toHaveLength(4)
    // No replacement free, and room left: nothing said of it.
    expect(within(manager).queryByText(/may replace/)).toBeNull()
    expect(
      within(manager).queryByRole('button', { name: /^Replace/ }),
    ).toBeNull()

    await user.click(back)
    expect(
      within(dialog()).getByRole('button', { name: 'Known forms…' }),
    ).toHaveFocus()
  })

  it('opens from Features without a Back', async () => {
    const user = userEvent.setup()
    renderPane({ tab: 'features' })

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    const manager = dialog('Known forms')
    expect(within(manager).queryByRole('button', { name: /^Back/ })).toBeNull()
    expect(
      within(manager).getByText(
        'Elowen may replace one known form after each Long Rest.',
      ),
    ).toBeVisible()
  })

  it('offers Replace… on each known form with a replacement free, never on the form she is in now', async () => {
    const user = userEvent.setup()
    renderPane({
      tab: 'features',
      sheet: shapedSheet({ wildShape: wildShapeBlock({ swap: true }) }),
    })

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    const manager = dialog('Known forms')
    expect(
      within(manager).getByText(
        'Elowen may replace one known form, after the last Long Rest.',
      ),
    ).toBeVisible()
    expect(
      within(manager).queryByRole('button', { name: 'Replace Wolf' }),
    ).toBeNull()
    expect(
      within(manager).getByRole('button', { name: 'Replace Panther' }),
    ).toHaveTextContent('Replace…')
    expect(
      within(manager).getAllByRole('button', { name: /^Replace / }),
    ).toHaveLength(5)
  })

  it('lists the Beasts to learn as the game reads them, sending no command, then a search, their count and Known', async () => {
    const user = userEvent.setup()
    let answer: ((forms: WildShapeForms) => void) | undefined
    const { send, reads } = renderPane(
      {
        tab: 'features',
        sheet: druidSheet({
          wildShape: wildShapeBlock({
            known: [KNOWN_FORMS.panther, KNOWN_FORMS.blackBear],
          }),
        }),
      },
      () =>
        new Promise<WildShapeForms>(resolve => {
          answer = resolve
        }),
    )

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    const learnFrom = within(dialog('Known forms')).getAllByRole('button', {
      name: 'Learn a form…',
    })[1]
    await user.click(learnFrom)
    const learn = dialog('Learn a form')
    expect(within(learn).getByRole('status')).toHaveTextContent(
      'Finding Beasts…',
    )
    const back = within(learn).getByRole('button', {
      name: 'Back to known forms',
    })
    expect(back).toHaveFocus()
    expect(reads).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()

    const listed = beastsResult().wildShape
    if (listed?.op !== 'forms') throw new Error('Beasts expected')
    await act(async () =>
      answer?.({ forms: listed.forms, more: false, limits: listed.limits }),
    )
    expect(within(learn).getByText('9 Beasts')).toBeVisible()
    const beasts = within(learn).getByRole('radiogroup', { name: 'Beasts' })
    // The Wolf is one the game says she knows.
    const wolf = within(beasts).getByRole('radio', { name: /^Wolf/ })
    expect(wolf).toHaveTextContent('Medium · CR 1/4')
    expect(wolf).toHaveTextContent('AC 12')
    expect(wolf).toHaveTextContent('Known')
    expect(wolf).toHaveAttribute('aria-disabled', 'true')
    const panther = within(beasts).getByRole('radio', { name: /^Panther/ })
    expect(panther).toHaveTextContent('Known')
    expect(panther).toHaveAttribute('aria-disabled', 'true')

    await user.click(wolf)
    expect(wolf).toHaveAttribute('aria-checked', 'false')

    await user.type(
      within(learn).getByRole('searchbox', { name: 'Search Beasts' }),
      'horse',
    )
    expect(within(learn).getByText('1 of 9 Beasts')).toBeVisible()
    // Its count is read where it stands, never announced: once listed, the view has no live
    // region at all, its only live words its "Finding Beasts…" and its refusals (§9.5).
    expect(
      learn.querySelectorAll(
        '[aria-live], [role="status"], [role="alert"], [role="log"]',
      ),
    ).toHaveLength(0)
    expect(within(beasts).getAllByRole('radio')).toHaveLength(1)
    const horse = within(beasts).getByRole('radio', { name: /^Riding Horse/ })
    await user.click(horse)
    expect(horse).toHaveAttribute('aria-checked', 'true')
    await user.click(
      within(learn).getByRole('button', { name: 'Learn a Riding Horse' }),
    )
    expect(send).toHaveBeenCalledWith(
      {
        op: 'learn',
        uuid: listed.forms.find(({ name }) => name === 'Riding Horse')?.uuid,
        replace: null,
      },
      { op: 'learn', form: 'Riding Horse', character: 'Elowen' },
    )
    // Back returns focus to the control that opened the view.
    await user.click(back)
    expect(
      within(dialog('Known forms')).getAllByRole('button', {
        name: 'Learn a form…',
      })[1],
    ).toHaveFocus()
  })

  it('says why the game couldn’t list them, and tries again', async () => {
    const user = userEvent.setup()
    const listed = beastsResult().wildShape
    if (listed?.op !== 'forms') throw new Error('Beasts expected')
    let times = 0
    const { reads } = renderPane(
      {
        tab: 'features',
        sheet: druidSheet({
          wildShape: wildShapeBlock({ known: [KNOWN_FORMS.wolf] }),
        }),
      },
      async () =>
        ++times === 1
          ? { reason: 'unavailable' }
          : { forms: listed.forms, more: false, limits: listed.limits },
    )

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    await user.click(
      within(dialog('Known forms')).getAllByRole('button', {
        name: 'Learn a form…',
      })[0],
    )
    const learn = dialog('Learn a form')
    expect(await within(learn).findByRole('alert')).toHaveTextContent(
      'Your Gamemaster’s game couldn’t list the Beasts: your Gamemaster’s game isn’t taking Wild Shape now.',
    )
    await user.click(within(learn).getByRole('button', { name: 'Try again' }))
    expect(await within(learn).findByText('9 Beasts')).toBeVisible()
    expect(reads).toHaveBeenCalledTimes(2)
  })

  it('learns a Beast in place of a known form after a Long Rest: Learning…, then the manager again, focus on its card', async () => {
    const user = userEvent.setup()
    const listed = beastsResult().wildShape
    if (listed?.op !== 'forms') throw new Error('Beasts expected')
    const { send, rerender } = renderPane(
      {
        tab: 'features',
        sheet: druidSheet({ wildShape: wildShapeBlock({ swap: true }) }),
      },
      async () => ({ forms: listed.forms, more: true, limits: listed.limits }),
    )

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    await user.click(
      within(dialog('Known forms')).getByRole('button', {
        name: 'Replace Panther',
      }),
    )
    const learn = dialog('Replace a Panther')
    expect(
      await within(learn).findByText('9 Beasts, and more in Foundry'),
    ).toBeVisible()
    await user.click(
      within(learn).getByRole('radio', { name: /^Riding Horse/ }),
    )
    const button = within(learn).getByRole('button', {
      name: 'Learn a Riding Horse in place of a Panther',
    })
    await user.click(button)
    const horse = listed.forms.find(({ name }) => name === 'Riding Horse')
    expect(send).toHaveBeenCalledWith(
      { op: 'learn', uuid: horse?.uuid, replace: FORM_IDS.panther },
      {
        op: 'learn',
        form: 'Riding Horse',
        old: 'Panther',
        character: 'Elowen',
      },
    )
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: wildShapeBlock({ swap: true }) }),
      states: one({ status: 'rolling' }),
    })
    expect(
      within(learn).getByRole('button', { name: 'Learning…' }),
    ).toHaveAttribute('aria-disabled', 'true')
    // The sheet says the Riding Horse is where the Panther was.
    const known = wildShapeBlock().known.map(each =>
      each.id === FORM_IDS.panther
        ? knownForm({
            id: FORM_IDS.panther,
            name: 'Riding Horse',
            uuid: horse?.uuid,
          })
        : each,
    )
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: wildShapeBlock({ swap: false, known }) }),
      states: one({ status: 'done', visible: true }),
    })
    const manager = dialog('Known forms')
    expect(within(manager).getByText('Riding Horse')).toHaveFocus()
    expect(
      within(manager).queryByRole('button', { name: /^Replace/ }),
    ).toBeNull()
  })

  it('says why a Beast wasn’t learned', async () => {
    const user = userEvent.setup()
    const listed = beastsResult().wildShape
    if (listed?.op !== 'forms') throw new Error('Beasts expected')
    const block = wildShapeBlock({ known: [KNOWN_FORMS.panther] })
    const { rerender } = renderPane(
      { tab: 'features', sheet: druidSheet({ wildShape: block }) },
      async () => ({ forms: listed.forms, more: false, limits: listed.limits }),
    )

    await user.click(
      within(wildRow()).getByRole('button', { name: 'Known forms…' }),
    )
    await user.click(
      within(dialog('Known forms')).getAllByRole('button', {
        name: 'Learn a form…',
      })[0],
    )
    const learn = dialog('Learn a form')
    await user.click(await within(learn).findByRole('radio', { name: /^Rat/ }))
    await user.click(within(learn).getByRole('button', { name: 'Learn a Rat' }))
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: block }),
      states: one({ status: 'failed', reason: 'form' }),
    })
    expect(within(learn).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t learn it: that Beast can’t be learned now.',
    )
  })
})

/** A control outside the pane's Wild Shape, as another tab's or the chat's would be. */
const elsewhere = () => {
  const button = document.createElement('button')
  button.textContent = 'Elsewhere'
  document.body.append(button)
  return button
}

/** The Beasts the game lists, at once. */
const listing = async (): Promise<
  Exclude<WildShapeForms, { reason: string }>
> => {
  const listed = beastsResult().wildShape
  if (listed?.op !== 'forms') throw new Error('Beasts expected')
  return { forms: listed.forms, more: false, limits: listed.limits }
}

/** The Rat as the game lists it to learn, and as a known form once learned. */
const rat = async () => {
  const { forms } = await listing()
  const beast = forms.find(({ name }) => name === 'Rat')
  return knownForm({ id: 'Rt1aB2cD3eF4gH5i', name: 'Rat', uuid: beast?.uuid })
}

/** From Features' Known forms…, Learn a form… at the first empty place, the Rat, and Learn. */
const learnRat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    within(wildRow()).getByRole('button', { name: 'Known forms…' }),
  )
  await user.click(
    within(dialog('Known forms')).getAllByRole('button', {
      name: 'Learn a form…',
    })[0],
  )
  const learn = dialog('Learn a form')
  await user.click(await within(learn).findByRole('radio', { name: /^Rat/ }))
  await user.click(within(learn).getByRole('button', { name: 'Learn a Rat' }))
  return learn
}

describe('components/character-sheet/wild-shape: made late, focus where the player has gone, and one on its way before another (round 0.40.0 review)', () => {
  afterEach(() => {
    for (const button of document.querySelectorAll('body > button')) {
      button.remove()
    }
  })

  it('closes once a change the game took too long over is made late, no longer saying it wasn’t, waiting for the sheet', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { send, rerender } = renderPane()

    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'rolling' }) })
    await rerender({ states: one({ status: 'failed', reason: 'timeout' }) })
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t change: the game took too long. Try again in a moment.',
    )
    // The game answers a minute later, its Gamemaster's tab slow: made after all.
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await rerender({ states: one({ status: 'done', visible: true }) })
    expect(within(picker).queryByRole('alert')).toBeNull()
    expect(
      within(picker).getByRole('button', { name: 'Changing…' }),
    ).toHaveAttribute('aria-disabled', 'true')

    await rerender({
      sheet: shapedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'Wild Shape' })).getByRole(
        'heading',
        { name: 'Wild Shape · Wolf' },
      ),
    ).toHaveFocus()
    expect(globalThis.localStorage.getItem(`${LAST_FORM_KEY}:char-1`)).toBe(
      FORM_IDS.wolf,
    )
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('waits for the sheet no longer than its settle once a change is made late', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { rerender } = renderPane()

    await openPicker(user)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'failed', reason: 'timeout' }) })
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await rerender({ states: one({ status: 'done', visible: true }) })
    await act(async () => {
      jest.advanceTimersByTime(6900)
    })
    expect(
      within(dialog()).getByRole('button', { name: 'Changing…' }),
    ).toBeVisible()
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
  })

  it('goes back to the known forms once a Beast the game took too long over is learned late, no longer saying it wasn’t', async () => {
    const user = userEvent.setup()
    const block = wildShapeBlock({ known: [KNOWN_FORMS.panther] })
    const { rerender } = renderPane(
      { tab: 'features', sheet: druidSheet({ wildShape: block }) },
      listing,
    )

    const learn = await learnRat(user)
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: block }),
      states: one({ status: 'failed', reason: 'timeout' }),
    })
    expect(within(learn).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t learn it: the game took too long.',
    )

    await rerender({
      tab: 'features',
      sheet: druidSheet({
        wildShape: wildShapeBlock({
          known: [KNOWN_FORMS.panther, await rat()],
        }),
      }),
      states: one({ status: 'done', visible: true }),
    })
    const manager = dialog('Known forms')
    expect(within(manager).queryByRole('alert')).toBeNull()
    expect(within(manager).getByText('Rat')).toHaveFocus()
  })

  it('takes no focus from where the player has gone since a change was pressed, the picker closed mid Changing…', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    const change = within(wildRow()).getByRole('button', { name: 'Change' })
    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'rolling' }) })
    await user.click(within(picker).getByRole('button', { name: 'Close' }))
    expect(change).toHaveFocus()
    const other = elsewhere()
    other.focus()

    await rerender({
      sheet: shapedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    // The ribbon's heading is drawn, and would have taken it.
    expect(
      within(screen.getByRole('region', { name: 'Wild Shape' })).getByRole(
        'heading',
        { name: 'Wild Shape · Wolf' },
      ),
    ).not.toHaveFocus()
    expect(other).toHaveFocus()
  })

  it('leaves focus on the tab’s panel where the player has put it while a change was on its way', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({ states: one({ status: 'rolling' }) })
    await user.click(within(picker).getByRole('button', { name: 'Close' }))
    panel()?.focus()

    await rerender({
      sheet: shapedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    expect(screen.getByRole('tabpanel')).toHaveFocus()
  })

  it('takes no focus from where the player has gone since Return was pressed', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane({ sheet: shapedSheet() })

    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Return to Elowen?' }),
      ).getByRole('button', { name: 'Return' }),
    )
    await rerender({ sheet: shapedSheet(), states: one({ status: 'rolling' }) })
    expect(
      within(screen.getByRole('region', { name: 'Wild Shape' })).getByRole(
        'button',
        { name: 'Returning…' },
      ),
    ).toHaveFocus()
    const other = elsewhere()
    other.focus()

    await rerender({
      sheet: druidSheet({ hp: { value: 31, max: 38, temp: 5 } }),
      states: one({ status: 'done', visible: true }),
    })
    expect(screen.queryByRole('region', { name: 'Wild Shape' })).toBeNull()
    expect(screen.getByRole('tabpanel')).not.toHaveFocus()
    expect(other).toHaveFocus()
  })

  it('gives Back to Wild Shape’s focus to Known forms… once the first form is learned, as Choose forms… is gone', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane(
      { sheet: druidSheet({ wildShape: wildShapeBlock({ known: [] }) }) },
      listing,
    )

    await user.click(
      within(await openPicker(user)).getByRole('button', {
        name: 'Choose forms…',
      }),
    )
    await user.click(
      within(dialog('Known forms')).getAllByRole('button', {
        name: 'Learn a form…',
      })[0],
    )
    const learn = dialog('Learn a form')
    await user.click(await within(learn).findByRole('radio', { name: /^Rat/ }))
    await user.click(within(learn).getByRole('button', { name: 'Learn a Rat' }))
    await rerender({
      sheet: druidSheet({ wildShape: wildShapeBlock({ known: [] }) }),
      states: one({ status: 'rolling' }),
    })
    await rerender({
      sheet: druidSheet({
        wildShape: wildShapeBlock({ known: [await rat()] }),
      }),
      states: one({ status: 'done', visible: true }),
    })
    const manager = dialog('Known forms')
    expect(within(manager).getByText('Rat')).toHaveFocus()

    await user.click(
      within(manager).getByRole('button', { name: 'Back to Wild Shape' }),
    )
    expect(
      within(dialog()).getByRole('button', { name: 'Known forms…' }),
    ).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('says a Become pressed while a Beast is being learned isn’t sent, as it’s on its way already', async () => {
    const user = userEvent.setup()
    const block = wildShapeBlock({
      known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther],
    })
    const { send, rerender } = renderPane(
      { tab: 'features', sheet: druidSheet({ wildShape: block }) },
      listing,
    )

    const learn = await learnRat(user)
    expect(send).toHaveBeenCalledTimes(1)
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: block }),
      states: one({ status: 'rolling' }),
    })
    await user.click(within(learn).getByRole('button', { name: 'Close' }))
    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(within(picker).getByRole('alert')).toHaveTextContent(
      /^Elowen didn’t change: it’s on its way already\.$/,
    )
  })

  it('says a Learn pressed while a change is on its way isn’t sent, as it’s on its way already', async () => {
    const user = userEvent.setup()
    const block = wildShapeBlock({
      known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther],
    })
    const { send, rerender } = renderPane(
      { tab: 'features', sheet: druidSheet({ wildShape: block }) },
      listing,
    )

    const picker = await openPicker(user)
    await user.click(
      within(picker).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({
      tab: 'features',
      sheet: druidSheet({ wildShape: block }),
      states: one({ status: 'rolling' }),
    })
    await user.click(within(picker).getByRole('button', { name: 'Close' }))
    const learn = await learnRat(user)
    expect(send).toHaveBeenCalledTimes(1)
    expect(within(learn).getByRole('alert')).toHaveTextContent(
      'Elowen didn’t learn it: it’s on its way already.',
    )
  })

  it('offers no Return while a Beast is being learned, opening nothing', async () => {
    const user = userEvent.setup()
    const block = wildShapeBlock({
      known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther],
    })
    const { send, rerender } = renderPane(
      { tab: 'features', sheet: shapedSheet({ wildShape: block }) },
      listing,
    )

    const learn = await learnRat(user)
    await rerender({
      tab: 'features',
      sheet: shapedSheet({ wildShape: block }),
      states: one({ status: 'rolling' }),
    })
    await user.click(within(learn).getByRole('button', { name: 'Close' }))
    const own = screen.getByRole('button', { name: 'Return to Elowen' })
    expect(own).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(wildRow()).getByRole('button', { name: 'Return' }),
    ).toHaveAttribute('aria-disabled', 'true')
    await user.click(own)
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)

    // Learned, and on the sheet: Return is offered again.
    await rerender({
      tab: 'features',
      sheet: shapedSheet({
        wildShape: wildShapeBlock({
          known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther, await rat()],
        }),
      }),
      states: one({ status: 'done', visible: true }),
    })
    expect(
      screen.getByRole('button', { name: 'Return to Elowen' }),
    ).not.toHaveAttribute('aria-disabled')
  })

  it('closes Return’s confirm as the game stops taking Wild Shape, its Return gone, focus to the ribbon that says why, and never opens it again by itself', async () => {
    const user = userEvent.setup()
    const { send, rerender } = renderPane({ sheet: shapedSheet() })

    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stay a Wolf' })).toHaveFocus(),
    )
    await rerender({ on: false, sheet: shapedSheet() })
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(
      within(ribbon).getByRole('heading', { name: 'Wild Shape · Wolf' }),
    ).toHaveFocus()
    expect(
      within(ribbon).getByText(
        'Your Gamemaster’s game isn’t taking Wild Shape now.',
      ),
    ).toBeVisible()

    await rerender({ on: true, sheet: shapedSheet() })
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('closes Return’s confirm as the game ends Wild Shape, focus to the tab’s panel, and opens none with a later form', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane({ sheet: shapedSheet() })

    await user.click(screen.getByRole('button', { name: 'Return to Elowen' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stay a Wolf' })).toHaveFocus(),
    )
    await rerender({ sheet: druidSheet() })
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveFocus()

    await rerender({ sheet: shapedSheet() })
    expect(
      screen.queryByRole('dialog', { name: 'Return to Elowen?' }),
    ).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveFocus()
  })
})

/**
 * The pane's <dialog> as a browser closes it, which jest's stand-in doesn't: closed in code, it
 * gives focus back at once to what had it as it opened, and fires its close event only after, as
 * a task of its own. Returns what puts the stand-in back.
 */
const browserDialogs = () => {
  const dialog = HTMLDialogElement.prototype
  const was = { showModal: dialog.showModal, close: dialog.close }
  const opener = new WeakMap<HTMLDialogElement, Element | null>()
  class Browser extends HTMLDialogElement {
    override showModal() {
      opener.set(this, document.activeElement)
      this.open = true
    }

    override close() {
      if (!this.open) return
      this.open = false
      const before = opener.get(this)
      if (before instanceof HTMLElement && before.isConnected) before.focus()
      setTimeout(() => this.dispatchEvent(new Event('close')))
    }
  }
  dialog.showModal = Browser.prototype.showModal
  dialog.close = Browser.prototype.close
  return () => {
    dialog.showModal = was.showModal
    dialog.close = was.close
  }
}

/** The close events the browser has queued, fired. */
const closesFired = async () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve))
  })

describe('components/character-sheet/wild-shape: as a browser closes the dialog (round 0.40.0 e2e)', () => {
  let restore: () => void
  beforeEach(() => {
    restore = browserDialogs()
  })
  afterEach(() => restore())

  it('leaves focus on the ribbon’s heading after Become, the browser’s close of the picker coming after', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPane()

    await openPicker(user)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
    )
    await rerender({
      sheet: shapedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    // The picker closed in code: the browser gives focus back to Change, the heading takes it, and
    // the close event comes after both.
    await closesFired()
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
    expect(
      within(ribbon).getByRole('heading', { name: 'Wild Shape · Wolf' }),
    ).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('actions')
  })

  it('still gives focus back to Change on Close, and on Escape, which the browser closes itself', async () => {
    const user = userEvent.setup()
    renderPane()

    const change = within(wildRow()).getByRole('button', { name: 'Change' })
    let picker = await openPicker(user)
    await user.click(within(picker).getByRole('button', { name: 'Close' }))
    await closesFired()
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    expect(change).toHaveFocus()

    picker = await openPicker(user)
    expect(card('Wolf')).toHaveFocus()
    act(() => (picker as HTMLDialogElement).close())
    await closesFired()
    expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
    expect(change).toHaveFocus()
    // Open again, as the pane's state says it's closed.
    picker = await openPicker(user)
    expect(card('Wolf')).toHaveFocus()
  })
})

/** Elowen herself again, the game having ended her Wolf, its use spent. */
const endedSheet = (block: Parameters<typeof wildShapeBlock>[0] = {}) =>
  druidSheet({
    wildShape: wildShapeBlock({
      uses: { value: 1, max: 2 },
      ended: {
        form: 'Wolf',
        why: 'foundry',
        at: Date.now(),
        formId: 'formWolf00000001',
      },
      ...block,
    }),
  })

/** Becomes a Wolf from the row, and has the sheet say so: the picker closed. */
const becomeWolf = async (
  user: ReturnType<typeof userEvent.setup>,
  rerender: (props: Props) => Promise<void>,
  props: Props = {},
) => {
  await openPicker(user)
  await user.click(
    within(dialog()).getByRole('button', { name: 'Become a Wolf' }),
  )
  await rerender({
    ...props,
    sheet: shapedSheet({ wildShape: props.sheet?.wildShape }),
    states: one({ status: 'done', visible: true }),
  })
  expect(screen.queryByRole('dialog', { name: 'Wild Shape' })).toBeNull()
}

describe('components/character-sheet/wild-shape: a change the game has ended since (round 0.40.0 e2e)', () => {
  it('offers Become again at once, within the change’s settle', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { send, rerender } = renderPane()

    await becomeWolf(user, rerender)
    await rerender({
      sheet: endedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    const picker = await openPicker(user)
    const become = within(picker).getByRole('button', {
      name: 'Become a Wolf',
    })
    expect(become).not.toHaveAttribute('aria-disabled')
    await user.click(become)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith(
      { op: 'transform', form: FORM_IDS.wolf },
      { op: 'transform', form: 'Wolf', character: 'Elowen' },
    )
    expect(within(picker).queryByRole('alert')).toBeNull()
  })

  it('learns a Beast at once, within the change’s settle', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const block = wildShapeBlock({
      known: [KNOWN_FORMS.wolf, KNOWN_FORMS.panther],
    })
    const { send, rerender } = renderPane(
      { tab: 'features', sheet: druidSheet({ wildShape: block }) },
      listing,
    )

    await becomeWolf(user, rerender, {
      tab: 'features',
      sheet: druidSheet({ wildShape: block }),
    })
    await rerender({
      tab: 'features',
      sheet: endedSheet({ known: block.known }),
      states: one({ status: 'done', visible: true }),
    })
    const learn = await learnRat(user)
    const { uuid } = await rat()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith(
      { op: 'learn', uuid, replace: null },
      { op: 'learn', form: 'Rat', character: 'Elowen' },
    )
    expect(within(learn).queryByRole('alert')).toBeNull()
  })

  it('offers Return at once on a later form made in Foundry, within the change’s settle', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { send, rerender } = renderPane()

    await becomeWolf(user, rerender)
    await rerender({
      sheet: endedSheet(),
      states: one({ status: 'done', visible: true }),
    })
    // The Gamemaster's own Wild Shape in Foundry, a Panther.
    await rerender({
      sheet: shapedSheet({
        form: wolfForm({ name: 'Panther', profile: FORM_IDS.panther }),
      }),
      states: one({ status: 'done', visible: true }),
    })
    const own = screen.getByRole('button', { name: 'Return to Elowen' })
    expect(own).not.toHaveAttribute('aria-disabled')
    await user.click(own)
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Return to Elowen?' }),
      ).getByRole('button', { name: 'Return' }),
    )
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith(
      { op: 'revert' },
      { op: 'revert', form: 'Panther', character: 'Elowen', temp: 5 },
    )
  })
})
