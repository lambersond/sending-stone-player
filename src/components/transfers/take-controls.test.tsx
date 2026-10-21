/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { chosenApi, type TakeInto } from './take-controls'
import { Transferring, type TransferControls } from './transferring'
import { PartySheet } from '@/components/party-sheet/party-sheet'
import { CHECK_EVERY } from '@/hooks/use-table-rolls'
import { movingPartyView, partyStash } from '@/mocks/sending-stone'
import type { MoveDialogProps } from '@/components/transfers/move-dialog'
import type { PartyView } from '@/types/party'

// The move's dialog is APP-B's: here, only what it's given, and the move it's told to make; or,
// where a test says so, the dialog itself.
let made: Parameters<MoveDialogProps['onMove']>[0] | undefined
let shown: MoveDialogProps | undefined
let real = false
jest.mock('@/components/transfers/move-dialog', () => ({
  MoveDialog: (props: MoveDialogProps) => {
    if (real) {
      const { MoveDialog: Real } = jest.requireActual(
        '@/components/transfers/move-dialog',
      )
      return <Real {...props} />
    }
    shown = props
    if (!props.open) return null
    const what = 'item' in props.what ? props.what.item.name : 'coins'
    return (
      <div role='dialog' aria-label={`Moving ${what}`}>
        <button
          type='button'
          onClick={() => {
            if (made) props.onMove(made)
            props.onClose()
          }}
        >
          Move it
        </button>
      </div>
    )
  },
}))

const API = '/api/characters/char-1/party/groupIronCo01'
const own: TakeInto = {
  kind: 'own',
  actorId: 'actorThorin1',
  name: 'Thorin',
  api: '/api/characters/char-1',
}
const choose: TakeInto = { kind: 'choose', campaignId: 'c1' }

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

const renderSheet = (
  takeInto: TakeInto | 'none' = own,
  partyView: PartyView = movingPartyView(),
  role: 'player' | 'gm' = 'player',
) =>
  render(
    <PartySheet
      api={API}
      role={role}
      view={partyView}
      takeInto={takeInto === 'none' ? undefined : takeInto}
    />,
  )

/** What was posted last, and where. */
const posted = () => {
  const [url, init] = jest.mocked(fetch).mock.lastCall ?? []
  return { url, body: JSON.parse(String(init?.body)) }
}

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

/** The spinners inside a part of the page. */
const spinnersIn = (scope: HTMLElement) => [
  ...scope.querySelectorAll(String.raw`svg.motion-safe\:animate-spin`),
]
/** The spinner right after a text, such as an item's name: what follows it at once. */
const spinnerBy = (scope: HTMLElement, text: string) => {
  const next = within(scope).getByText(text).nextElementSibling
  expect(next?.tagName.toLowerCase()).toBe('svg')
  expect(next).toHaveClass('motion-safe:animate-spin')
  expect(next).toHaveAttribute('aria-hidden', 'true')
  return next
}
/** The Currency fact's label. */
const currencyTerm = () =>
  screen.getByText('Currency').closest('dt') as HTMLElement

describe('components/transfers/take-controls', () => {
  beforeEach(() => {
    made = undefined
    shown = undefined
    real = false
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows no Take while the seat may take nothing, or the sheet takes into no one', () => {
    const { unmount } = renderSheet(own, movingPartyView({ moves: undefined }))
    expect(screen.queryByRole('button', { name: /^Take/ })).toBeNull()
    unmount()
    renderSheet('none')
    expect(screen.queryByRole('button', { name: /^Take/ })).toBeNull()
  })

  it('shows Take beside each item and its coin, styled as End, inside containers too', async () => {
    const user = userEvent.setup()
    renderSheet()

    const rope = screen.getByRole('button', { name: 'Take Rope' })
    expect(rope).toHaveTextContent(/^Take$/)
    expect(rope).toHaveAttribute('aria-haspopup', 'dialog')
    expect(rope).toHaveClass(
      'shrink-0',
      'rounded-lg',
      'border',
      'border-border',
      'px-2',
      'py-1',
      'text-xs',
      'font-semibold',
    )
    expect(rope).not.toHaveClass('rounded-full')
    expect(
      screen.getByRole('button', { name: 'Take Potion of Healing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Take Locked Coffer' }),
    ).toBeInTheDocument()
    // Inside the Backpack too, once open: tapping Take opens nothing else.
    await user.click(screen.getByRole('button', { name: 'Take Backpack' }))
    expect(
      screen.getByRole('dialog', { name: 'Moving Backpack' }),
    ).toBeVisible()
    expect(screen.queryByText('Bedroll')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Move it' }))
    await user.click(screen.getByText('Backpack'))
    expect(
      screen.getByRole('button', { name: 'Take Bedroll' }),
    ).toBeInTheDocument()

    const coins = screen.getByRole('button', {
      name: 'Take coins from The Iron Company',
    })
    expect(coins.closest('dd')).not.toBeNull()
    expect(screen.getByText('Currency')).toHaveTextContent(/^Currency$/)
  })

  it('shows no Take for coin there is no whole piece of', () => {
    const stash = partyStash()
    renderSheet(
      own,
      movingPartyView({
        sheet: {
          members: [],
          description: null,
          inventory: {
            ...stash,
            currency: [
              { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 0.5 },
            ],
          },
        },
      }),
    )
    expect(screen.queryByRole('button', { name: /^Take coins/ })).toBeNull()
  })

  it('opens its dialog, not its row, from the row’s summary: its click is cancelled, and goes no further than the page’s own handlers', async () => {
    const user = userEvent.setup()
    const { container } = renderSheet()

    const take = screen.getByRole('button', { name: 'Take Backpack' })
    const row = take.closest('details')!
    expect(take.closest('summary')).not.toBeNull()
    const cancelled: boolean[] = []
    const onPage = (event: Event) => cancelled.push(event.defaultPrevented)
    const beyond = jest.fn()
    container.addEventListener('click', onPage)
    document.addEventListener('click', beyond)
    await user.click(take)
    container.removeEventListener('click', onPage)
    document.removeEventListener('click', beyond)

    expect(cancelled).toEqual([true])
    expect(beyond).not.toHaveBeenCalled()
    expect(row).not.toHaveAttribute('open')
    expect(
      screen.getByRole('dialog', { name: 'Moving Backpack' }),
    ).toBeVisible()
  })

  it('opens the dialog for what is taken, from the party, into the seat’s character', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(
      screen.getByRole('button', { name: 'Take Potion of Healing' }),
    )
    expect(shown).toMatchObject({
      open: true,
      mode: 'take',
      mover: 'You',
      what: { item: expect.objectContaining({ id: 'potionHeal01' }) },
      from: { id: 'groupIronCo01', name: 'The Iron Company', primary: true },
      into: { id: 'actorThorin1', name: 'Thorin' },
    })
    expect(shown).not.toHaveProperty('receivers')

    await user.click(screen.getByRole('button', { name: 'Move it' }))
    await user.click(
      screen.getByRole('button', { name: 'Take coins from The Iron Company' }),
    )
    expect(shown?.what).toEqual({ coins: partyStash().currency })
  })

  it('keeps an open dialog open when the Take that opened it goes, as when the game stops taking moves', async () => {
    const user = userEvent.setup()
    const { rerender } = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Take Rope' }))

    rerender(
      <PartySheet
        api={API}
        role='player'
        view={movingPartyView({ moves: undefined })}
        takeInto={own}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Take Rope' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Moving Rope' })).toBeVisible()
  })

  it('closes its dialog rather than taking it away, for the browser to give focus back to the Take that opened it', async () => {
    real = true
    const user = userEvent.setup()
    renderSheet()
    const close = jest.spyOn(HTMLDialogElement.prototype, 'close')

    for (const how of ['Cancel', 'Close']) {
      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      const dialog = screen.getByRole('dialog', { name: 'Take Rope' })
      close.mockClear()
      await user.click(within(dialog).getByRole('button', { name: how }))
      expect(close).toHaveBeenCalledTimes(1)
      expect(dialog).toBeInTheDocument()
      expect(dialog).not.toHaveAttribute('open')
    }
    // Opened again, for another item, it's that item's.
    await user.click(
      screen.getByRole('button', { name: 'Take Potion of Healing' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Take Potion of Healing' }),
    ).toHaveAttribute('open')
    close.mockRestore()
  })

  it("never shows a character's own Give, from a sheet it's placed in", () => {
    const give: TransferControls = {
      item: item => ({
        aside: <button type='button'>Give {item.name}</button>,
        body: <button type='button'>Give {item.name}</button>,
      }),
      coins: () => <button type='button'>Give coins</button>,
    }
    for (const [takeInto, moves] of [
      [own, {}],
      [undefined, undefined],
      [own, undefined],
    ] as const) {
      const { unmount } = render(
        <Transferring controls={give}>
          <PartySheet
            api={API}
            role='player'
            view={movingPartyView({ moves })}
            takeInto={takeInto}
          />
        </Transferring>,
      )
      expect(screen.queryByRole('button', { name: /^Give/ })).toBeNull()
      unmount()
    }
  })

  describe('a move taken', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    it('posts it through the character’s API, with no label of a player’s, and says where it stands, its Take waiting', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
      renderSheet()

      made = {
        to: 'actorThorin1',
        items: [{ id: 'potionHeal01', quantity: 2 }],
        words: {
          verb: 'take',
          things: '2 Potion of Healing',
          other: 'The Iron Company',
          item: 'potionHeal01',
        },
      }
      await user.click(
        screen.getByRole('button', { name: 'Take Potion of Healing' }),
      )
      await user.click(screen.getByRole('button', { name: 'Move it' }))

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted()).toEqual({
        url: '/api/characters/char-1/rolls',
        body: {
          kind: 'transfer',
          transfer: {
            from: 'groupIronCo01',
            to: 'actorThorin1',
            items: [{ id: 'potionHeal01', quantity: 2 }],
          },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      })
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Sending to your Gamemaster’s game…')
      expect(status).toHaveAttribute('aria-live', 'polite')
      // The status is the first thing in the stash's tab.
      expect(
        screen.getByRole('tabpanel', { name: 'Inventory' }).firstElementChild,
      ).toContainElement(status)
      expect(
        status.querySelector('.animate-spin, [class*="animate-spin"]'),
      ).not.toBeNull()
      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()

      const potion = screen.getByRole('button', {
        name: 'Take Potion of Healing',
      })
      expect(potion).toBeDisabled()
      expect(potion).toHaveAttribute('aria-busy', 'true')
      // From module 0.33.0's feedback, the spinner is the row's, by the item's name: none of
      // Take's own.
      expect(potion.querySelector('svg')).toBeNull()
      const row = potion.closest('li') as HTMLElement
      expect(row).toHaveAttribute('aria-busy', 'true')
      expect(spinnersIn(row)).toEqual([spinnerBy(row, 'Potion of Healing')])
      expect(spinnerBy(row, 'Potion of Healing')).toHaveClass('size-3.5')
      // Another item, or the coin, may still be taken.
      const rope = screen.getByRole('button', { name: 'Take Rope' })
      expect(rope).toBeEnabled()
      expect(rope.closest('li')).not.toHaveAttribute('aria-busy')
      expect(spinnersIn(rope.closest('li') as HTMLElement)).toEqual([])
      expect(
        screen.getByRole('button', {
          name: 'Take coins from The Iron Company',
        }),
      ).toBeEnabled()
      expect(spinnersIn(currencyTerm())).toEqual([])

      jest.mocked(fetch).mockResolvedValue(
        respond(200, {
          id: 'req-move',
          status: 'done',
          visible: true,
          rolls: [],
        }),
      )
      await advance(CHECK_EVERY)
      expect(screen.getByRole('status')).toHaveTextContent(
        'Took 2 Potion of Healing from The Iron Company',
      )
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass(
        'text-primary',
      )
      expect(potion).toBeEnabled()
      expect(potion).not.toHaveAttribute('aria-busy')
      expect(row).not.toHaveAttribute('aria-busy')
      expect(spinnersIn(row)).toEqual([])
      expect(
        screen.getByRole('button', { name: 'Dismiss' }),
      ).toBeInTheDocument()
      // A move made clears itself a while after.
      await advance(6000)
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('gives where the move stands focus once it’s sent, as its Take waits for it and can’t be given focus back', async () => {
      real = true
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
      renderSheet()

      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      const dialog = screen.getByRole('dialog', { name: 'Take Rope' })
      await user.click(within(dialog).getByRole('button', { name: 'Take' }))

      expect(dialog).not.toHaveAttribute('open')
      expect(screen.getByRole('button', { name: 'Take Rope' })).toBeDisabled()
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Sending to your Gamemaster’s game…')
      expect(status.parentElement).toHaveFocus()
      expect(status.parentElement).toHaveAttribute('tabindex', '-1')
    })

    it("says why one wasn't taken, until it's dismissed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest
        .mocked(fetch)
        .mockResolvedValue(respond(422, { reason: 'not-owner' }))
      renderSheet()

      made = {
        to: 'actorThorin1',
        currency: { gp: 50 },
        words: { verb: 'take', things: '50 gp', other: 'The Iron Company' },
      }
      await user.click(
        screen.getByRole('button', {
          name: 'Take coins from The Iron Company',
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Move it' }))
      await advance(0)

      expect(posted().body.transfer).toEqual({
        from: 'groupIronCo01',
        to: 'actorThorin1',
        currency: { gp: 50 },
      })
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent(
        'Not taken: you need Owner on the party in Foundry',
      )
      expect(status).toHaveClass('text-warning')
      await advance(10_000)
      expect(screen.getByRole('status')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('waits the coin’s Take while coins are on their way', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
      renderSheet()
      made = {
        to: 'actorThorin1',
        currency: { sp: 7 },
        words: { verb: 'take', things: '7 sp', other: 'The Iron Company' },
      }
      await user.click(
        screen.getByRole('button', {
          name: 'Take coins from The Iron Company',
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Move it' }))

      const coins = screen.getByRole('button', {
        name: 'Take coins from The Iron Company',
      })
      expect(coins).toBeDisabled()
      expect(coins).toHaveAttribute('aria-busy', 'true')
      // From module 0.33.0's feedback, the spinner is the row's, by its label: none of Take's own.
      expect(coins.querySelector('svg')).toBeNull()
      expect(screen.getByRole('group', { name: 'Currency' })).toHaveAttribute(
        'aria-busy',
        'true',
      )
      expect(spinnersIn(currencyTerm())).toEqual([
        spinnerBy(currencyTerm(), 'Currency'),
      ])
      const rope = screen.getByRole('button', { name: 'Take Rope' })
      expect(rope).toBeEnabled()
      expect(spinnersIn(rope.closest('li') as HTMLElement)).toEqual([])
    })

    it("takes, on the Gamemaster's party page, into the character picked, saying so and naming the move", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
      const characters = [
        { id: 'actorThorin1', name: 'Thorin' },
        { id: 'actorVex0001', name: 'Vex' },
      ]
      renderSheet(choose, movingPartyView({ moves: { characters } }), 'gm')

      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      expect(shown).toMatchObject({ mode: 'take', receivers: characters })
      expect(shown).not.toHaveProperty('into')
      made = {
        to: 'actorVex0001',
        items: [{ id: 'rope00000001', quantity: 1 }],
        words: { verb: 'take', things: '1 Rope', other: 'The Iron Company' },
      }
      await user.click(screen.getByRole('button', { name: 'Move it' }))

      expect(posted()).toEqual({
        url: '/api/campaigns/c1/characters/actorVex0001/rolls',
        body: expect.objectContaining({
          kind: 'transfer',
          transfer: {
            from: 'groupIronCo01',
            to: 'actorVex0001',
            items: [{ id: 'rope00000001', quantity: 1 }],
          },
          label: 'Take 1 Rope from The Iron Company',
        }),
      })
      jest.mocked(fetch).mockResolvedValue(
        respond(200, {
          id: 'req-move',
          status: 'done',
          visible: true,
          rolls: [],
        }),
      )
      await advance(CHECK_EVERY)
      expect(screen.getByRole('status')).toHaveTextContent(
        'Vex took 1 Rope from The Iron Company',
      )
    })

    it("takes, on the Gamemaster's character page, into that character, as the Gamemaster", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
      renderSheet(
        { ...own, api: '/api/campaigns/c1/characters/actorThorin1' },
        movingPartyView({ moves: { characters: [] } }),
        'gm',
      )
      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      expect(shown).toMatchObject({
        mover: 'Thorin',
        into: { id: 'actorThorin1', name: 'Thorin' },
      })
      made = {
        to: 'actorThorin1',
        items: [{ id: 'rope00000001', quantity: 1 }],
        words: { verb: 'take', things: '1 Rope', other: 'The Iron Company' },
      }
      await user.click(screen.getByRole('button', { name: 'Move it' }))
      expect(posted().url).toBe(
        '/api/campaigns/c1/characters/actorThorin1/rolls',
      )
      expect(posted().body.label).toBe('Take 1 Rope from The Iron Company')
      // Its status words, as the Gamemaster reads them.
      expect(
        within(screen.getByRole('status')).getByText(/^Sending to your game…$/),
      ).toBeInTheDocument()
      // Once made, it says who took it: the character whose page it is.
      jest.mocked(fetch).mockResolvedValue(
        respond(200, {
          id: 'req-move',
          status: 'done',
          visible: true,
          rolls: [],
        }),
      )
      await advance(CHECK_EVERY)
      expect(screen.getByRole('status')).toHaveTextContent(
        'Thorin took 1 Rope from The Iron Company',
      )
    })
  })

  it('builds the API a pick is taken through, its ids escaped', () => {
    expect(chosenApi('c 1', 'a/b')).toBe(
      '/api/campaigns/c%201/characters/a%2Fb',
    )
  })
})
