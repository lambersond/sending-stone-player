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
      'Features',
      'Effects, 3 conditions',
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
