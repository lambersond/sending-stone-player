import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignCard } from './campaign-card'
import { CampaignIndex, INDEX_WIDE } from './campaign-index'
import { rowOf } from './campaign-row'
import { CampaignsHead } from './campaigns-head'
import type {
  CampaignSetupFormState,
  OwnedCampaign,
  SecretFormState,
} from '@/types/campaign'

// The address as Next's router has it for useSearchParams: what pushState and replaceState write,
// and the browser's Back, each told to the page, as Next tells it.
jest.mock('next/navigation', () => {
  const { useSyncExternalStore } =
    jest.requireActual<typeof import('react')>('react')
  const subscribe = (listener: () => void) => {
    globalThis.addEventListener('mock-address', listener)
    globalThis.addEventListener('popstate', listener)
    return () => {
      globalThis.removeEventListener('mock-address', listener)
      globalThis.removeEventListener('popstate', listener)
    }
  }
  const search = () => globalThis.location.search
  return {
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, search, search)),
  }
})

const { pushState, replaceState } = globalThis.history
beforeAll(() => {
  globalThis.history.pushState = (...args) => {
    pushState.apply(globalThis.history, args)
    globalThis.dispatchEvent(new Event('mock-address'))
  }
  globalThis.history.replaceState = (...args) => {
    replaceState.apply(globalThis.history, args)
    globalThis.dispatchEvent(new Event('mock-address'))
  }
})
afterAll(() => {
  globalThis.history.pushState = pushState
  globalThis.history.replaceState = replaceState
})

/** The index's width, as the browser measures it once drawn. */
const measured = (width: number) => {
  globalThis.ResizeObserver = class {
    constructor(private readonly told: ResizeObserverCallback) {}
    observe() {
      this.told(
        [{ contentRect: { width } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
const WIDE = 1056
const PHONE = 358
const { ResizeObserver } = globalThis

/** A browser's page behind an open modal dialog: inert, so nothing in it takes focus. */
const pageFocus = HTMLElement.prototype.focus
class InertBehindDialogs extends HTMLElement {
  override focus(options?: FocusOptions) {
    const open = [...document.querySelectorAll('dialog')].find(
      dialog => dialog.open,
    )
    if (open && !open.contains(this)) return
    pageFocus.call(this, options)
  }
}

const base = (id: string, fields: Partial<OwnedCampaign>): OwnedCampaign => ({
  id,
  title: id,
  gameUrl: 'https://mists.forge-vtt.com',
  inviteCode: `code-${id}`,
  connected: true,
  rosterReceived: true,
  live: false,
  rolls: {
    enabled: false,
    reaching: false,
    attacks: false,
    spells: false,
    prompts: false,
  },
  transfers: { enabled: false, reaching: false },
  characters: [],
  groups: [],
  ...fields,
})

const NOW = Date.parse('2026-10-28T20:00:00.000Z')
const minutesAgo = (minutes: number) =>
  new Date(NOW - minutes * 60_000).toISOString()

/** The design's five campaigns, in the page's order: those that need their Gamemaster first. */
const tomb = base('toa', {
  title: 'Tomb of Annihilation',
  worldTitle: 'Chult',
  lastSeenAt: minutesAgo(600),
  refusal: {
    reason: 'wrongSecret',
    status: 401,
    at: minutesAgo(10),
    current: true,
  },
  characters: [
    { id: 'azaka', name: 'Azaka', player: 'Dev', characterId: 'char-a' },
  ],
})
const saltmarsh = base('salt', {
  title: 'Ghosts of Saltmarsh',
  connected: false,
  rosterReceived: false,
})
const strahd = base('strahd', {
  title: 'Curse of Strahd',
  worldTitle: 'Barovia',
  live: true,
  lastSeenAt: minutesAgo(0),
  characters: [
    {
      id: 'thorin',
      name: 'Thorin Oakenshield',
      player: 'Alice',
      characterId: 'char-t',
    },
    { id: 'vex', name: 'Vex', player: 'Bob', characterId: 'char-v' },
    { id: 'kasimir', name: 'Kasimir' },
  ],
})
const phandelver = base('lmop', {
  title: 'Lost Mine of Phandelver',
  worldTitle: 'Phandalin',
  lastSeenAt: minutesAgo(1440),
})
const sunless = base('sunless', {
  title: 'The Sunless Citadel',
  worldTitle: 'Oakhurst one-shot',
  lastSeenAt: minutesAgo(40_000),
})
const FIVE = [tomb, saltmarsh, strahd, phandelver, sunless]
const extra = (index: number) =>
  base(`x${index}`, {
    title: `Dragon Heist ${index}`,
    worldTitle: 'Waterdeep',
    lastSeenAt: minutesAgo(50_000 + index),
  })

type Actions = {
  changeSecret: jest.Mock<Promise<SecretFormState>, [SecretFormState, FormData]>
  resetInvite: jest.Mock<Promise<void>, []>
  removePlayer: jest.Mock<Promise<void>, [string]>
  revokeCookbookLink: jest.Mock<Promise<void>, [string]>
  remove: jest.Mock<Promise<void>, []>
}

const setUp = jest.fn<
  Promise<CampaignSetupFormState>,
  [CampaignSetupFormState, FormData]
>()
let actions: Record<string, Actions> = {}
const actionsOf = (id: string): Actions =>
  (actions[id] ??= {
    changeSecret: jest.fn<
      Promise<SecretFormState>,
      [SecretFormState, FormData]
    >(async () => ({ saved: true })),
    resetInvite: jest.fn(async () => {}),
    removePlayer: jest.fn<Promise<void>, [string]>(async () => {}),
    revokeCookbookLink: jest.fn<Promise<void>, [string]>(async () => {}),
    remove: jest.fn(async () => {}),
  })

/**
 * The page as the server draws it: each campaign's row, each one's page by its id (unkeyed, as
 * the index keys it), the first view's id and the head.
 */
const page = (campaigns: OwnedCampaign[], first = campaigns[0]?.id) => {
  const details = Object.fromEntries(
    campaigns.map(campaign => [
      campaign.id,
      // eslint-disable-next-line react/jsx-key -- unkeyed, for the index to key
      <CampaignCard
        campaign={campaign}
        inviteUrl={`https://stone.example/join/${campaign.inviteCode}`}
        {...actionsOf(campaign.id)}
      />,
    ]),
  )
  return (
    <CampaignIndex
      rows={campaigns.map(campaign => rowOf(campaign))}
      details={details}
      first={first}
      head={
        <CampaignsHead
          destination='https://stone.example'
          setUp={setUp}
          suggestedSecret='suggested-secret-0001'
        />
      }
    />
  )
}

const renderPage = (
  campaigns: OwnedCampaign[],
  { width = WIDE, address = '/campaigns', first = campaigns[0]?.id } = {},
) => {
  replaceState.call(globalThis.history, undefined, '', address)
  measured(width)
  const view = render(page(campaigns, first))
  return {
    ...view,
    redraw: (next: OwnedCampaign[]) => view.rerender(page(next, first)),
  }
}

/** The campaign whose page shows, by its title. */
const shownTitle = () =>
  within(screen.getByRole('article')).getByRole('heading', { level: 2 })
    .textContent
/** A campaign's row, by its title. */
const rowOfTitle = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^${title}`) })
/** The rows' titles in the group with this label. */
const listed = (name: string) =>
  within(screen.getByRole('list', { name }))
    .getAllByRole('button')
    .map(
      row =>
        (row.firstElementChild?.firstElementChild as HTMLElement).textContent,
    )
/** The index, its list's box and the box of the campaign shown. */
const root = () =>
  document.querySelector('[class~="@container/index"]') as HTMLElement
const listBox = () => root().lastElementChild?.firstElementChild as HTMLElement
const detailBox = () => root().lastElementChild?.lastElementChild as HTMLElement
const pill = () =>
  document.querySelector<HTMLElement>('[data-page-toast]') ?? undefined
/** The page's status region for its toasts, outside the index, as the search's is inside. */
const toastRegion = () =>
  screen.getAllByRole('status').find(region => !root().contains(region))

/** A promise its test settles, as a server action's answer arrives. */
function later() {
  const settled: { settle?: () => void } = {}
  const promise = new Promise<void>(resolve => {
    settled.settle = resolve
  })
  return { promise, settle: () => settled.settle?.() }
}

/** Sets up Rime of the Frostmaiden with New campaign, the page refreshed with it, then Done. */
const setUpOne = async (
  user: ReturnType<typeof userEvent.setup>,
  redraw: (next: OwnedCampaign[]) => void,
) => {
  setUp.mockResolvedValue({
    saved: { id: 'c9', title: 'Rime of the Frostmaiden', secret: 's' },
  })
  await user.click(screen.getByRole('button', { name: 'New campaign' }))
  const dialog = screen.getByRole('dialog', { name: 'New campaign' })
  await user.type(
    within(dialog).getByLabelText('Campaign title'),
    'Rime of the Frostmaiden',
  )
  await user.type(
    within(dialog).getByLabelText('Forge game address'),
    'rime.forge-vtt.com',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Set up campaign' }),
  )
  await within(dialog).findByRole('button', { name: 'Done' })
  // The refreshed page, with the campaign set up, waiting for Foundry.
  redraw([
    tomb,
    base('c9', {
      title: 'Rime of the Frostmaiden',
      connected: false,
      rosterReceived: false,
    }),
    saltmarsh,
    strahd,
    phandelver,
    sunless,
  ])
  await user.click(within(dialog).getByRole('button', { name: 'Done' }))
}

describe('components/campaigns/campaign-index (round 0.39.0)', () => {
  beforeEach(() => {
    actions = {}
    globalThis.scrollTo = jest.fn()
  })
  afterEach(() => {
    globalThis.ResizeObserver = ResizeObserver
    HTMLElement.prototype.focus = pageFocus
    jest.restoreAllMocks()
  })

  describe('the list', () => {
    it('groups those that need their Gamemaster under Needs you, refused then waiting, and the rest under Campaigns', () => {
      renderPage(FIVE)

      expect(
        screen
          .getAllByRole('heading', { level: 2 })
          .slice(0, 2)
          .map(heading => [heading.textContent, heading.className]),
      ).toEqual([
        ['Needs you', expect.stringContaining('uppercase')],
        ['Campaigns', expect.stringContaining('uppercase')],
      ])
      expect(listed('Needs you')).toEqual([
        'Tomb of Annihilation',
        'Ghosts of Saltmarsh',
      ])
      expect(listed('Campaigns')).toEqual([
        'Curse of Strahd',
        'Lost Mine of Phandelver',
        'The Sunless Citadel',
      ])
      // Each row says what its campaign needs, else its seats.
      expect(rowOfTitle('Tomb of Annihilation')).toHaveTextContent(
        'Foundry’s posts refused: wrong secret',
      )
      expect(rowOfTitle('Ghosts of Saltmarsh')).toHaveTextContent(
        'Connect Foundry to start',
      )
      expect(rowOfTitle('Curse of Strahd')).toHaveTextContent(
        '2 of 3 characters chosen',
      )
      expect(rowOfTitle('Curse of Strahd')).toHaveTextContent('Live')
    })

    it('labels nothing where none needs its Gamemaster: one list, named for screen readers', () => {
      renderPage([strahd, phandelver, sunless])

      expect(
        screen.queryByRole('heading', { name: 'Needs you' }),
      ).not.toBeInTheDocument()
      const label = screen.getByRole('heading', { level: 2, name: 'Campaigns' })
      expect(label).toHaveClass('sr-only')
      expect(within(listBox()).getAllByRole('list')).toHaveLength(1)
      expect(listed('Campaigns')).toHaveLength(3)
    })

    it('offers no search for six campaigns', () => {
      renderPage([...FIVE, extra(1)])

      expect(screen.queryByRole('searchbox')).toBeNull()
    })

    it('searches from seven, by title and world, the labels worked out on what it leaves', async () => {
      const user = userEvent.setup()
      renderPage([...FIVE, extra(1), extra(2)])

      const search = screen.getByRole('searchbox', { name: 'Find a campaign' })
      expect(search).toHaveAttribute('placeholder', 'Find a campaign')
      // A polite line, after the field, saying how many show while a search is typed.
      const said = () => search.parentElement?.nextElementSibling
      expect(said()).toHaveAttribute('role', 'status')
      expect(said()).toHaveClass('sr-only')
      expect(said()).toBeEmptyDOMElement()

      await user.type(search, 'barovia')
      expect(listed('Campaigns')).toEqual(['Curse of Strahd'])
      // None it leaves needs the Gamemaster: no labels.
      expect(screen.queryByRole('heading', { name: 'Needs you' })).toBeNull()
      expect(screen.getByRole('heading', { name: 'Campaigns' })).toHaveClass(
        'sr-only',
      )
      expect(said()).toHaveTextContent(/^1 campaign shown$/)

      await user.clear(search)
      await user.type(search, 'o')
      expect(said()).toHaveTextContent(/^\d+ campaigns shown$/)

      await user.clear(search)
      await user.type(search, 'tomb')
      expect(listed('Needs you')).toEqual(['Tomb of Annihilation'])
      expect(screen.queryByRole('list', { name: 'Campaigns' })).toBeNull()

      await user.clear(search)
      await user.type(search, 'gloomstalker')
      expect(within(listBox()).queryAllByRole('list')).toHaveLength(0)
      expect(
        screen.getByText('No campaign matches “gloomstalker”.'),
      ).toBeInTheDocument()
      expect(said()).toHaveTextContent(/^0 campaigns shown$/)
      // The campaign shown stays shown, though the search leaves it out.
      expect(shownTitle()).toBe('Tomb of Annihilation')

      await user.keyboard('{Escape}')
      expect(search).toHaveValue('')
      expect(said()).toBeEmptyDOMElement()
      expect(within(listBox()).getAllByRole('button')).toHaveLength(7)
    })
  })

  describe('on a wide screen', () => {
    it('shows the first in order beside the list, its row marked current', () => {
      renderPage(FIVE)

      expect(shownTitle()).toBe('Tomb of Annihilation')
      expect(rowOfTitle('Tomb of Annihilation')).toHaveAttribute(
        'aria-current',
        'true',
      )
      expect(rowOfTitle('Curse of Strahd')).not.toHaveAttribute('aria-current')
      expect(globalThis.location.search).toBe('')
    })

    it('marks no row current until the page knows it’s wide', () => {
      replaceState.call(globalThis.history, undefined, '', '/campaigns')
      render(page(FIVE))

      expect(shownTitle()).toBe('Tomb of Annihilation')
      expect(rowOfTitle('Tomb of Annihilation')).not.toHaveAttribute(
        'aria-current',
      )
    })

    it('opens another beside the list, replacing the address, focus kept on its row', async () => {
      const user = userEvent.setup()
      renderPage(FIVE)
      const push = jest.spyOn(globalThis.history, 'pushState')
      const replace = jest.spyOn(globalThis.history, 'replaceState')

      await user.click(rowOfTitle('Curse of Strahd'))
      expect(shownTitle()).toBe('Curse of Strahd')
      expect(globalThis.location.search).toBe('?campaign=strahd')
      // Replaced, so Back leaves the page rather than stepping through campaigns.
      expect(push).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith(
        undefined,
        '',
        '/campaigns?campaign=strahd',
      )
      expect(rowOfTitle('Curse of Strahd')).toHaveFocus()
      expect(rowOfTitle('Curse of Strahd')).toHaveAttribute(
        'aria-current',
        'true',
      )
      expect(globalThis.scrollTo).not.toHaveBeenCalled()
    })

    it('keeps showing the campaign it showed when a refresh re-sorts the list (CA-1)', () => {
      const { redraw } = renderPage(FIVE)
      expect(shownTitle()).toBe('Tomb of Annihilation')

      // Save secret clears the refusal: the campaign drops below the live one.
      const cleared = { ...tomb, refusal: undefined }
      redraw([saltmarsh, strahd, phandelver, cleared, sunless])
      expect(listed('Campaigns')[0]).toBe('Curse of Strahd')
      expect(shownTitle()).toBe('Tomb of Annihilation')
      expect(rowOfTitle('Tomb of Annihilation')).toHaveAttribute(
        'aria-current',
        'true',
      )
    })

    it('shows the first in order once the campaign it showed is gone', () => {
      const { redraw } = renderPage(FIVE)

      redraw([saltmarsh, strahd, phandelver, sunless])
      expect(shownTitle()).toBe('Ghosts of Saltmarsh')
      // And keeps it from then on.
      redraw([strahd, saltmarsh, phandelver, sunless])
      expect(shownTitle()).toBe('Ghosts of Saltmarsh')
    })

    it('carries nothing of one campaign’s page to another’s, each keyed by its id (CA-25)', async () => {
      const user = userEvent.setup()
      renderPage(FIVE)

      await user.click(screen.getByText('Change secret'))
      await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
      await user.click(screen.getByRole('button', { name: 'Save secret' }))
      expect(
        await screen.findByText(/^Saved\. Enter the same secret/),
      ).toBeInTheDocument()
      // The toast, beside the line that stays.
      expect(pill()).toHaveTextContent(
        'Secret changed. Enter it in Foundry too.',
      )
      expect(toastRegion()).toHaveTextContent(
        'Secret changed. Enter it in Foundry too.',
      )

      await user.click(rowOfTitle('Curse of Strahd'))
      expect(shownTitle()).toBe('Curse of Strahd')
      expect(screen.queryByText(/^Saved\./)).toBeNull()
      expect(
        screen.getByText('Change secret').closest('details'),
      ).not.toHaveAttribute('open')
    })

    it('keeps the page shown, its Saved. line too, as Save secret refreshes it', async () => {
      const user = userEvent.setup()
      const { redraw } = renderPage(FIVE, {
        address: '/campaigns?campaign=toa',
      })

      await user.click(screen.getByText('Change secret'))
      await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
      await user.click(screen.getByRole('button', { name: 'Save secret' }))
      await screen.findByText(/^Saved\./)
      redraw([
        saltmarsh,
        strahd,
        phandelver,
        { ...tomb, refusal: undefined },
        sunless,
      ])

      expect(shownTitle()).toBe('Tomb of Annihilation')
      expect(
        screen.getByRole('article').querySelector('[data-refusal]'),
      ).toBeNull()
      expect(screen.getByText(/^Saved\./)).toBeInTheDocument()
    })
  })

  describe('on a phone', () => {
    it('shows the list alone until a campaign is chosen', () => {
      renderPage(FIVE, { width: PHONE })

      expect(listBox()).toHaveClass('flex')
      expect(listBox()).not.toHaveClass('hidden')
      // Drawn, for no flash on a wide screen, but hidden here.
      expect(detailBox()).toHaveClass('hidden', '@min-[900px]/index:flex')
      expect(screen.queryByRole('button', { name: 'All campaigns' })).toBeNull()
      expect(rowOfTitle('Tomb of Annihilation')).not.toHaveAttribute(
        'aria-current',
      )
    })

    it('opens a campaign in place of the list, adding to the history, from the top, its heading focused', async () => {
      const user = userEvent.setup()
      renderPage(FIVE, { width: PHONE })
      const push = jest.spyOn(globalThis.history, 'pushState')

      await user.click(rowOfTitle('Curse of Strahd'))
      expect(globalThis.location.search).toBe('?campaign=strahd')
      expect(push).toHaveBeenCalledWith(
        undefined,
        '',
        '/campaigns?campaign=strahd',
      )
      expect(shownTitle()).toBe('Curse of Strahd')
      expect(listBox()).toHaveClass('hidden', '@min-[900px]/index:flex')
      expect(detailBox()).toHaveClass('flex')
      expect(detailBox()).not.toHaveClass('hidden')
      expect(globalThis.scrollTo).toHaveBeenCalledWith({ top: 0 })
      expect(
        screen.getByRole('heading', { level: 2, name: 'Curse of Strahd' }),
      ).toHaveFocus()
      expect(screen.getByRole('button', { name: 'All campaigns' })).toHaveClass(
        '@min-[900px]/index:hidden',
        'min-h-10',
      )

      // The page keeps its heading, for screen readers, its note and buttons gone.
      const h1 = screen.getByRole('heading', {
        level: 1,
        name: 'Your campaigns',
      })
      expect(h1).toHaveClass('@max-[900px]/index:sr-only')
      expect(h1).not.toHaveClass('@max-[900px]/index:hidden')
      expect(screen.getByText(/^Set up each campaign you run/)).toHaveClass(
        '@max-[900px]/index:hidden',
      )
      expect(
        screen.getByRole('button', { name: 'New campaign' }).parentElement,
      ).toHaveClass('@max-[900px]/index:hidden')
    })

    it('goes back with All campaigns where it added the entry, focus to the row of the campaign left', async () => {
      const user = userEvent.setup()
      renderPage(FIVE, { width: PHONE })
      const back = jest.spyOn(globalThis.history, 'back')

      await user.click(rowOfTitle('Curse of Strahd'))
      await user.click(screen.getByRole('button', { name: 'All campaigns' }))
      expect(back).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(globalThis.location.search).toBe(''))
      await waitFor(() => expect(rowOfTitle('Curse of Strahd')).toHaveFocus())
      expect(listBox()).not.toHaveClass('hidden')
    })

    it('replaces the address with All campaigns where the page was opened on the campaign', async () => {
      const user = userEvent.setup()
      renderPage(FIVE, {
        width: PHONE,
        address: '/campaigns?campaign=lmop',
      })
      const back = jest.spyOn(globalThis.history, 'back')
      const replace = jest.spyOn(globalThis.history, 'replaceState')
      expect(shownTitle()).toBe('Lost Mine of Phandelver')

      await user.click(screen.getByRole('button', { name: 'All campaigns' }))
      expect(back).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith(undefined, '', '/campaigns')
      expect(globalThis.location.search).toBe('')
      expect(rowOfTitle('Lost Mine of Phandelver')).toHaveFocus()
    })

    it('returns to the list with the browser’s Back, focus to the row of the campaign left', async () => {
      const user = userEvent.setup()
      renderPage(FIVE, { width: PHONE })

      await user.click(rowOfTitle('The Sunless Citadel'))
      act(() => globalThis.history.back())
      await waitFor(() => expect(globalThis.location.search).toBe(''))
      await waitFor(() =>
        expect(rowOfTitle('The Sunless Citadel')).toHaveFocus(),
      )
    })
  })

  describe('the address', () => {
    it.each([
      ['wide', WIDE],
      ['a phone', PHONE],
    ])(
      'ignores a campaign it names that isn’t listed, and drops it: %s',
      (_, width) => {
        renderPage(FIVE, { width, address: '/campaigns?campaign=gone' })

        expect(globalThis.location.search).toBe('')
        expect(shownTitle()).toBe('Tomb of Annihilation')
        expect(listBox()).not.toHaveClass('hidden')
        expect(
          screen.queryByRole('button', { name: 'All campaigns' }),
        ).toBeNull()
      },
    )

    it('ignores an address naming two campaigns, as the server does, and drops it', () => {
      renderPage(FIVE, {
        address: '/campaigns?campaign=strahd&campaign=lmop',
      })

      expect(globalThis.location.search).toBe('')
      expect(shownTitle()).toBe('Tomb of Annihilation')
    })

    it('opens the campaign it names, wide or on a phone', () => {
      renderPage(FIVE, { address: '/campaigns?campaign=sunless' })

      expect(shownTitle()).toBe('The Sunless Citadel')
      expect(rowOfTitle('The Sunless Citadel')).toHaveAttribute(
        'aria-current',
        'true',
      )
    })
  })

  describe('after a dialog acts (CA-11)', () => {
    it('drops a deleted campaign from the address, says so, and focuses the page’s heading', async () => {
      const user = userEvent.setup()
      const { redraw } = renderPage(FIVE, {
        address: '/campaigns?campaign=strahd',
      })
      HTMLElement.prototype.focus = InertBehindDialogs.prototype.focus
      const answer = later()
      actionsOf('strahd').remove.mockReturnValue(answer.promise)

      await user.click(screen.getByRole('button', { name: 'Delete campaign' }))
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Delete Curse of Strahd?' }),
        ).getByRole('button', { name: 'Delete campaign' }),
      )
      // The refreshed page arrives, the campaign gone with its dialog.
      redraw([tomb, saltmarsh, phandelver, sunless])
      await act(async () => answer.settle())

      expect(globalThis.location.search).toBe('')
      expect(rowOfTitle('Tomb of Annihilation')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Curse of Strahd/ }),
      ).toBeNull()
      expect(
        screen.getByRole('heading', { level: 1, name: 'Your campaigns' }),
      ).toHaveFocus()
      expect(pill()).toHaveTextContent('Curse of Strahd deleted')
      expect(toastRegion()).toHaveTextContent('Curse of Strahd deleted')
    })

    it('focuses the character’s sheet link once its player is removed, the button gone with them', async () => {
      const user = userEvent.setup()
      const { redraw } = renderPage(FIVE, {
        address: '/campaigns?campaign=strahd',
      })
      HTMLElement.prototype.focus = InertBehindDialogs.prototype.focus
      const answer = later()
      actionsOf('strahd').removePlayer.mockReturnValue(answer.promise)

      await user.click(
        screen.getByRole('button', {
          name: 'Remove Alice as Thorin Oakenshield',
        }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', {
            name: 'Remove Alice as Thorin Oakenshield?',
          }),
        ).getByRole('button', { name: 'Remove' }),
      )
      expect(actionsOf('strahd').removePlayer).toHaveBeenCalledWith('char-t')
      redraw([
        tomb,
        saltmarsh,
        {
          ...strahd,
          characters: strahd.characters.map(character =>
            character.id === 'thorin'
              ? { id: 'thorin', name: 'Thorin Oakenshield' }
              : character,
          ),
        },
        phandelver,
        sunless,
      ])
      await act(async () => answer.settle())

      expect(
        screen.getByRole('link', { name: "Open Thorin Oakenshield's sheet" }),
      ).toHaveFocus()
      expect(shownTitle()).toBe('Curse of Strahd')
    })
  })

  describe('toasts', () => {
    it('says the invite link is copied, its button saying it for screen readers', async () => {
      const user = userEvent.setup()
      jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
      renderPage(FIVE)

      await user.click(screen.getByRole('button', { name: 'Copy invite link' }))
      expect(pill()).toHaveTextContent('Invite link copied')
      expect(toastRegion()).toBeEmptyDOMElement()
      expect(screen.getByRole('button', { name: 'Copied' })).toHaveTextContent(
        'Copied',
      )
    })

    it('says a new invite link is ready, once reset', async () => {
      const user = userEvent.setup()
      renderPage(FIVE)

      await user.click(screen.getByRole('button', { name: 'Reset link' }))
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Reset the invite link?' }),
        ).getByRole('button', { name: 'Reset link' }),
      )
      expect(actionsOf('toa').resetInvite).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(pill()).toHaveTextContent('A new invite link is ready'),
      )
      expect(toastRegion()).toHaveTextContent('A new invite link is ready')
    })

    it('offers Copy for the new invite link once reset, the old one copied no longer working', async () => {
      const user = userEvent.setup()
      const writeText = jest
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue()
      const { redraw } = renderPage(FIVE)

      await user.click(screen.getByRole('button', { name: 'Copy invite link' }))
      expect(writeText).toHaveBeenLastCalledWith(
        'https://stone.example/join/code-toa',
      )
      await user.click(screen.getByRole('button', { name: 'Reset link' }))
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Reset the invite link?' }),
        ).getByRole('button', { name: 'Reset link' }),
      )
      await waitFor(() =>
        expect(pill()).toHaveTextContent('A new invite link is ready'),
      )
      // The refreshed page, drawn in place with the new link, its page kept.
      redraw([{ ...tomb, inviteCode: 'fresh-code' }, ...FIVE.slice(1)])

      const article = screen.getByRole('article')
      expect(
        within(article).getByText('https://stone.example/join/fresh-code'),
      ).toBeInTheDocument()
      expect(
        within(article).getByRole('button', { name: 'Copy invite link' }),
      ).toHaveTextContent(/^Copy$/)
      expect(
        within(article).queryByRole('button', { name: 'Copied' }),
      ).toBeNull()
    })

    it('says nothing of a secret changed where Save secret is refused, its reason shown in place', async () => {
      const user = userEvent.setup()
      const reason = 'Use a secret of at least 12 characters.'
      actionsOf('toa').changeSecret.mockResolvedValue({ error: reason })
      renderPage(FIVE)

      await user.click(screen.getByText('Change secret'))
      // Long enough for the field, though the server trims it first.
      await user.type(screen.getByLabelText('New secret'), '            a')
      await user.click(screen.getByRole('button', { name: 'Save secret' }))

      const error = await screen.findByText(reason)
      expect(actionsOf('toa').changeSecret).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('New secret')).toHaveAttribute(
        'aria-describedby',
        error.id,
      )
      expect(screen.queryByText(/^Saved\./)).toBeNull()
      expect(pill()).toBeUndefined()
      expect(toastRegion()).toBeEmptyDOMElement()
    })
  })

  describe('New campaign › Done', () => {
    it('chooses the campaign set up, beside the list on a wide screen', async () => {
      const user = userEvent.setup()
      const { redraw } = renderPage(FIVE)
      const push = jest.spyOn(globalThis.history, 'pushState')

      await setUpOne(user, redraw)
      expect(globalThis.location.search).toBe('?campaign=c9')
      expect(push).not.toHaveBeenCalled()
      expect(shownTitle()).toBe('Rime of the Frostmaiden')
      expect(rowOfTitle('Rime of the Frostmaiden')).toHaveAttribute(
        'aria-current',
        'true',
      )
    })

    it('opens it on a phone, its heading focused once the dialog has closed', async () => {
      const user = userEvent.setup()
      const { redraw } = renderPage(FIVE, { width: PHONE })
      const push = jest.spyOn(globalThis.history, 'pushState')

      await setUpOne(user, redraw)
      expect(globalThis.location.search).toBe('?campaign=c9')
      expect(push).toHaveBeenCalledWith(undefined, '', '/campaigns?campaign=c9')
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'Rime of the Frostmaiden',
        }),
      ).toHaveFocus()
    })
  })

  it('shows the empty page under the head where there are no campaigns', () => {
    renderPage([])

    expect(
      screen.getByRole('heading', { level: 1, name: 'Your campaigns' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/You haven't set up a campaign yet/),
    ).toHaveTextContent(
      "You haven't set up a campaign yet. Use New campaign to set one up, then connect Foundry to it.",
    )
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('takes its width for wide from 900 px, as its CSS does', () => {
    expect(INDEX_WIDE).toBe(900)
    measured(899)
    replaceState.call(globalThis.history, undefined, '', '/campaigns')
    const { unmount } = render(page(FIVE))
    expect(rowOfTitle('Tomb of Annihilation')).not.toHaveAttribute(
      'aria-current',
    )
    unmount()
    measured(900)
    render(page(FIVE))
    expect(rowOfTitle('Tomb of Annihilation')).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
