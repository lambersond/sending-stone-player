/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { BiographyTab } from './biography-tab'
import { characterSheet, fullerSheet, TEXTS } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetDetails } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <BiographyTab
      characterId='char-1'
      sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
    />,
  )

const withDetails = (details: Partial<SheetDetails>) =>
  fullerSheet({ details: { ...fullerSheet().details, ...details } })

const facts = (region: HTMLElement) =>
  within(region)
    .getAllByRole('term')
    .map(term => `${term.textContent}: ${term.nextSibling?.textContent}`)

describe('components/character-sheet/biography-tab', () => {
  beforeEach(() => {
    // The biography loads in the test that looks for it.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it("shows the character's details and experience", () => {
    renderTab()

    const details = screen.getByRole('region', { name: 'Details' })
    expect(facts(details)).toEqual([
      'Experience: 6,500 / 14,000 XP',
      'Alignment: Lawful Good',
      'Age: 195',
    ])
    const bar = within(details)
      .getByText('6,500')
      .closest('dd')
      ?.querySelector('[aria-hidden] > span') as HTMLElement
    expect(bar.style.width).toMatch(/^46\.42/)
  })

  it('shows experience without a next level as it is', () => {
    renderTab(withDetails({ xp: { value: 355_000, max: null }, about: [] }))

    const details = screen.getByRole('region', { name: 'Details' })
    expect(facts(details)).toEqual(['Experience: 355,000 XP'])
    expect(details.querySelector('[aria-hidden]')).toBeNull()
  })

  it('shows the details without experience', () => {
    renderTab(withDetails({ xp: null }))

    expect(facts(screen.getByRole('region', { name: 'Details' }))).toEqual([
      'Alignment: Lawful Good',
      'Age: 195',
    ])
  })

  it('shows their personality and appearance', () => {
    renderTab()

    expect(facts(screen.getByRole('region', { name: 'Personality' }))).toEqual([
      'Ideals: Greater good.',
      'Flaws: Gold-sick.',
    ])
    expect(
      screen.getByRole('region', { name: 'Appearance' }),
    ).toHaveTextContent('Broad-shouldered, with a braided beard.')
  })

  it('loads their biography', async () => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html: '<p>Heir to the <strong>Lonely Mountain</strong>.</p>',
          }),
        }) as Response,
    )
    renderTab()

    const biography = screen.getByRole('region', { name: 'Biography' })
    expect(
      await within(biography).findByText('Lonely Mountain'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.biography}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  it('leaves out what has not been written', () => {
    renderTab(
      withDetails({ personality: [], appearance: null, biography: null }),
    )

    expect(screen.queryByRole('region', { name: 'Personality' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Appearance' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Biography' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Nothing has been written about this character yet.'),
    ).toBeNull()
  })

  it('says so when nothing has been written, as from an older module', () => {
    renderTab(characterSheet())

    expect(
      screen.getByText('Nothing has been written about this character yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
