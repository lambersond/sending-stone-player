/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { forgetNotes, hasDraft, useNotes } from '@/hooks/use-notes'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import { fullerSheet } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'

// The character's own journal notes on the sheet's Biography tab (module 0.34.0).

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

  it('shows the notes on the Biography tab, and on no other', async () => {
    const user = userEvent.setup()
    render(pane())

    for (const tab of tabs().getAllByRole('tab')) {
      await user.click(tab)
      const shown = screen.queryByRole('region', { name: 'Notes' })
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
    expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull()
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/notes'),
      expect.anything(),
    )
  })

  it('keeps an open editor’s text across another tab and back', async () => {
    const user = userEvent.setup()
    render(pane())
    await user.click(tabs().getByRole('tab', { name: 'Biography' }))
    await user.click(await screen.findByRole('button', { name: 'New note' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    await user.type(
      screen.getByRole('textbox', { name: 'Note' }),
      'Three of them.',
    )

    await user.click(tabs().getByRole('tab', { name: 'Inventory' }))
    expect(screen.queryByRole('form')).toBeNull()
    await user.click(tabs().getByRole('tab', { name: 'Biography' }))

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Wolves')
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
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Wolves',
    )
  })
})
