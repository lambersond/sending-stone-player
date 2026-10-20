/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartySheet } from '@/components/party-sheet/party-sheet'
import {
  COMPANY_CHARACTERS,
  movingPartyView,
  partyStash,
  sendingPartyView,
} from '@/mocks/sending-stone'
import type { TakeInto } from './take-controls'
import type { PartyView } from '@/types/party'
import type { SheetCurrency } from '@/types/sending-stone'

const API = '/api/characters/char-1/party/groupIronCo01'
const own: TakeInto = {
  kind: 'own',
  actorId: 'actorThorin1',
  name: 'Thorin',
  api: '/api/characters/char-1',
}
const choose: TakeInto = { kind: 'choose', campaignId: 'c1' }

/** The Iron Company's coin: 4 pp, 103 gp, 8 sp and 3 cp. */
const COINS: SheetCurrency[] = [
  { id: 'pp', label: 'Platinum', abbreviation: 'pp', value: 4 },
  { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 103 },
  { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 8 },
  { id: 'cp', label: 'Copper', abbreviation: 'cp', value: 3 },
]

/** The Company's view, as Thorin's player has it, with its coin as given. */
const viewWith = (
  currency: SheetCurrency[] = COINS,
  fields: Partial<PartyView> = {},
): PartyView => {
  const view = sendingPartyView(fields)
  return {
    ...view,
    sheet: view.sheet && {
      ...view.sheet,
      inventory: { ...partyStash(), currency },
    },
  }
}

const sheetOf = (
  view: PartyView,
  takeInto: TakeInto | undefined = own,
  role: 'player' | 'gm' = 'player',
) => <PartySheet api={API} role={role} view={view} takeInto={takeInto} />

/** The Currency row's buttons, by their names, in order. */
const currencyButtons = () =>
  within(screen.getByRole('group', { name: 'Currency' }))
    .getAllByRole('button')
    .map(button => button.getAttribute('aria-label') ?? button.textContent)

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

/** What was posted, and where. */
const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

describe('components/transfers/party-controls', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(respond(202, { id: 'req-move' })),
    ) as typeof fetch
  })

  describe('the Currency row', () => {
    it('offers an Owner Take, Send to, Give and Distribute, in that order, on the label’s row', () => {
      render(sheetOf(viewWith()))

      expect(currencyButtons()).toEqual([
        'Take coins from The Iron Company',
        'Send to',
        'Give',
        'Distribute',
      ])
      const group = screen.getByRole('group', { name: 'Currency' })
      for (const button of within(group).getAllByRole('button')) {
        expect(button).toHaveAttribute('aria-haspopup', 'dialog')
        expect(button).toHaveAttribute('type', 'button')
      }
      // Send to, Give and Distribute are named by their words.
      expect(
        within(group).getByRole('button', { name: 'Send to' }),
      ).not.toHaveAttribute('aria-label')
    })

    it('offers each under its own condition', () => {
      // No whole coin in the party: only Give, of the character's.
      const { rerender } = render(
        sheetOf(
          viewWith([
            { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 0.5 },
          ]),
        ),
      )
      expect(currencyButtons()).toEqual(['Give'])

      // No one to share among, nowhere to send, and none of the character's coin.
      rerender(
        sheetOf(
          viewWith(COINS, {
            moves: {
              send: { parties: [], characters: [] },
              distribute: [],
              give: { currency: [] },
            },
          }),
        ),
      )
      expect(currencyButtons()).toEqual(['Take coins from The Iron Company'])

      // A 0.31.0 module: Take, and a player's Give, which it makes.
      rerender(
        sheetOf(
          viewWith(COINS, {
            moves: { give: sendingPartyView().moves?.give },
          }),
        ),
      )
      expect(currencyButtons()).toEqual([
        'Take coins from The Iron Company',
        'Give',
      ])
    })

    it('shows no group named Currency where it offers nothing, as to an Observer or with no whole coin anywhere', () => {
      const { rerender } = render(
        sheetOf(viewWith(COINS, { moves: undefined })),
      )
      expect(screen.getByText('Currency')).toBeVisible()
      expect(screen.queryByRole('group', { name: 'Currency' })).toBeNull()

      rerender(
        sheetOf(
          viewWith(
            [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 0.5 }],
            {
              moves: {
                send: sendingPartyView().moves?.send,
                distribute: [],
                give: {
                  currency: [
                    { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 0 },
                  ],
                },
              },
            },
          ),
        ),
      )
      expect(screen.queryByRole('group', { name: 'Currency' })).toBeNull()
      expect(
        screen.queryByRole('button', {
          name: /^(Take coins from The Iron Company|Send to|Give|Distribute)$/,
        }),
      ).toBeNull()
    })

    it('gives the Gamemaster’s party page Take alone, and their panel at a character no Give', () => {
      const { rerender } = render(
        sheetOf(
          viewWith(COINS, {
            moves: {
              characters: COMPANY_CHARACTERS,
              ...sendingPartyView().moves,
            },
          }),
          choose,
          'gm',
        ),
      )
      expect(currencyButtons()).toEqual(['Take coins from The Iron Company'])
      expect(screen.queryByRole('button', { name: 'Send to…' })).toBeNull()

      rerender(
        sheetOf(
          viewWith(COINS, {
            moves: {
              characters: COMPANY_CHARACTERS,
              send: sendingPartyView().moves?.send,
              distribute: COMPANY_CHARACTERS,
            },
          }),
          { ...own, name: 'Vex', actorId: 'actorVex0001' },
          'gm',
        ),
      )
      expect(currencyButtons()).toEqual([
        'Take coins from The Iron Company',
        'Send to',
        'Distribute',
      ])
    })

    it('waits, each of them, while a coins move of the sheet’s is on its way', async () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as typeof fetch
      const user = userEvent.setup()
      render(sheetOf(viewWith()))

      await user.click(screen.getByRole('button', { name: 'Give' }))
      const dialog = screen.getByRole('dialog', { name: 'Give coins' })
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Gold' }),
        '5',
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Give coins' }),
      )

      const group = screen.getByRole('group', { name: 'Currency' })
      for (const button of within(group).getAllByRole('button')) {
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('aria-busy', 'true')
      }
    })
  })

  describe('what each opens and sends', () => {
    it('sends the party’s coins to anyone but the party, through the character’s API', async () => {
      const user = userEvent.setup()
      render(sheetOf(viewWith()))

      await user.click(screen.getByRole('button', { name: 'Send to' }))
      const dialog = screen.getByRole('dialog', { name: 'Send coins' })
      expect(within(dialog).getByText('From The Iron Company')).toBeVisible()
      expect(
        within(dialog)
          .getAllByRole('radio')
          .map(radio => radio.getAttribute('value')),
      ).not.toContain('groupIronCo01')
      await user.click(within(dialog).getByRole('radio', { name: 'Vex' }))
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Gold' }),
        '2',
      )
      expect(
        within(dialog).getByText('You send 2 gp from The Iron Company to Vex.'),
      ).toBeVisible()
      await user.click(
        within(dialog).getByRole('button', { name: 'Send coins' }),
      )

      expect(posts()).toEqual([
        {
          url: '/api/characters/char-1/rolls',
          body: expect.objectContaining({
            kind: 'transfer',
            transfer: {
              from: 'groupIronCo01',
              to: 'actorVex0001',
              currency: { gp: 2 },
            },
          }),
        },
      ])
      expect(posts()[0].body).not.toHaveProperty('label')
      expect(await screen.findByRole('status')).toHaveTextContent(
        /^Sending to your Gamemaster’s game…$/,
      )
    })

    it('sends an item from its opened row’s Send to… pill', async () => {
      const user = userEvent.setup()
      render(sheetOf(viewWith()))

      await user.click(screen.getByText('Rope'))
      const pill = screen.getByRole('button', { name: 'Send to…' })
      expect(pill).not.toHaveAttribute('aria-label')
      await user.click(pill)
      const dialog = screen.getByRole('dialog', { name: 'Send Rope' })
      await user.click(
        within(dialog).getByRole('radio', { name: 'Wardens of the Vale' }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Send' }))
      expect(posts()[0].body.transfer).toEqual({
        from: 'groupIronCo01',
        to: 'groupWarden1',
        items: [{ id: 'rope00000001', quantity: 1 }],
      })
    })

    it('gives the character’s coins to the party', async () => {
      const user = userEvent.setup()
      render(sheetOf(viewWith()))

      await user.click(screen.getByRole('button', { name: 'Give' }))
      const dialog = screen.getByRole('dialog', { name: 'Give coins' })
      expect(within(dialog).queryByRole('radio')).toBeNull()
      expect(within(dialog).getByText(/of 65 gp/)).toBeVisible()
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Gold' }),
        '15',
      )
      expect(
        within(dialog).getByText('You give 15 gp to The Iron Company.'),
      ).toBeVisible()
      await user.click(
        within(dialog).getByRole('button', { name: 'Give coins' }),
      )
      expect(posts()[0].body.transfer).toEqual({
        from: 'actorThorin1',
        to: 'groupIronCo01',
        currency: { gp: 15 },
      })
    })

    it('distributes a coin among the party’s characters, labelled for the Gamemaster', async () => {
      const user = userEvent.setup()
      render(
        sheetOf(
          viewWith(COINS, {
            moves: {
              characters: COMPANY_CHARACTERS,
              distribute: COMPANY_CHARACTERS,
            },
          }),
          { ...own, name: 'Vex', actorId: 'actorVex0001' },
          'gm',
        ),
      )

      await user.click(screen.getByRole('button', { name: 'Distribute' }))
      const dialog = screen.getByRole('dialog', { name: 'Distribute coins' })
      await user.click(
        within(dialog).getByRole('radio', { name: 'Platinum 4 pp' }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Distribute' }),
      )
      expect(posts()[0].body).toEqual(
        expect.objectContaining({
          transfer: {
            from: 'groupIronCo01',
            among: COMPANY_CHARACTERS.map(({ id }) => id),
            currency: { pp: 4 },
          },
          label:
            'Distribute 4 pp from The Iron Company among Bram, Lia, Thorin, and Vex',
        }),
      )
    })

    it('sends what its dialog opened with, though the view changes while it’s open', async () => {
      const user = userEvent.setup()
      const { rerender } = render(sheetOf(viewWith()))

      await user.click(screen.getByRole('button', { name: 'Distribute' }))
      // Lia leaves the party, and its gold goes, while the dialog is open.
      rerender(
        sheetOf(
          viewWith(
            COINS.map(coin =>
              coin.id === 'gp' ? { ...coin, value: 3 } : coin,
            ),
            {
              moves: {
                ...sendingPartyView().moves,
                distribute: COMPANY_CHARACTERS.filter(
                  ({ name }) => name !== 'Lia',
                ),
              },
            },
          ),
        ),
      )
      const dialog = screen.getByRole('dialog', { name: 'Distribute coins' })
      expect(
        within(within(dialog).getByRole('list', { name: 'Among' }))
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Bram', 'Lia', 'Thorin', 'Vex'])
      await user.click(
        within(dialog).getByRole('radio', { name: 'Gold 103 gp' }),
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Distribute' }),
      )
      // The server says the members changed, rather than sharing among others than it said.
      expect(posts()[0].body.transfer).toEqual({
        from: 'groupIronCo01',
        among: COMPANY_CHARACTERS.map(({ id }) => id),
        currency: { gp: 103 },
      })
    })

    it('offers no Send to… pill, nor menu, where the seat may not send', async () => {
      const user = userEvent.setup()
      render(sheetOf(movingPartyView()))

      await user.click(screen.getByText('Backpack'))
      expect(screen.queryByRole('button', { name: 'Send to…' })).toBeNull()
    })
  })
})
