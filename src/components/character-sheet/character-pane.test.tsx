/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { characterSheet, fullerSheet, TEXTS } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

const renderPane = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <CharacterPane
      characterId='char-1'
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet, GAME)}
    />,
  )

describe('components/character-sheet/character-pane', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html: '<p>Regain <span class="roll">1d10 + 5</span> hit points.</p>',
          }),
        }) as Response,
    )
  })

  it('rolls from the sheet into the tray', async () => {
    const user = userEvent.setup()
    renderPane(characterSheet())

    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    const status = await screen.findByText('Strength saving throw')
    const total = Number(status.parentElement?.previousSibling?.textContent)
    expect(total).toBeGreaterThanOrEqual(8)
    expect(total).toBeLessThanOrEqual(27)
    expect(screen.getByRole('status')).toHaveTextContent('+7')
  })

  it("has Tidy 5e's tabs, and shows one part of the sheet at a time", async () => {
    const user = userEvent.setup()
    renderPane()

    const tabs = within(
      screen.getByRole('tablist', { name: 'Character sheet' }),
    )
    expect(tabs.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Inventory',
      'Spells',
      'Features',
      'Effects, 3 conditions',
      'Biography',
    ])
    expect(tabs.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
    expect(
      screen.getByText('Fighter 5 · Champion', { selector: 'span' }),
    ).toBeInTheDocument()

    await user.click(tabs.getByRole('tab', { name: 'Features' }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Features')
    expect(
      screen.getByRole('heading', { name: 'Fighter Features' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Abilities' })).toBeNull()
    // Rolls are made from the Character tab, where the tray is.
    expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
  })

  it.each([
    ['Inventory', 'Weapons'],
    ['Spells', 'Spellcasting'],
    ['Effects', 'Conditions'],
    ['Biography', 'Details'],
  ])('shows %s', async (name, heading) => {
    const user = userEvent.setup()
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    renderPane()

    await user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      new RegExp(`^${name}`),
    )
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('labels only the chosen tab where all the labels might not fit, naming each for screen readers', async () => {
    const user = userEvent.setup()
    renderPane()

    const label = (name: string) =>
      screen.getByRole('tab', { name: new RegExp(`^${name}`) })
        .firstElementChild?.nextElementSibling
    expect(label('Character')).not.toHaveClass('sr-only')
    expect(label('Inventory')).toHaveClass('sr-only', '@3xl:not-sr-only')
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute(
      'title',
      'Inventory',
    )

    await user.click(screen.getByRole('tab', { name: 'Inventory' }))

    expect(label('Inventory')).not.toHaveClass('sr-only')
    expect(label('Character')).toHaveClass('sr-only')
  })

  it("has no Spells tab for a character who doesn't cast", () => {
    renderPane(characterSheet())

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Inventory',
      'Features',
      'Effects',
      'Biography',
    ])
  })

  it('has a Spells tab for a character with spells but no spellcasting class', () => {
    const sheet = fullerSheet()
    renderPane({ ...sheet, spellcasting: null })

    expect(screen.getByRole('tab', { name: 'Spells' })).toBeInTheDocument()
  })

  it('shows the character when the tab shown is gone', async () => {
    const user = userEvent.setup()
    const sheet = fullerSheet()
    const { rerender } = renderPane(sheet)
    await user.click(screen.getByRole('tab', { name: 'Spells' }))

    rerender(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet({ ...sheet, spellcasting: null, spells: [] }, GAME)}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Spells' })).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
  })

  it('keeps rolls while another part of the sheet is shown', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('button', { name: 'Strength check, +4' }))
    await screen.findByText('Strength check', { selector: 'p' })

    await user.click(screen.getByRole('tab', { name: 'Features' }))
    await user.click(screen.getByRole('tab', { name: 'Character' }))

    expect(screen.getByRole('status')).toHaveTextContent('Strength check')
  })

  it("shows the character's conditions, which open their rules in Effects", async () => {
    const user = userEvent.setup()
    renderPane()

    const conditions = within(screen.getByRole('list', { name: 'Conditions' }))
    expect(conditions.getAllByRole('button').map(b => b.textContent)).toEqual([
      'ConcentratingBless',
      'ExhaustionLevel 2',
      'Poisoned',
    ])
    await user.click(conditions.getByRole('button', { name: 'Poisoned' }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^Effects/)
    expect(
      screen.getByRole('heading', { name: 'Conditions' }),
    ).toBeInTheDocument()
  })

  it('has no conditions to show for a character without any', () => {
    renderPane(characterSheet())

    expect(screen.queryByRole('list', { name: 'Conditions' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Effects' })).toBeInTheDocument()
  })

  it('opens a feature to its description, loading it once', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Features' }))

    const feature = screen
      .getByText('Second Wind')
      .closest('details') as HTMLElement
    expect(feature).not.toHaveAttribute('open')
    expect(fetch).not.toHaveBeenCalled()
    await user.click(within(feature).getByText('Second Wind'))

    expect(
      await within(feature).findByText('1d10 + 5', { selector: '.roll' }),
    ).toBeInTheDocument()
    expect(
      within(feature).getByText('Class Feature · Fighter 1'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.secondWind}`,
      { signal: expect.any(AbortSignal) },
    )
  })
})
