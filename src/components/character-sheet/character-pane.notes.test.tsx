/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { forgetNotes, hasDraft, useNotes } from '@/hooks/use-notes'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import { fullerSheet } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'

// The character's own journal on the sheet's Biography tab: its card (module 0.35.0).

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const API = '/api/characters/char-1'
const GAME = 'https://my-game.forge-vtt.com'
const notes = {
  api: API,
  role: 'player' as const,
  name: 'Thorin',
  active: true,
}

const pane = (withNotes = true) => (
  <CharacterPane
    characterId='char-1'
    name='Thorin Oakenshield'
    sheet={toTableSheet(fullerSheet(), GAME)}
    notes={withNotes ? notes : undefined}
  />
)

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Character sheet' }))

describe('components/character-sheet/character-pane, notes', () => {
  beforeEach(() => {
    forgetNotes()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    // The book; the sheet's own texts never come.
    serveNotes({ [API]: emptyBook() }, () => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it('shows the journal’s card on the Biography tab, and on no other', async () => {
    const user = userEvent.setup()
    render(pane())

    for (const tab of tabs().getAllByRole('tab')) {
      await user.click(tab)
      const shown = screen.queryByRole('region', { name: 'Journal' })
      if (tab.textContent === 'Biography') {
        expect(shown).toBeInTheDocument()
        expect(screen.getByRole('tabpanel')).toContainElement(shown)
      } else {
        expect(shown).toBeNull()
      }
    }
  })

  it('keeps its seven tabs, adding none for the notes', () => {
    render(pane())
    expect(
      tabs()
        .getAllByRole('tab')
        .map(tab => tab.textContent),
    ).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Spells',
      'Features',
      'Effects, 3 conditions',
      'Biography',
    ])
  })

  it('shows no notes without where to find them, as before', async () => {
    const user = userEvent.setup()
    render(pane(false))
    await user.click(tabs().getByRole('tab', { name: 'Biography' }))
    expect(screen.queryByRole('region', { name: 'Journal' })).toBeNull()
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/notes'),
      expect.anything(),
    )
  })

  it('keeps an editor’s text, the journal closed, across another tab and back', async () => {
    const user = userEvent.setup()
    render(pane())
    await user.click(tabs().getByRole('tab', { name: 'Biography' }))
    await user.click(
      await screen.findByRole('button', { name: 'Open My Journal' }),
    )
    await user.click(await screen.findByRole('button', { name: 'New note' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    await user.type(
      screen.getByRole('textbox', { name: 'Note' }),
      'Three of them.',
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(tabs().getByRole('tab', { name: 'Inventory' }))
    expect(screen.queryByRole('form')).toBeNull()
    await user.click(tabs().getByRole('tab', { name: 'Biography' }))
    expect(screen.getByText('Unsaved: Wolves')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open My Journal' }))

    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Wolves',
    )
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue(
      'Three of them.',
    )
  })

  it('opens on Biography where a note is being written, and on Character where not', async () => {
    const { unmount } = render(pane())
    expect(tabs().getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    unmount()

    // A note started elsewhere, as under why there was no sheet.
    const { result } = renderHook(() => useNotes(API, { active: false }))
    act(() =>
      result.current.setDraft({
        key: 'new',
        role: 'entry',
        title: 'Wolves',
        body: '',
        chapterId: null,
        started: { title: '', body: '', chapterId: null },
        opener: 'new',
      }),
    )
    expect(hasDraft(API)).toBe(true)

    render(pane())
    expect(tabs().getByRole('tab', { name: 'Biography' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // The journal never opens by itself: the draft waits on the card.
    expect(await screen.findByText('Unsaved: Wolves')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens on Biography where the journal is open, as under why there was no sheet, the journal open there', async () => {
    const { result } = renderHook(() => useNotes(API, { active: false }))
    act(() => result.current.setOpen(true))
    expect(hasDraft(API)).toBe(false)

    render(pane())
    expect(tabs().getByRole('tab', { name: 'Biography' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('dialog', { name: 'My Journal' }),
    ).toBeInTheDocument()
  })
})
