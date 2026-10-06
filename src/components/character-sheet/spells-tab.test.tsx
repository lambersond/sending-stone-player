/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellsTab } from './spells-tab'
import {
  characterSheet,
  fullerSheet,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <SpellsTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

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

  it('says so when there are no spells to show', () => {
    renderTab(characterSheet())

    expect(screen.getByText('No spells to show yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
