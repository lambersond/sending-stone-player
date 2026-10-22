/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalCard } from './journal-card'
import { useKeyboardInset } from '@/hooks/use-keyboard-inset'
import { forgetNotes, hasDraft, journalOpen, useNotes } from '@/hooks/use-notes'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import type { NotesView } from '@/types/notes'

jest.mock('@/hooks/use-keyboard-inset', () => ({
  useKeyboardInset: jest.fn(),
}))

const API = '/api/characters/char-1'
const PARTY_API = '/api/characters/char-1/party/company'

type Props = Parameters<typeof JournalCard>[0]

/** A time this many minutes ago. */
const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * Thorin's book: a note in no chapter, and two in Session 1, the goblin cave the one changed most
 * recently; in reading order, the rumour, the goblin cave, then the wolves.
 */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    chapters: [noteChapter({ createdAt: ago(90), modifiedAt: ago(90) })],
    groups: [
      { chapterId: null, state: 'synced', stamp: 'g:loose00000000000' },
      {
        chapterId: 'sessionChapter01',
        state: 'synced',
        stamp: 'g:session10000000',
      },
    ],
    entries: [
      noteEntry({
        id: 'rumourNote000001',
        title: 'A rumour',
        createdAt: ago(30),
        modifiedAt: ago(30),
      }),
      noteEntry({
        chapterId: 'sessionChapter01',
        createdAt: ago(60),
        modifiedAt: ago(5),
      }),
      noteEntry({
        id: 'wolvesNote000001',
        title: 'Wolves',
        chapterId: 'sessionChapter01',
        createdAt: ago(20),
        modifiedAt: ago(20),
      }),
    ],
    ...fields,
  })

const renderCard = (props: Partial<Props> = {}) =>
  render(
    <JournalCard
      api={API}
      role='player'
      kind='personal'
      name='Thorin'
      active
      look='sheet'
      {...props}
    />,
  )

/** The card, its journal opened from it. */
const openJournal = async (
  user: ReturnType<typeof userEvent.setup>,
  title = 'My Journal',
) => {
  await user.click(await screen.findByRole('button', { name: `Open ${title}` }))
  return screen.findByRole('dialog', { name: title })
}

const reader = (dialog: HTMLElement) =>
  within(dialog).getByRole('heading', { level: 3 })
const header = (dialog: HTMLElement) =>
  dialog.querySelector('header') as HTMLElement
const contents = (dialog: HTMLElement) =>
  within(dialog).getByRole('navigation', { name: 'Contents' })

/**
 * The browser's own Escape, as jsdom has none: a key nothing prevented closes the topmost modal
 * dialog, firing its close. The last key pressed is kept, to read whether it was prevented.
 */
let pressed: KeyboardEvent | undefined
const keep = (event: KeyboardEvent) => {
  pressed = event
}
const browserEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const open = [...document.querySelectorAll('dialog')].filter(
    dialog => dialog.open,
  )
  open.at(-1)?.close()
}

/** The icon beside what the header says: a change's check, or a refusal's warning. */
const iconOf = (said: HTMLElement) =>
  said.querySelector('svg')?.getAttribute('class') ?? ''

/** The modal this wide, as its ResizeObserver measures it. */
const original = globalThis.ResizeObserver
const atWidth = (width: number) => {
  globalThis.ResizeObserver = jest.fn(
    (callback: ResizeObserverCallback) =>
      ({
        observe: () =>
          callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            {} as ResizeObserver,
          ),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }) as unknown as ResizeObserver,
  ) as unknown as typeof ResizeObserver
}

/** A note half-written in the journal. */
const halfWritten = async () => {
  const user = userEvent.setup()
  serveNotes({ [API]: book() })
  renderCard()
  const dialog = await openJournal(user)
  await user.click(
    await within(dialog).findByRole('button', { name: 'New note' }),
  )
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Title' }),
    'Wolves',
  )
  return { user, dialog }
}

const closedKeepingTheDraft = async () => {
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(journalOpen(API)).toBe(false)
  expect(hasDraft(API)).toBe(true)
  expect(screen.getByText('Unsaved: Wolves')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open My Journal' })).toHaveFocus()
}

/** Deletes the note shown, from its bar, through its confirm. */
const deleteShown = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  title: string,
) => {
  await user.click(
    within(dialog).getByRole('button', { name: `Delete ${title}` }),
  )
  await user.click(
    within(screen.getByRole('dialog', { name: `Delete ${title}?` })).getByRole(
      'button',
      { name: 'Delete' },
    ),
  )
}

/**
 * The browser's modal dialogs' focus, as jsdom has none: while one is open nothing outside the
 * topmost takes focus, and one closing gives focus back to what had it as it opened, if that's
 * still there. Returns what puts jsdom's own back.
 */
const browserDialogFocus = () => {
  const { showModal, close } = HTMLDialogElement.prototype
  const { focus } = HTMLElement.prototype
  const shown: { dialog: HTMLDialogElement; from: Element | null }[] = []
  class Dialog extends HTMLDialogElement {
    override showModal() {
      shown.push({ dialog: this, from: document.activeElement })
      showModal.call(this)
    }

    override close() {
      const at = shown.findIndex(({ dialog }) => dialog === this)
      const from = at === -1 ? undefined : shown.splice(at, 1)[0]?.from
      close.call(this)
      if (from instanceof HTMLElement && from.isConnected) focus.call(from)
    }
  }
  class Focusable extends HTMLElement {
    override focus(options?: FocusOptions) {
      const top = shown.at(-1)?.dialog
      if (top && !top.contains(this)) return
      focus.call(this, options)
    }
  }
  HTMLDialogElement.prototype.showModal = Dialog.prototype.showModal
  HTMLDialogElement.prototype.close = Dialog.prototype.close
  HTMLElement.prototype.focus = Focusable.prototype.focus
  return () => {
    HTMLDialogElement.prototype.showModal = showModal
    HTMLDialogElement.prototype.close = close
    HTMLElement.prototype.focus = focus
  }
}

/** The journal open on Session 1's page. */
const onSession = async (fields: Partial<NotesView> = {}) => {
  jest.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  const server = serveNotes({ [API]: book(fields) })
  renderCard()
  const dialog = await openJournal(user)
  await user.click(
    await within(contents(dialog)).findByRole('button', {
      name: 'Session 1',
    }),
  )
  return { user, server, dialog }
}

describe('components/notes/journal-modal', () => {
  beforeEach(() => {
    forgetNotes()
    pressed = undefined
    globalThis.addEventListener('keydown', keep, true)
    globalThis.addEventListener('keydown', browserEscape)
  })

  afterEach(() => {
    act(() => forgetNotes())
    globalThis.removeEventListener('keydown', keep, true)
    globalThis.removeEventListener('keydown', browserEscape)
    globalThis.ResizeObserver = original
    jest.useRealTimers()
  })

  it('is a modal dialog named by its h2, which takes focus as it opens', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    const title = within(dialog).getByRole('heading', {
      level: 2,
      name: 'My Journal',
    })
    expect(dialog).toHaveAttribute('open')
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('tabindex', '-1')
  })

  it('sizes itself to the screen: full on a phone, at most 960 × 880 from 640 px', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    expect(dialog).toHaveClass(
      'm-0',
      'h-dvh',
      'w-full',
      'rounded-none',
      'sm:w-[min(960px,calc(100%-2rem))]',
      'sm:h-[min(880px,calc(100dvh-4rem))]',
      'sm:min-h-[min(600px,calc(100dvh-1rem))]',
      'sm:rounded-2xl',
      'motion-safe:animate-journal-pop',
    )
  })

  it('says it’s read only where nothing in it can be changed', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book({ canAdd: false }) })
    renderCard()
    const dialog = await openJournal(user)
    await within(dialog).findByText('Read only')
    expect(
      within(dialog).queryByRole('button', { name: 'New note' }),
    ).toBeNull()
  })

  it('isn’t read only where it can be written in', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    await within(dialog).findByRole('button', { name: 'New note' })
    expect(within(dialog).queryByText('Read only')).toBeNull()
  })

  it.each([
    [
      'a player’s',
      {},
      'My Journal',
      'You and your Gamemaster',
      'Only you and your Gamemaster see these.',
    ],
    [
      'the Gamemaster’s view of a character’s',
      { role: 'gm' as const },
      'Thorin’s Journal',
      'Thorin’s player and you',
      'Only Thorin’s player and you see these.',
    ],
    [
      'a party’s',
      { api: PARTY_API, kind: 'party' as const, name: 'The Iron Company' },
      'The Iron Company’s Journal',
      'Everyone in The Iron Company',
      'Everyone in The Iron Company sees these, here and in Foundry.',
    ],
  ])(
    'says in short who sees %s journal, the whole sentence its title',
    async (_, props, title, short, whole) => {
      const user = userEvent.setup()
      serveNotes({ [(props as Partial<Props>).api ?? API]: book() })
      renderCard(props)
      const dialog = await openJournal(user, title)
      const who = within(dialog).getByText(short)
      expect(who).toHaveAttribute('title', whole)
    },
  )

  describe('whether it’s up to date with Foundry', () => {
    it.each([
      ['the game closed', { live: false }, 'Game closed'],
      [
        'the game closed, with changes waiting, deletes and orders too',
        {
          live: false,
          chapters: [noteChapter({ state: 'waiting' })],
          entries: [
            noteEntry({ state: 'waiting' }),
            noteEntry({ id: 'deletingNote0001', state: 'deleting' }),
            noteEntry({ id: 'savedNote0000001' }),
          ],
          groups: [
            { chapterId: null, state: 'waiting' as const, stamp: 'g:1' },
          ],
        },
        'Game closed · 4 waiting',
      ],
    ])('says so with %s', async (_, fields, words) => {
      const user = userEvent.setup()
      serveNotes({ [API]: book(fields) })
      renderCard()
      const dialog = await openJournal(user)
      const status = await within(dialog).findByText(words)
      expect(status).toHaveAttribute(
        'title',
        'Changes are kept here and reach Foundry when your Gamemaster’s game is next open.',
      )
      expect(status).toHaveClass('text-warning')
    })

    it.each([
      ['a note', { entries: [noteEntry({ state: 'saving' })] }],
      ['a chapter', { chapters: [noteChapter({ state: 'saving' })] }],
      [
        'an order',
        {
          groups: [{ chapterId: null, state: 'saving' as const, stamp: 'g:1' }],
        },
      ],
    ])('says it’s saving while %s is on its way', async (_, fields) => {
      const user = userEvent.setup()
      serveNotes({ [API]: book(fields) })
      renderCard()
      const dialog = await openJournal(user)
      expect(
        await within(header(dialog)).findByText('Saving to the game…'),
      ).toBeInTheDocument()
    })

    it('says how many wait, live, where an order is kept for a module before 0.35.0', async () => {
      const user = userEvent.setup()
      serveNotes({
        [API]: book({
          orders: false,
          groups: [{ chapterId: null, state: 'waiting', stamp: 'g:1' }],
        }),
      })
      renderCard()
      const dialog = await openJournal(user)
      expect(await within(dialog).findByText('1 waiting')).toHaveAttribute(
        'title',
        'The new order reaches Foundry once your Gamemaster’s game connects with Sending Stone 0.35.0 or later.',
      )
    })

    it('says it’s up to date, shorter in a narrow modal', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      const long = await within(dialog).findByText('Up to date with Foundry')
      const short = within(dialog).getByText('Synced')
      expect(long).toHaveClass('@max-[479px]:hidden')
      expect(short).toHaveClass('@min-[480px]:hidden')
      expect(long.parentElement).toHaveAttribute(
        'title',
        'Up to date with Foundry',
      )
    })
  })

  it('says who changed anything in it last, and when, with what that counts as its title', async () => {
    const user = userEvent.setup()
    serveNotes({
      [API]: book({ lastChange: { by: 'Gamemaster', at: ago(0) } }),
    })
    renderCard()
    const dialog = await openJournal(user)
    const line = await within(header(dialog)).findByText(
      /^Last changed by Gamemaster/,
    )
    expect(line).toHaveTextContent('Last changed by Gamemaster, just now')
    expect(line.parentElement).toHaveAttribute(
      'title',
      'The last change to anything in this journal, by anyone: a note or chapter added, changed, moved, reordered or deleted',
    )
  })

  it('says no last change for a journal never changed', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    await within(dialog).findByText('Up to date with Foundry')
    expect(within(header(dialog)).queryByText(/^Last changed by/)).toBeNull()
  })

  describe('its live status', () => {
    it('says it’s loading before the first view, in a live region that’s no status', async () => {
      globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
      const user = userEvent.setup()
      renderCard()
      const dialog = await openJournal(user)
      const loading = within(dialog).getByText('Loading notes…')
      expect(loading).toHaveAttribute('aria-live', 'polite')
      expect(loading).not.toHaveAttribute('role')
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('says what was done, as it’s sending and once it’s done, and clears it after 6 seconds', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const server = serveNotes({ [API]: book() })
      // Writes wait till they're let go.
      const served = globalThis.fetch
      let letGo: (() => void) | undefined
      globalThis.fetch = jest.fn(
        async (url: string, init: RequestInit = {}) => {
          if ((init.method ?? 'GET') !== 'GET') {
            await new Promise<void>(resolve => {
              letGo = resolve
            })
          }
          return served(url, init)
        },
      ) as typeof fetch
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', { name: 'New note' }),
      )
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Title' }),
        'Wolves',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      const live = dialog.querySelector('[aria-live="polite"]') as HTMLElement
      await waitFor(() => expect(live).toHaveTextContent('Sending…'))
      expect(
        dialog.querySelector(
          '[aria-hidden] .animate-journal-bar, [aria-hidden] [class*="journal-bar"]',
        ),
      ).not.toBeNull()

      await act(async () => letGo?.())
      await waitFor(() => expect(live).toHaveTextContent('Saved.'))
      expect(server.sent).toHaveLength(1)
      expect(screen.queryByRole('status')).toBeNull()
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000)
      })
      expect(live).toBeEmptyDOMElement()
    })
  })

  describe('closing', () => {
    it('closes from Close, keeping the draft', async () => {
      const { user, dialog } = await halfWritten()
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await closedKeepingTheDraft()
    })

    it('closes from a click on the backdrop, keeping the draft', async () => {
      const { dialog } = await halfWritten()
      fireEvent.click(dialog)
      await closedKeepingTheDraft()
    })

    it('closes on Escape, keeping the draft, and asks nothing', async () => {
      const { user } = await halfWritten()
      await user.keyboard('{Escape}')
      expect(pressed?.defaultPrevented).toBe(false)
      await closedKeepingTheDraft()
      expect(
        screen.queryByRole('dialog', { name: 'Discard your changes?' }),
      ).toBeNull()
    })

    it('opens again on the editor, with its text and focus in its title', async () => {
      const { user, dialog } = await halfWritten()
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      const again = await openJournal(user)
      const title = within(again).getByRole('textbox', { name: 'Title' })
      expect(title).toHaveValue('Wolves')
      expect(title).toHaveFocus()
    })
  })

  it('closes the drawer alone on Escape, the key prevented, and gives focus back to Contents', async () => {
    atWidth(390)
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    const button = await within(dialog).findByRole('button', {
      name: 'Contents',
    })
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(dialog).getByRole('button', { name: 'Close contents' }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(pressed?.defaultPrevented).toBe(true)
    expect(dialog).toHaveAttribute('open')
    expect(journalOpen(API)).toBe(true)
    expect(
      within(dialog).getByRole('button', { name: 'Contents' }),
    ).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Contents' }),
      ).toHaveFocus(),
    )
    // Pressed again, it's the dialog's.
    await user.keyboard('{Escape}')
    expect(pressed?.defaultPrevented).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it.each([
    ['its key code 229', { keyCode: 229 }],
    ['composing', { isComposing: true }],
  ])(
    'leaves the drawer open on an Escape that ends a composition (%s), the key not prevented',
    async (_, composing) => {
      atWidth(390)
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', { name: 'Contents' }),
      )
      const search = within(dialog).getByRole('searchbox', {
        name: 'Search notes',
      })
      // The input method's Escape, which no browser takes as a request to close.
      globalThis.removeEventListener('keydown', browserEscape)
      fireEvent.keyDown(search, { key: 'Escape', ...composing })
      expect(pressed?.defaultPrevented).toBe(false)
      expect(
        within(dialog).getByRole('button', { name: 'Contents' }),
      ).toHaveAttribute('aria-expanded', 'true')
    },
  )

  it('leaves Escape in Delete’s confirm, opened over the open drawer, to the confirm alone', async () => {
    atWidth(390)
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    await user.click(
      await within(dialog).findByRole('button', { name: 'Contents' }),
    )
    // The reader isn't inert while the drawer is open: Tab reaches its Delete.
    const remove = within(dialog).getByRole('button', {
      name: 'Delete The goblin cave',
    })
    expect(remove.closest('[inert]')).toBeNull()
    act(() => remove.focus())
    await user.keyboard('{Enter}')
    const asked = screen.getByRole('dialog', {
      name: 'Delete The goblin cave?',
    })
    await waitFor(() => expect(asked).toHaveAttribute('open'))
    act(() => within(asked).getByRole('button', { name: 'Cancel' }).focus())

    await user.keyboard('{Escape}')

    expect(pressed?.defaultPrevented).toBe(false)
    expect(asked).not.toHaveAttribute('open')
    expect(dialog).toHaveAttribute('open')
    expect(
      within(dialog).getByRole('button', { name: 'Contents' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('leaves Escape to the search first, which clears what’s typed', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    const search = await within(dialog).findByRole('searchbox', {
      name: 'Search notes',
    })
    await user.type(search, 'gob')
    await user.keyboard('{Escape}')
    expect(pressed?.defaultPrevented).toBe(true)
    expect(search).toHaveValue('')
    expect(dialog).toHaveAttribute('open')
  })

  it('starts afresh at each opening: what was searched is gone', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    const dialog = await openJournal(user)
    await user.type(
      await within(dialog).findByRole('searchbox', { name: 'Search notes' }),
      'wolves',
    )
    expect(
      within(contents(dialog)).queryByRole('button', { name: 'A rumour' }),
    ).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    const again = await openJournal(user)
    expect(
      within(again).getByRole('searchbox', { name: 'Search notes' }),
    ).toHaveValue('')
    expect(
      within(contents(again)).getByRole('button', { name: 'A rumour' }),
    ).toBeInTheDocument()
  })

  describe('what the reader shows', () => {
    it('opens on the note changed most recently, and so again after it was closed', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await waitFor(() =>
        expect(reader(dialog)).toHaveTextContent('The goblin cave'),
      )
      await user.click(
        within(contents(dialog)).getByRole('button', { name: 'Wolves' }),
      )
      expect(reader(dialog)).toHaveTextContent('Wolves')
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))

      const again = await openJournal(user)
      await waitFor(() =>
        expect(reader(again)).toHaveTextContent('The goblin cave'),
      )
    })

    it('shows the note it showed where the card is mounted again while it’s open, as the sheet arrives', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      const { unmount } = renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', { name: 'Wolves' }),
      )
      unmount()

      renderCard()
      const again = await screen.findByRole('dialog', { name: 'My Journal' })
      await waitFor(() => expect(reader(again)).toHaveTextContent('Wolves'))
    })

    it('opens on the draft’s note where the draft is a change to one', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      const { result } = renderHook(() => useNotes(API, { active: false }))
      act(() =>
        result.current.setDraft({
          key: 'wolvesNote000001',
          role: 'entry',
          title: 'Wolves, changed',
          body: '',
          chapterId: 'sessionChapter01',
          stamp: 'n:0000000000000c',
          started: { title: 'Wolves', body: '', chapterId: 'sessionChapter01' },
          opener: 'edit',
        }),
      )
      renderCard()
      const dialog = await openJournal(user)
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Discard your changes?' }),
        ).getByRole('button', { name: 'Discard' }),
      )
      await waitFor(() => expect(reader(dialog)).toHaveTextContent('Wolves'))
    })

    it('opens on the last chapter where no note is written yet', async () => {
      const user = userEvent.setup()
      serveNotes({
        [API]: book({
          entries: [],
          chapters: [
            noteChapter(),
            noteChapter({ id: 'secondChapter001', title: 'Session 2' }),
          ],
        }),
      })
      renderCard()
      const dialog = await openJournal(user)
      await waitFor(() => expect(reader(dialog)).toHaveTextContent('Session 2'))
    })

    it('gives way to the next note, then the one before, then the group, as the note shown leaves the view', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const server = serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', {
          name: 'The goblin cave',
        }),
      )
      const remove = async (id: string) => {
        const held = server.books[API]
        held.entries = held.entries.filter(note => note.id !== id)
        held.version += 1
        await act(async () => {
          await jest.advanceTimersByTimeAsync(POLL_INTERVAL)
        })
      }
      await remove('goblinCaveNote01')
      expect(reader(dialog)).toHaveTextContent('Wolves')
      await remove('wolvesNote000001')
      expect(reader(dialog)).toHaveTextContent('A rumour')
      await remove('rumourNote000001')
      expect(reader(dialog)).toHaveTextContent('Not in a chapter')
    })
  })

  it('shows its empty page in place of the contents and the reader', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: emptyBook() })
    renderCard()
    const dialog = await openJournal(user)
    expect(await within(dialog).findByText('No notes yet')).toBeInTheDocument()
    expect(within(dialog).queryByRole('navigation')).toBeNull()
    await user.click(
      within(dialog).getByRole('button', { name: 'New chapter' }),
    )
    expect(
      within(dialog).getByRole('textbox', { name: 'Chapter title' }),
    ).toHaveFocus()
  })

  describe('its banner', () => {
    it.each([
      [
        'its character gone from the campaign',
        { connected: false, canAdd: false, enabled: false },
        'Thorin is no longer one of the campaign’s characters, so these notes can’t be changed.',
      ],
      [
        'a module too old to take notes',
        {
          enabled: false,
          orders: false,
          groups: [
            { chapterId: null, state: 'waiting' as const, stamp: 'g:1' },
          ],
        },
        'Notes are kept here for now. They reach Foundry once your Gamemaster’s game connects with Sending Stone 0.34.0 or later.',
      ],
      [
        'a module too old to take orders, with one waiting',
        {
          orders: false,
          groups: [
            { chapterId: null, state: 'waiting' as const, stamp: 'g:1' },
          ],
          withheld: { reason: 'tooLarge' as const },
        },
        'The new order is kept here for now. It reaches Foundry once your Gamemaster’s game connects with Sending Stone 0.35.0 or later.',
      ],
      [
        'a journal too large to send',
        {
          journal: 'Thorin’s notes',
          withheld: { reason: 'tooLarge' as const },
        },
        '“Thorin’s notes” is too large to send from Foundry, so changes made there don’t show here.',
      ],
      [
        'a party no player may see',
        { withheld: { reason: 'private' as const }, canAdd: false },
        'No player can see Thorin in Foundry, so its notes aren’t shared.',
      ],
    ])(
      'shows the first that applies, under the header, for %s',
      async (_, fields, words) => {
        const user = userEvent.setup()
        serveNotes({ [API]: book(fields) })
        renderCard()
        const dialog = await openJournal(user)
        const banner = await within(dialog).findByText(words)
        expect(banner).not.toHaveAttribute('role')
        expect(banner.previousElementSibling?.localName).toBe('header')
      },
    )

    it('shows none for a module that takes orders, or one with none waiting', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book({ orders: false }) })
      renderCard()
      const dialog = await openJournal(user)
      await within(dialog).findByText('Up to date with Foundry')
      expect(within(dialog).queryByText(/kept here for now/)).toBeNull()
    })
  })

  it('places itself above an on-screen keyboard while it’s open', async () => {
    jest
      .mocked(useKeyboardInset)
      .mockImplementation(active =>
        active ? { top: '8px', maxHeight: '400px' } : undefined,
      )
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    expect(useKeyboardInset).toHaveBeenLastCalledWith(false)
    const dialog = await openJournal(user)
    expect(useKeyboardInset).toHaveBeenLastCalledWith(true)
    expect(dialog).toHaveStyle({ top: '8px', maxHeight: '400px' })
  })

  it('scrolls as a whole while it’s too short for its header, a pane’s bar and footer and the fields between, as over a sideways phone’s keyboard, Cancel and Save kept in view', async () => {
    // The modal 812 px wide, as a phone turned sideways, and as tall as a keyboard leaves it.
    let resize: ((height: number) => void) | undefined
    globalThis.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      resize = height =>
        callback(
          [{ contentRect: { width: 812, height } } as ResizeObserverEntry],
          {} as ResizeObserver,
        )
      return {
        observe: () => resize?.(600),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as ResizeObserver
    }) as unknown as typeof ResizeObserver
    const scrolled = jest.fn()
    Element.prototype.scrollIntoView = scrolled
    try {
      const { dialog } = await halfWritten()
      const journal = header(dialog).parentElement as HTMLElement
      const form = within(dialog).getByRole('form', { name: 'New note' })
      const body = form.parentElement as HTMLElement
      const footer = form.lastElementChild as HTMLElement
      expect(footer).toContainElement(
        within(dialog).getByRole('button', { name: 'Save' }),
      )
      expect(footer).toHaveClass('border-t', 'bg-card')
      expect(journal).not.toHaveClass('overflow-y-auto')
      expect(body).toHaveClass('min-h-0', 'flex-1')

      // A keyboard comes up under the title: 180 px of the modal are left.
      act(() => resize?.(180))
      // The header scrolls away above the reader, which keeps 320 px for its bar, its fields and
      // its footer; the footer stays at the bottom of what shows, and what's brought into view
      // is kept clear of it.
      expect(journal).toHaveClass('overflow-y-auto', 'scroll-pb-20')
      expect(body).toHaveClass('h-80', 'shrink-0')
      expect(body).not.toHaveClass('flex-1')
      for (const sticks of ['sticky', 'bottom-0', 'z-10']) {
        expect(body).toHaveClass(`[&>*>.border-t.bg-card:last-child]:${sticks}`)
      }
      // The title, being typed in, is brought back into view.
      const title = within(dialog).getByRole('textbox', { name: 'Title' })
      expect(title).toHaveFocus()
      expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' })
      expect(scrolled.mock.contexts.at(-1)).toBe(title)

      // The keyboard down, it's laid out as before.
      act(() => resize?.(600))
      expect(journal).not.toHaveClass('overflow-y-auto')
      expect(body).toHaveClass('min-h-0', 'flex-1')
      expect(body).not.toHaveClass('h-80')
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  describe('Delete', () => {
    it('asks first, then deletes, says so and shows the next note with focus on it', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Delete The goblin cave',
        }),
      )
      const asked = screen.getByRole('dialog', {
        name: 'Delete The goblin cave?',
      })
      expect(asked).toHaveTextContent(
        'It’s deleted from Foundry’s journal too.',
      )
      expect(asked).not.toHaveTextContent('That happens when')
      await user.click(within(asked).getByRole('button', { name: 'Delete' }))

      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes/goblinCaveNote01?stamp=n%3A0000000000000c`,
        method: 'DELETE',
        body: undefined,
      })
      await waitFor(() => expect(reader(dialog)).toHaveTextContent('Wolves'))
      await waitFor(() => expect(reader(dialog)).toHaveFocus())
      const deleted = within(dialog).getByText('Deleted.')
      expect(deleted).toHaveClass('text-primary-text')
      expect(iconOf(deleted)).toMatch(/\blucide-check\b/)
    })

    it('gives the next note’s h3 focus once the confirm has closed, as a browser’s dialogs allow', async () => {
      const restore = browserDialogFocus()
      try {
        const user = userEvent.setup()
        serveNotes({ [API]: book() })
        renderCard()
        const dialog = await openJournal(user)
        await deleteShown(user, dialog, 'The goblin cave')
        await waitFor(() => expect(reader(dialog)).toHaveTextContent('Wolves'))
        await waitFor(() =>
          expect(
            screen.queryByRole('dialog', { name: 'Delete The goblin cave?' }),
          ).toBeNull(),
        )
        await waitFor(() => expect(reader(dialog)).toHaveFocus())
      } finally {
        restore()
      }
    })

    it('moves on from a note the game deletes later, still listed till then', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book({ live: false }) })
      server.answer = sent => {
        if (sent.method !== 'DELETE') return
        const kept = server.books[API]
        const entry = kept.entries.find(({ id }) => id === 'goblinCaveNote01')
        if (entry) entry.state = 'deleting'
        kept.version += 1
        return { status: 200, body: {} }
      }
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Delete The goblin cave',
        }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Delete The goblin cave?' }),
        ).getByRole('button', { name: 'Delete' }),
      )
      await waitFor(() => expect(reader(dialog)).toHaveTextContent('Wolves'))
      await waitFor(() => expect(reader(dialog)).toHaveFocus())
      expect(
        within(contents(dialog)).getByRole('button', {
          name: 'The goblin cave',
        }),
      ).toBeInTheDocument()
    })

    it('shows the note before where it deleted the last in reading order', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', { name: 'Wolves' }),
      )
      await deleteShown(user, dialog, 'Wolves')
      await waitFor(() =>
        expect(reader(dialog)).toHaveTextContent('The goblin cave'),
      )
      await waitFor(() => expect(reader(dialog)).toHaveFocus())
    })

    it('shows its group’s page where it deleted the book’s only note', async () => {
      const user = userEvent.setup()
      serveNotes({
        [API]: book({
          entries: [noteEntry({ chapterId: 'sessionChapter01' })],
        }),
      })
      renderCard()
      const dialog = await openJournal(user)
      await waitFor(() =>
        expect(reader(dialog)).toHaveTextContent('The goblin cave'),
      )
      await deleteShown(user, dialog, 'The goblin cave')
      await waitFor(() => expect(reader(dialog)).toHaveTextContent('Session 1'))
      await waitFor(() => expect(reader(dialog)).toHaveFocus())
    })

    it('says when it happens in Foundry while the game is closed', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book({ live: false }) })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Delete The goblin cave',
        }),
      )
      expect(
        screen.getByRole('dialog', { name: 'Delete The goblin cave?' }),
      ).toHaveTextContent(
        'It’s deleted from Foundry’s journal too. That happens when your Gamemaster’s game is next open.',
      )
    })

    it('says why where it’s refused, the note still shown', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      server.answer = () => ({ status: 409, body: { reason: 'saving' } })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Delete The goblin cave',
        }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Delete The goblin cave?' }),
        ).getByRole('button', { name: 'Delete' }),
      )
      const refused = await within(dialog).findByText(
        'Its last change is still on its way to the game. Try again in a moment.',
      )
      // Said as a warning, not with the check of a change that was made.
      expect(refused).toHaveClass('text-warning')
      expect(refused).not.toHaveClass('text-primary-text')
      expect(iconOf(refused)).not.toMatch(/\blucide-check\b/)
      expect(iconOf(refused)).toMatch(/\blucide-triangle-alert\b/)
      expect(reader(dialog)).toHaveTextContent('The goblin cave')
    })
  })

  describe('Move to chapter', () => {
    it('sends the change Edit’s Chapter field sends, from the note’s stamp, and says where it went', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', {
          name: 'A rumour',
        }),
      )
      await user.click(
        within(dialog).getByRole('button', {
          name: 'Move A rumour to a chapter',
        }),
      )
      await user.click(screen.getByRole('menuitemradio', { name: 'Session 1' }))

      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes/rumourNote000001`,
        method: 'PATCH',
        body: {
          title: 'A rumour',
          chapterId: 'sessionChapter01',
          stamp: 'n:0000000000000c',
        },
      })
      expect(
        await within(dialog).findByText('Moved to Session 1.'),
      ).toBeInTheDocument()
      // Still shown, last in its new chapter.
      expect(reader(dialog)).toHaveTextContent('A rumour')
      expect(within(dialog).getAllByText('Chapter 1')).not.toHaveLength(0)
      expect(within(dialog).getByText('3 of 3')).toBeInTheDocument()
      await waitFor(() => expect(reader(dialog)).toHaveFocus())
    })

    it('says a note left its chapter, and why a move was refused', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Move The goblin cave to a chapter',
        }),
      )
      await user.click(
        screen.getByRole('menuitemradio', { name: 'No chapter' }),
      )
      expect(server.sent.at(-1)?.body).toEqual({
        title: 'The goblin cave',
        chapterId: null,
        stamp: 'n:0000000000000c',
      })
      const moved = await within(dialog).findByText('Moved out of its chapter.')
      expect(iconOf(moved)).toMatch(/\blucide-check\b/)

      server.answer = () => ({ status: 409, body: { reason: 'changed' } })
      await user.click(
        within(dialog).getByRole('button', {
          name: 'Move The goblin cave to a chapter',
        }),
      )
      await user.click(screen.getByRole('menuitemradio', { name: 'Session 1' }))
      const refused = await within(dialog).findByText(
        'It changed meanwhile: here’s how it stands now.',
      )
      expect(refused).toHaveClass('text-warning')
      expect(iconOf(refused)).not.toMatch(/\blucide-check\b/)
    })

    it('turns Move off, with a spinner, while a move is on its way', async () => {
      const user = userEvent.setup()
      serveNotes({ [API]: book() })
      // The move waits till it's let go.
      const served = globalThis.fetch
      let letGo: (() => void) | undefined
      globalThis.fetch = jest.fn(
        async (url: string, init: RequestInit = {}) => {
          if (init.method === 'PATCH') {
            await new Promise<void>(resolve => {
              letGo = resolve
            })
          }
          return served(url, init)
        },
      ) as typeof fetch
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', {
          name: 'A rumour',
        }),
      )
      const move = () =>
        within(dialog).getByRole('button', {
          name: 'Move A rumour to a chapter',
        })
      await user.click(move())
      await user.click(screen.getByRole('menuitemradio', { name: 'Session 1' }))
      await waitFor(() => expect(letGo).toBeDefined())
      expect(move()).toBeDisabled()
      expect(
        move().querySelector('.animate-spin, [class*="animate-spin"]'),
      ).not.toBeNull()

      await act(async () => letGo?.())
      expect(
        await within(dialog).findByText('Moved to Session 1.'),
      ).toBeInTheDocument()
      expect(move()).toBeEnabled()
    })

    it('moves a note in no chapter from its card', async () => {
      const user = userEvent.setup()
      const server = serveNotes({ [API]: book() })
      renderCard()
      const dialog = await openJournal(user)
      await user.click(
        await within(contents(dialog)).findByRole('button', {
          name: 'Not in a chapter',
        }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Move to chapter' }),
      )
      await user.click(screen.getByRole('menuitemradio', { name: 'Session 1' }))
      expect(server.sent.at(-1)?.body).toEqual({
        title: 'A rumour',
        chapterId: 'sessionChapter01',
        stamp: 'n:0000000000000c',
      })
      expect(
        await within(dialog).findByText('Moved to Session 1.'),
      ).toBeInTheDocument()
    })
  })

  describe('Reorder', () => {
    it('sends the new order from the group’s stamp as Reorder opened, not a later poll’s, and says it’s saved', async () => {
      const { user, server, dialog } = await onSession()
      await user.click(within(dialog).getByRole('button', { name: 'Reorder' }))
      expect(
        within(dialog).getByRole('heading', {
          level: 3,
          name: 'Reorder Session 1',
        }),
      ).toHaveFocus()
      // Locked meanwhile.
      expect(
        within(dialog).getByText('Save or cancel the new order first.'),
      ).toBeInTheDocument()
      expect(contents(dialog).closest('[inert]')).not.toBeNull()

      // A poll meanwhile brings the group a new stamp.
      const held = server.books[API]
      held.groups = held.groups.map(group => ({
        ...group,
        stamp: 'g:later0000000000',
      }))
      held.version += 1
      await act(async () => {
        await jest.advanceTimersByTimeAsync(POLL_INTERVAL)
      })

      await user.click(
        within(dialog).getByRole('button', { name: 'Move Wolves up' }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Save order' }),
      )

      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes/order`,
        method: 'PUT',
        body: {
          chapterId: 'sessionChapter01',
          ids: ['wolvesNote000001', 'goblinCaveNote01'],
          stamp: 'g:session10000000',
        },
      })
      expect(
        await within(dialog).findByText('Order saved.'),
      ).toBeInTheDocument()
      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Reorder' }),
        ).toHaveFocus(),
      )
      expect(reader(dialog)).toHaveTextContent('Session 1')
      expect(contents(dialog).closest('[inert]')).toBeNull()
    })

    it('says when an order reaches Foundry while it can’t yet', async () => {
      const { user, dialog } = await onSession({ live: false })
      await user.click(within(dialog).getByRole('button', { name: 'Reorder' }))
      await user.click(
        within(dialog).getByRole('button', { name: 'Move Wolves up' }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Save order' }),
      )
      expect(
        await within(dialog).findByText(
          'Order saved. It goes to Foundry when your Gamemaster’s game is next open.',
        ),
      ).toBeInTheDocument()
    })

    it('keeps the pane where the order is refused, saying why', async () => {
      const { user, server, dialog } = await onSession()
      server.answer = () => ({ status: 409, body: { reason: 'changed' } })
      await user.click(within(dialog).getByRole('button', { name: 'Reorder' }))
      await user.click(
        within(dialog).getByRole('button', { name: 'Move Wolves up' }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Save order' }),
      )
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'The order changed while you were arranging it. Cancel to see the latest, then try again.',
      )
      expect(
        within(dialog).getByRole('heading', { name: 'Reorder Session 1' }),
      ).toBeInTheDocument()
    })

    it('drops the half-made order on Cancel, giving focus back to Reorder', async () => {
      const { user, server, dialog } = await onSession()
      await user.click(within(dialog).getByRole('button', { name: 'Reorder' }))
      await user.click(
        within(dialog).getByRole('button', { name: 'Move Wolves up' }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(server.sent).toEqual([])
      await waitFor(() =>
        expect(
          within(dialog).getByRole('button', { name: 'Reorder' }),
        ).toHaveFocus(),
      )
    })

    it('sends a choice on a refused order from the group’s stamp, saying why it’s refused', async () => {
      const { user, server, dialog } = await onSession({
        groups: [
          { chapterId: null, state: 'synced', stamp: 'g:loose00000000000' },
          {
            chapterId: 'sessionChapter01',
            state: 'conflict',
            reason: 'changed',
            stamp: 'g:conflict0000000',
            mine: { ids: ['wolvesNote000001', 'goblinCaveNote01'] },
          },
        ],
      })
      await user.click(
        within(dialog).getByRole('button', { name: 'Use yours' }),
      )
      expect(server.sent.at(-1)).toEqual({
        url: `${API}/notes/order`,
        method: 'PATCH',
        body: {
          chapterId: 'sessionChapter01',
          resolve: 'mine',
          stamp: 'g:conflict0000000',
        },
      })
      server.answer = () => ({ status: 409, body: { reason: 'changed' } })
      const keepTheirs = within(dialog).getByRole('button', {
        name: 'Keep Foundry’s',
      })
      // Off while the first choice is on its way.
      await waitFor(() => expect(keepTheirs).toBeEnabled())
      await user.click(keepTheirs)
      const refused = await within(dialog).findByText(
        'It changed meanwhile: here’s how it stands now.',
      )
      expect(refused).toHaveClass('text-warning')
      expect(iconOf(refused)).not.toMatch(/\blucide-check\b/)
    })
  })

  it('sends a choice on a note from its stamp, saying why where it’s refused', async () => {
    const user = userEvent.setup()
    const server = serveNotes({
      [API]: book({
        entries: [
          noteEntry({
            state: 'conflict',
            reason: 'changed',
            stamp: 'w:conflict.2',
            mine: {
              title: 'Mine',
              html: '<p>mine</p>',
              body: 'mine',
              chapterId: null,
            },
          }),
        ],
      }),
    })
    server.answer = () => ({ status: 409, body: { reason: 'changed' } })
    renderCard()
    const dialog = await openJournal(user)
    await user.click(
      await within(dialog).findByRole('button', { name: 'Keep Foundry’s' }),
    )
    expect(server.sent.at(-1)).toEqual({
      url: `${API}/notes/goblinCaveNote01`,
      method: 'PATCH',
      body: { resolve: 'theirs', stamp: 'w:conflict.2' },
    })
    const refused = await within(dialog).findByText(
      'It changed meanwhile: here’s how it stands now.',
    )
    expect(refused).toHaveClass('text-warning')
    expect(iconOf(refused)).not.toMatch(/\blucide-check\b/)
  })
})
