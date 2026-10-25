/* eslint-disable unicorn/no-null -- the view uses null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CookbookCard } from './cookbook-card'
import { COOKBOOK_POLL_EVERY } from '@/constants/cookbook'
import { forgetCookbook } from '@/hooks/use-cookbook-view'
import type {
  CookbookCodeAnswer,
  CookbookDishView,
  CookbookView,
} from '@/types/cookbook'

/** A code as the app makes one: `sscb_` and 43 characters, 48 in all. */
const CODE = 'sscb_1gT6dhjwOQSMNgkDXiyDOPt2ltW_RKU4XDAdTsRU2d4'
const OTHER_CODE = 'sscb_9zZ8yyXwVuTsRqPoNmLkJiHgFeDcBa_-0123456789'
const API = '/api/characters/char-1/cookbook'

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

const LINK = {
  hint: 'U2d4',
  createdAt: '2026-10-24T18:00:00.000Z',
  lastUsedAt: null,
}

const dish = (fields: Partial<CookbookDishView> = {}): CookbookDishView => ({
  id: 'cmh9q2x7k0003ssdish0001',
  recipe: 'Fireberry Glazed Skewers',
  outcome: 'boon',
  state: 'delivered',
  reason: null,
  eatenBy: [],
  rolled: [],
  queuedAt: '2026-10-24T19:00:00.000Z',
  decidedAt: null,
  ...fields,
})

/*
 * The card's route, as the app answers it: the view it holds now, 204 while unchanged; or, before
 * a test gives it one, no answer at all.
 */
let shown: CookbookView | undefined
let version = 0
const show = (fields: Partial<Omit<CookbookView, 'version'>> = {}) => {
  version += 1
  shown = {
    version: `v${version}`,
    enabled: true,
    live: true,
    link: null,
    dishes: [],
    ...fields,
  }
}
const reads = () =>
  jest.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith(API))

const renderCard = ({
  make = jest.fn<Promise<CookbookCodeAnswer>, []>(async () => {
    // The app links the character as it makes its code.
    show({ link: { ...LINK, createdAt: new Date().toISOString() } })
    return { code: CODE }
  }),
  revoke = jest.fn(async () => {
    show({ link: null })
  }),
}: {
  make?: () => Promise<CookbookCodeAnswer>
  revoke?: () => Promise<void>
} = {}) => {
  const card = () => (
    <CookbookCard characterId='char-1' active make={make} revoke={revoke} />
  )
  const rendered = render(card())
  return { ...rendered, make, revoke, card }
}

const region = () =>
  screen.findByRole('region', { name: 'Magical Recipe Book' })

/** Reads the card again, as at its next poll (here as the page shows again), its answer drawn. */
const poll = async () => {
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    // Every step of the read settled.
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('components/cookbook-card/cookbook-card', () => {
  beforeEach(() => {
    shown = undefined
    globalThis.fetch = jest.fn(async (url: string) => {
      if (!shown) return new Promise<Response>(() => {})
      const asked = new URL(url, 'https://app.test').searchParams.get('version')
      return asked === shown.version ? respond(204) : respond(200, shown)
    }) as typeof fetch
  })

  afterEach(() => {
    act(() => forgetCookbook())
    jest.restoreAllMocks()
  })

  it('draws nothing before its first answer', async () => {
    const { container } = renderCard()
    await waitFor(() => expect(reads()).toHaveLength(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('draws nothing while the game takes no dishes and the character has no link, and shows once dishes are turned on', async () => {
    jest.useFakeTimers()
    try {
      show({ enabled: false })
      const { container } = renderCard()
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
      })
      expect(reads()).toHaveLength(1)
      expect(container).toBeEmptyDOMElement()

      // Still asking, as that's how the Gamemaster turning dishes on shows up.
      show({ enabled: true })
      await act(async () => {
        await jest.advanceTimersByTimeAsync(COOKBOOK_POLL_EVERY)
      })
      expect(reads()).toHaveLength(2)
      expect(
        screen.getByRole('button', { name: 'Make a link code' }),
      ).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('is a region named by its h2, saying what it’s for, offering a link code to an unlinked character', async () => {
    show()
    renderCard()
    const card = await region()
    const heading = within(card).getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Magical Recipe Book')
    expect(card).toHaveAttribute('aria-labelledby', heading.id)
    expect(card).toHaveTextContent(
      'Send dishes you cook in the Magical Recipe Book to this game. Your Gamemaster chooses who ate them in Foundry.',
    )
    expect(
      within(card)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Make a link code'])
    // Nothing sent, nothing linked: no list, and nothing said of it.
    expect(within(card).queryByRole('list')).toBeNull()
    expect(card).not.toHaveTextContent('No dishes sent yet.')
    expect(card).not.toHaveTextContent('isn’t taking dishes')
  })

  it('makes a code, disabled with a spinner while it’s made, then shows it once, whole, to copy, as news', async () => {
    const user = userEvent.setup()
    const writeText = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    show()
    const held = Promise.withResolvers<CookbookCodeAnswer>()
    const make = jest.fn(() => held.promise)
    renderCard({ make })
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )

    const making = within(card).getByRole('button', {
      name: 'Make a link code',
    })
    expect(making).toBeDisabled()
    expect(making.querySelector('svg.animate-spin')).not.toBeNull()
    expect(make).toHaveBeenCalledTimes(1)

    const before = reads().length
    show({ link: { ...LINK, createdAt: new Date().toISOString() } })
    await act(async () => held.resolve({ code: CODE }))

    const made = within(card).getByRole('status')
    expect(made).toHaveTextContent(
      'Copy it now: Sending Stone keeps only a check of it, so it can’t be shown again. In the Magical Recipe Book, open this character’s menu and choose Link Sending Stone, or Sending Stone Link if it’s linked already. Paste it there.',
    )
    expect(
      [...made.querySelectorAll('strong')].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(['Link Sending Stone', 'Sending Stone Link'])
    // All 48 characters, wrapped rather than cut, to read or select by hand on a phone.
    const code = made.querySelector('code') as HTMLElement
    expect(code).toHaveTextContent(CODE)
    expect(CODE).toHaveLength(48)
    expect(code).toHaveClass('break-all', 'select-all')
    expect(code).not.toHaveClass('truncate')
    await user.click(
      within(made).getByRole('button', { name: 'Copy link code' }),
    )
    expect(writeText).toHaveBeenCalledWith(CODE)
    expect(
      within(made).getByRole('button', { name: 'Copied' }),
    ).toBeInTheDocument()
    expect(
      within(made).getByRole('button', { name: 'Done' }),
    ).toBeInTheDocument()

    // The card read again, and so says it's linked now.
    expect(reads().length).toBeGreaterThan(before)
    expect(card).toHaveTextContent(
      'Linked with a code ending …U2d4, made just now · not used yet',
    )
    expect(
      within(card).queryByRole('button', { name: 'Make a link code' }),
    ).toBeNull()
  })

  it.each([
    'This character is no longer in a campaign.',
    'Choose which character you play first.',
  ])(
    'says why no code was made, as an alert under the button: %s',
    async message => {
      const user = userEvent.setup()
      show()
      renderCard({ make: jest.fn(async () => ({ message })) })
      const card = await region()
      const button = within(card).getByRole('button', {
        name: 'Make a link code',
      })
      await user.click(button)

      const alert = await within(card).findByRole('alert')
      expect(alert.tagName).toBe('P')
      expect(alert).toHaveTextContent(message)
      expect(
        button.compareDocumentPosition(alert) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(within(card).queryByRole('status')).toBeNull()
      expect(button).toBeEnabled()
    },
  )

  it('hides the code for good once its player is done, focus on Make a new code', async () => {
    const user = userEvent.setup()
    show()
    renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    const made = await within(card).findByRole('status')
    await user.click(within(made).getByRole('button', { name: 'Done' }))

    expect(within(card).queryByRole('status')).toBeNull()
    expect(card).not.toHaveTextContent(CODE)
    expect(
      within(card).getByRole('button', { name: 'Make a new code' }),
    ).toHaveFocus()
  })

  it('gives focus to Make a new code after Done once the card reads as linked, where it didn’t yet', async () => {
    const user = userEvent.setup()
    show()
    // The code made, but the view that says it's linked not read yet.
    renderCard({ make: jest.fn(async () => ({ code: CODE })) })
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await user.click(
      within(await within(card).findByRole('status')).getByRole('button', {
        name: 'Done',
      }),
    )
    expect(
      within(card).queryByRole('button', { name: 'Make a new code' }),
    ).toBeNull()

    // Read again, as at the next poll: here as the page shows again.
    show({ link: LINK })
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() =>
      expect(
        within(card).getByRole('button', { name: 'Make a new code' }),
      ).toHaveFocus(),
    )
  })

  it('keeps the code just made while the card is unmounted, as when another of the sheet’s tabs is chosen', async () => {
    const user = userEvent.setup()
    show()
    const { unmount, card: drawn } = renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')
    unmount()

    render(drawn())
    const again = await region()
    expect(within(again).getByRole('status')).toHaveTextContent(CODE)
  })

  it('forgets the code just made once a later read finds its link revoked, as by the Gamemaster, offering a code again', async () => {
    const user = userEvent.setup()
    show()
    renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')
    expect(card).toHaveTextContent('Linked with a code ending …U2d4')

    // Read with nothing changed, then with a dish through the link: the code stays.
    await poll()
    show({ link: { ...LINK, lastUsedAt: new Date().toISOString() } })
    await poll()
    expect(card).toHaveTextContent('last dish just now')
    expect(within(card).getByRole('status')).toHaveTextContent(CODE)

    // Revoked on the campaigns page, as the card reads at its next poll.
    show({ link: null })
    await poll()
    expect(within(card).queryByRole('status')).toBeNull()
    expect(card).not.toHaveTextContent(CODE)
    expect(card).not.toHaveTextContent('Linked with')
    expect(
      within(card).getByRole('button', { name: 'Make a link code' }),
    ).toBeEnabled()
  })

  it('forgets the code just made once a later read finds the link made with another code, as on the player’s other device', async () => {
    const user = userEvent.setup()
    show()
    renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')

    show({ link: { ...LINK, hint: OTHER_CODE.slice(-4) } })
    await poll()
    expect(within(card).queryByRole('status')).toBeNull()
    expect(card).not.toHaveTextContent(CODE)
    expect(card).toHaveTextContent('Linked with a code ending …6789')
    expect(
      within(card).getByRole('button', { name: 'Make a new code' }),
    ).toBeInTheDocument()
  })

  it('forgets the code just made when it’s revoked while the game takes no dishes, offering a code once it takes them again', async () => {
    const user = userEvent.setup()
    show()
    const { container } = renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')

    show({ enabled: false, link: null })
    await poll()
    expect(container).toBeEmptyDOMElement()

    show({ enabled: true, link: null })
    await poll()
    const again = await region()
    expect(within(again).queryByRole('status')).toBeNull()
    expect(
      within(again).getByRole('button', { name: 'Make a link code' }),
    ).toBeInTheDocument()
  })

  it('gives focus to Copy link code once Make a link code has made one, as the button pressed goes', async () => {
    const user = userEvent.setup()
    show()
    renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    const made = await within(card).findByRole('status')
    expect(
      within(made).getByRole('button', { name: 'Copy link code' }),
    ).toHaveFocus()
  })

  it('takes no focus from where its player has gone while the code was made', async () => {
    const user = userEvent.setup()
    show()
    const held = Promise.withResolvers<CookbookCodeAnswer>()
    renderCard({ make: jest.fn(() => held.promise) })
    render(<textarea aria-label='A note' />)
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    const note = screen.getByRole('textbox', { name: 'A note' })
    await user.click(note)

    show({ link: { ...LINK, createdAt: new Date().toISOString() } })
    await act(async () => held.resolve({ code: CODE }))
    await within(card).findByRole('status')
    expect(note).toHaveFocus()
  })

  it('gives no focus to Make a link code once it shows again, after a revoke hid the card while the game took no dishes', async () => {
    const user = userEvent.setup()
    show({ enabled: false, link: LINK })
    const { container } = renderCard({
      revoke: jest.fn(async () => {
        show({ enabled: false, link: null })
      }),
    })
    const card = await region()
    await user.click(within(card).getByRole('button', { name: 'Revoke' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Revoke this link code?' }),
      ).getByRole('button', { name: 'Revoke' }),
    )
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    // Focus gone with the card, which has nothing to give it to.
    expect(document.activeElement).toBe(document.body)

    show({ enabled: true, link: null })
    await poll()
    const button = within(await region()).getByRole('button', {
      name: 'Make a link code',
    })
    expect(button).not.toHaveFocus()
  })

  it('says when the code linked was made and last used, each time as the journal says it', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    show({ link: { ...LINK, createdAt: twoHoursAgo, lastUsedAt: null } })
    renderCard()
    const card = await region()
    expect(card).toHaveTextContent(
      'Linked with a code ending …U2d4, made 2 hours ago · not used yet',
    )
    const [made] = card.querySelectorAll('time')
    expect(made).toHaveAttribute('dateTime', twoHoursAgo)
    expect(made.title).not.toBe('')
    expect(card).toHaveTextContent('No dishes sent yet.')
    expect(
      within(card)
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['Make a new code', 'Revoke'])
  })

  it('says when the last dish came through the link', async () => {
    const justNow = new Date().toISOString()
    show({
      link: {
        ...LINK,
        createdAt: '2026-10-24T18:00:00.000Z',
        lastUsedAt: justNow,
      },
    })
    renderCard()
    const card = await region()
    expect(card).toHaveTextContent(
      /^.*Linked with a code ending …U2d4, made .+ · last dish just now/,
    )
    expect(card.querySelectorAll('time')).toHaveLength(2)
    expect(card).not.toHaveTextContent('not used yet')
  })

  it('says, linked, when the Gamemaster’s game isn’t taking dishes, still offering a new code and Revoke', async () => {
    show({ enabled: false, link: LINK })
    renderCard()
    const card = await region()
    expect(card).toHaveTextContent('Linked with a code ending …U2d4')
    expect(card).toHaveTextContent(
      'Your Gamemaster’s game isn’t taking dishes right now.',
    )
    expect(
      within(card).getByRole('button', { name: 'Make a new code' }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole('button', { name: 'Revoke' }),
    ).toBeInTheDocument()
  })

  it('asks before making a new code, then shows the new one in place of the one just made', async () => {
    const user = userEvent.setup()
    show()
    const make = jest
      .fn<Promise<CookbookCodeAnswer>, []>()
      .mockImplementationOnce(async () => {
        show({ link: LINK })
        return { code: CODE }
      })
      .mockImplementationOnce(async () => ({ code: OTHER_CODE }))
    renderCard({ make })
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    expect(await within(card).findByRole('status')).toHaveTextContent(CODE)

    // Kept as it is on Cancel.
    await user.click(
      within(card).getByRole('button', { name: 'Make a new code' }),
    )
    let dialog = screen.getByRole('dialog', { name: 'Make a new link code?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(make).toHaveBeenCalledTimes(1)

    await user.click(
      within(card).getByRole('button', { name: 'Make a new code' }),
    )
    dialog = screen.getByRole('dialog', { name: 'Make a new link code?' })
    expect(dialog).toHaveTextContent(
      'The old code stops working, and the Magical Recipe Book needs the new one.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Make a new code' }),
    )

    expect(make).toHaveBeenCalledTimes(2)
    const made = await within(card).findByRole('status')
    expect(made).toHaveTextContent(OTHER_CODE)
    expect(made).not.toHaveTextContent(CODE)
  })

  it('forgets the code just made once a new one is confirmed, though none was made, saying why', async () => {
    const user = userEvent.setup()
    show()
    const make = jest
      .fn<Promise<CookbookCodeAnswer>, []>()
      .mockImplementationOnce(async () => {
        show({ link: LINK })
        return { code: CODE }
      })
      .mockImplementationOnce(async () => ({
        message: 'This character is no longer in a campaign.',
      }))
    renderCard({ make })
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')

    await user.click(
      within(card).getByRole('button', { name: 'Make a new code' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Make a new link code?' }),
      ).getByRole('button', { name: 'Make a new code' }),
    )

    expect(await within(card).findByRole('alert')).toHaveTextContent(
      'This character is no longer in a campaign.',
    )
    expect(within(card).queryByRole('status')).toBeNull()
    expect(card).not.toHaveTextContent(CODE)
  })

  it('asks before revoking, then forgets the code just made and offers a link code again, focus on it', async () => {
    const user = userEvent.setup()
    show()
    const { revoke } = renderCard()
    const card = await region()
    await user.click(
      within(card).getByRole('button', { name: 'Make a link code' }),
    )
    await within(card).findByRole('status')

    await user.click(within(card).getByRole('button', { name: 'Revoke' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke this link code?',
    })
    expect(dialog).toHaveTextContent(
      'Dishes from the Magical Recipe Book stop reaching this game until you make a new code.',
    )
    const confirm = within(dialog).getByRole('button', { name: 'Revoke' })
    expect(confirm).toHaveClass('bg-danger')
    await user.click(confirm)

    expect(revoke).toHaveBeenCalledTimes(1)
    const button = await within(card).findByRole('button', {
      name: 'Make a link code',
    })
    expect(within(card).queryByRole('status')).toBeNull()
    expect(card).not.toHaveTextContent(CODE)
    expect(card).not.toHaveTextContent('Linked with')
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('lists the dishes sent wherever there are some, linked or not, saying none yet only while linked', async () => {
    show({ link: null, dishes: [dish()] })
    const { unmount } = renderCard()
    let card = await region()
    expect(
      within(
        within(card).getByRole('list', { name: 'Dishes sent' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(1)
    expect(card).toHaveTextContent('With your Gamemaster')
    unmount()
    act(() => forgetCookbook())

    show({ link: LINK, dishes: [dish({ state: 'queued' })], live: false })
    renderCard()
    card = await region()
    expect(card).toHaveTextContent(
      'Waiting for Foundry · your Gamemaster’s game isn’t open',
    )
    expect(card).not.toHaveTextContent('No dishes sent yet.')
  })

  it('makes every button at least 44 px tall, its controls wrapping', async () => {
    const user = userEvent.setup()
    show()
    renderCard()
    const card = await region()
    const first = within(card).getByRole('button', { name: 'Make a link code' })
    expect(first).toHaveClass('min-h-11')
    expect(first.parentElement).toHaveClass('flex', 'flex-wrap', 'gap-2')
    await user.click(first)
    await within(card).findByRole('status')

    const buttons = within(card).getAllByRole('button')
    expect(buttons.map(({ textContent }) => textContent)).toEqual([
      '',
      'Done',
      'Make a new code',
      'Revoke',
    ])
    for (const button of buttons) expect(button).toHaveClass('min-h-11')
    expect(
      within(card).getByRole('button', { name: 'Revoke' }).parentElement,
    ).toHaveClass('flex', 'flex-wrap', 'gap-2')
  })
})
