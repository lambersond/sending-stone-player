/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import { BiographyTab } from './biography-tab'
import { forgetCookbook } from '@/hooks/use-cookbook-view'
import { forgetNotes } from '@/hooks/use-notes'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import { characterSheet, fullerSheet, TEXTS } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet, SheetDetails } from '@/types/sending-stone'

const renderTab = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <BiographyTab
      characterId='char-1'
      name='Thorin Oakenshield'
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
      screen.queryByText(
        'Nothing is written about Thorin Oakenshield in Foundry yet.',
      ),
    ).toBeNull()
  })

  it('says so when nothing has been written, as from an older module', () => {
    renderTab(characterSheet())

    expect(
      screen.getByText(
        'Nothing is written about Thorin Oakenshield in Foundry yet.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})

describe('components/character-sheet/biography-tab, with the character’s journal (module 0.35.0)', () => {
  const notes = {
    api: '/api/characters/char-1',
    role: 'player' as const,
    name: 'Thorin Oakenshield',
    active: true,
  }
  const renderWithNotes = (sheet: CharacterSheet = fullerSheet()) =>
    render(
      <BiographyTab
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(sheet, 'https://my-game.forge-vtt.com')}
        notes={notes}
      />,
    )

  beforeEach(() => {
    forgetNotes()
    serveNotes(
      { [notes.api]: emptyBook() },
      // The biography loads in the test that looks for it.
      () => new Promise<Response>(() => {}),
    )
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it('puts the journal’s card first, its h2 before Details’, then Personality, Appearance and Biography in dnd5e’s order', async () => {
    renderWithNotes()
    await screen.findByText('No notes yet')

    // The tab's own sections, in order.
    const tab = document.body.firstElementChild
      ?.firstElementChild as HTMLElement
    expect(
      [...tab.children]
        .filter(child => child.tagName === 'SECTION')
        .map(
          section =>
            within(section as HTMLElement).getAllByRole('heading')[0]
              .textContent,
        ),
    ).toEqual(['Journal', 'Details', 'Personality', 'Appearance', 'Biography'])
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual(['Journal', 'Details', 'Personality', 'Appearance', 'Biography'])
    const card = screen.getByRole('region', { name: 'Journal' })
    expect(card).toHaveTextContent('Only you and your Gamemaster see these.')
    expect(
      within(card).getByRole('button', { name: 'Open My Journal' }),
    ).toBeInTheDocument()
  })

  it('says, after the journal’s card, that nothing is written of the character in Foundry', async () => {
    renderWithNotes(characterSheet())
    await screen.findByText('No notes yet')
    const line = screen.getByText(
      'Nothing is written about Thorin Oakenshield in Foundry yet.',
    )
    const notesRegion = screen.getByRole('region', { name: 'Journal' })
    expect(
      notesRegion.compareDocumentPosition(line) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
  })
})

// Changed on purpose (round 0.39.0 §2.10): the Magical Recipe Book opens from the sheet's cog, and
// the Biography tab draws no card of it.
describe('components/character-sheet/biography-tab, and the player’s Magical Recipe Book (module 0.38.0)', () => {
  const notes = {
    api: '/api/characters/char-1',
    role: 'player' as const,
    name: 'Thorin Oakenshield',
    active: true,
  }

  beforeEach(() => {
    forgetNotes()
    serveNotes({ [notes.api]: emptyBook() }, async url =>
      url.startsWith('/api/characters/char-1/cookbook')
        ? ({
            status: 200,
            ok: true,
            json: async () => ({
              version: 'abcdef012345',
              enabled: true,
              live: true,
              link: null,
              dishes: [],
            }),
          } as Response)
        : // The biography loads in the test that looks for it.
          new Promise<Response>(() => {}),
    )
  })

  afterEach(() => {
    act(() => {
      forgetNotes()
      forgetCookbook()
    })
  })

  it('has no Magical Recipe Book card on the Biography tab, the journal’s card followed by Details, reading none', async () => {
    render(
      <BiographyTab
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), 'https://my-game.forge-vtt.com')}
        notes={notes}
      />,
    )
    await screen.findByText('No notes yet')
    expect(
      screen.queryByRole('region', { name: 'Magical Recipe Book' }),
    ).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Journal' }).nextElementSibling,
    ).toBe(screen.getByRole('region', { name: 'Details' }))
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual(['Journal', 'Details', 'Personality', 'Appearance', 'Biography'])
    expect(
      jest
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).includes('/cookbook')),
    ).toEqual([])
  })
})
