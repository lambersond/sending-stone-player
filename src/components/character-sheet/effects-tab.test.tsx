/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConditionsOpener } from './conditions-panel'
import { Effecting, useEffectControls } from './effect-controls'
import { EffectsTab } from './effects-tab'
import { FavoriteMarks } from './favorite-mark'
import { Favoriting } from './favoriting'
import { useWildShape, WildShaping } from './wild-shape'
import {
  characterSheet,
  druidSheet,
  fullerSheet,
  offeringFavorites,
  shapedSheet,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'
import type { ReactNode } from 'react'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <EffectsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

describe('components/character-sheet/effects-tab', () => {
  it("lists the character's conditions, with exhaustion's level and what concentration is on", () => {
    renderTab()

    const conditions = within(
      screen.getByRole('region', { name: 'Conditions' }),
    )
    expect(
      conditions.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual(['ConcentratingBless', 'ExhaustionLevel 2', 'Poisoned'])
    // The game's white status icons sit on a dark tile.
    expect(
      screen.getByRole('region', { name: 'Conditions' }).querySelector('img'),
    ).toHaveClass('bg-[#23232f]')
  })

  it("groups effects in dnd5e's categories, with where each came from and the time it has left", () => {
    renderTab()

    // Changed on purpose (round 0.39.0 §1.6): fullerSheet's Rage is on, on its feature, beside
    // Bless; Shield of Faith is the one turned off.
    const [bless, rage] = within(
      screen.getByRole('region', { name: 'Temporary Effects' }),
    ).getAllByRole('listitem')
    expect(bless).toHaveTextContent(/^Bless9 Rounds/)
    expect(rage).toHaveTextContent(/^Rage10 Rounds/)
    const shield = within(
      screen.getByRole('region', { name: 'Inactive Effects' }),
    ).getByRole('listitem')
    expect(shield).toHaveTextContent(/^Shield of Faith.*Off$/)
    expect(shield.firstElementChild).toHaveClass('opacity-60')
  })

  it("names where an effect came from when that isn't its own name", () => {
    const sheet = fullerSheet()
    const [temporary] = sheet.effects
    renderTab({
      ...sheet,
      effects: [
        {
          ...temporary,
          effects: [
            { ...temporary.effects[0], name: 'Blessed', duration: null },
          ],
        },
      ],
    })

    expect(
      within(
        screen.getByRole('region', { name: 'Temporary Effects' }),
      ).getByRole('listitem'),
    ).toHaveTextContent(/^BlessedFrom Bless$/)
  })

  it('opens every condition and its rules in an aside, from beside the heading', async () => {
    const user = userEvent.setup()
    renderTab()

    const panel = document.querySelector('dialog') as HTMLDialogElement
    expect(panel.open).toBe(false)
    const info = screen.getByRole('button', {
      name: 'Every condition and its rules',
    })
    expect(info).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(info)

    expect(panel.open).toBe(true)
    const reference = within(screen.getByRole('dialog', { name: 'Conditions' }))
    expect(
      reference.getByText('Every condition in the 2024 rules (5.5e)'),
    ).toBeInTheDocument()
    expect(
      reference.getByRole('region', { name: 'Poisoned' }),
    ).toHaveTextContent('You have it')

    await user.click(reference.getByRole('button', { name: 'Close' }))
    expect(panel.open).toBe(false)
  })

  it('says so when there are none', () => {
    renderTab(characterSheet())

    expect(screen.getByText('None.')).toBeInTheDocument()
    expect(screen.getByText('No effects.')).toBeInTheDocument()
  })

  it('stars a favorite, and shows first what it is given, such as the favorites', () => {
    // Changed on purpose (round 0.39.0 §1.6): fullerSheet's effect turned off is Shield of Faith.
    render(
      <FavoriteMarks keys={new Set(['effect:shieldOfFaith'])}>
        <EffectsTab
          characterId='char-1'
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
          favorites={<p>Her favorites</p>}
        />
      </FavoriteMarks>,
    )

    expect(
      screen
        .getAllByText(', favorite')
        .map(star => star.closest('li')?.textContent),
    ).toEqual(['Shield of Faith, favorite10 MinutesOff'])
    expect(
      screen
        .getByText('Her favorites')
        .compareDocumentPosition(
          screen.getByRole('heading', { name: 'Conditions' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('opens the sheet’s own conditions panel, where it has one, and none of its own', async () => {
    const user = userEvent.setup()
    const show = jest.fn()
    render(
      <ConditionsOpener show={show}>
        <EffectsTab
          characterId='char-1'
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        />
      </ConditionsOpener>,
    )

    expect(document.querySelector('dialog')).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Every condition and its rules' }),
    )

    expect(show).toHaveBeenCalledWith()
  })
})

/** A row, by its name: its summary or its plain row. */
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

describe('components/character-sheet/effects-tab, favorites, from module 0.37.0', () => {
  it('offers an effect’s entry, as the effect, and none on a condition', async () => {
    const user = userEvent.setup()
    const offering = offeringFavorites(['effect:blessed'])
    render(
      <Favoriting value={offering.value}>
        <EffectsTab
          characterId='char-1'
          sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        />
      </Favoriting>,
    )
    const bless = within(
      screen.getByRole('region', { name: 'Temporary Effects' }),
    )
      .getByText('Bless')
      .closest('li') as HTMLElement
    fireEvent.contextMenu(
      (bless.querySelector('summary') ??
        bless.firstElementChild) as HTMLElement,
      { button: 2 },
    )
    await user.click(
      within(screen.getByRole('menu', { name: 'Bless' })).getByRole(
        'menuitem',
        { name: 'Remove from favorites' },
      ),
    )
    expect(offering.chosen).toEqual([
      {
        target: { type: 'effect', id: 'blessed' },
        name: 'Bless',
        op: 'remove',
      },
    ])

    for (const condition of ['Exhaustion', 'Poisoned']) {
      expect(fireEvent.contextMenu(rowOf(condition), { button: 2 })).toBe(true)
    }
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

/** An effect's row in a section of its own: what opens it, or the row itself. */
const effectRow = (section: string, name: string) => {
  const item = within(screen.getByRole('region', { name: section }))
    .getByText(name)
    .closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

describe('components/character-sheet/effects-tab, a player’s own effects, from module 0.39.0', () => {
  /** The tab inside a pane offering the character's favorites and effects. */
  function Offering() {
    const offering = offeringFavorites(['effect:blessed'])
    const table = toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')
    const effects = useEffectControls({
      on: true,
      character: 'Thorin Oakenshield',
      effects: table.effects,
      states: new Map(),
      send: () => 'use-1',
    })
    return (
      <Favoriting value={offering.value}>
        <Effecting value={effects}>
          <EffectsTab characterId='char-1' sheet={table} />
        </Effecting>
      </Favoriting>
    )
  }

  beforeEach(() => {
    // An opened row's description never comes.
    globalThis.fetch = jest.fn(
      () => new Promise<Response>(() => {}),
    ) as typeof fetch
  })

  it('puts its controls inside the opened row, none on the row itself; a row with `ops` and no text opens to them', async () => {
    const user = userEvent.setup()
    render(<Offering />)
    const bless = effectRow('Temporary Effects', 'Bless')
    expect(bless.tagName).toBe('SUMMARY')
    expect(within(bless).queryByRole('button')).toBeNull()
    await user.click(bless)
    const off = screen.getByRole('button', { name: 'Turn off Bless' })
    expect(off.closest('summary')).toBeNull()
    expect(off.closest('li')).toBe(bless.closest('li'))
    // Before the description, which loads below.
    expect(
      off.compareDocumentPosition(screen.getByText('Loading…')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // Rage, with no text of its own, opens all the same.
    const rage = effectRow('Temporary Effects', 'Rage')
    expect(rage.tagName).toBe('SUMMARY')
    await user.click(rage)
    expect(
      screen.getByRole('button', { name: 'Turn off Rage' }),
    ).toBeInTheDocument()
  })

  it('keeps Add to or Remove from favorites first in a row’s menu, then Turn off or Turn on, then Delete…; and gives a condition none', async () => {
    render(<Offering />)
    fireEvent.contextMenu(effectRow('Temporary Effects', 'Bless'), {
      button: 2,
    })
    expect(
      within(screen.getByRole('menu', { name: 'Bless' }))
        .getAllByRole('menuitem')
        .map(({ textContent }) => textContent),
    ).toEqual(['Remove from favorites', 'Turn off', 'Delete…'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    fireEvent.contextMenu(effectRow('Inactive Effects', 'Shield of Faith'), {
      button: 2,
    })
    expect(
      within(screen.getByRole('menu', { name: 'Shield of Faith' }))
        .getAllByRole('menuitem')
        .map(({ textContent }) => textContent),
    ).toEqual(['Add to favorites', 'Turn on', 'Delete…'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    for (const condition of ['Exhaustion', 'Poisoned']) {
      expect(fireEvent.contextMenu(rowOf(condition), { button: 2 })).toBe(true)
    }
    expect(
      within(screen.getByRole('region', { name: 'Conditions' })).queryAllByRole(
        'button',
        { name: /^Turn|^Delete/ },
      ),
    ).toEqual([])
  })
})

describe('components/character-sheet/effects-tab, Wild Shape, from module 0.40.0', () => {
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
    { role, effects }: { role?: SeatRole; effects?: boolean } = {},
  ) => {
    const table = toTableSheet(sheet, 'https://my-game.forge-vtt.com')
    return render(
      <Shaping sheet={table} role={role} effects={effects}>
        <EffectsTab characterId='char-1' sheet={table} />
      </Shaping>,
    )
  }

  it('says first, while shaped where the game takes her effects, when they’re changed from here again', () => {
    const { container } = renderShaped()

    const note = screen.getByText(
      'Effects are changed from here again once Elowen is no longer a Wolf.',
    )
    expect((container.firstElementChild as HTMLElement).firstElementChild).toBe(
      note,
    )
  })

  it('says nothing of it where the game takes no effects from here, unshaped, nor at the Gamemaster’s page', () => {
    const { unmount } = renderShaped(shapedSheet(), { effects: false })
    expect(screen.queryByText(/Effects are changed from here/)).toBeNull()
    unmount()

    const again = renderShaped(druidSheet())
    expect(screen.queryByText(/Effects are changed from here/)).toBeNull()
    again.unmount()

    renderShaped(shapedSheet(), { role: 'gm' })
    expect(screen.queryByText(/Effects are changed from here/)).toBeNull()
  })
})
