import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandOutDialog } from './hand-out-dialog'
import { purse } from '@/mocks/sending-stone'
import type { HandOutDialogProps } from './types'
import type { MoveEnd } from '@/features/transfers/types'

const VEX = { id: 'actorVex0001', name: 'Vex' }
const BRAM = { id: 'actorBram001', name: 'Bram' }
const LIA = { id: 'actorLia0001', name: 'Lia' }
/** The campaign's other characters, in its roster's order. */
const OTHERS: MoveEnd[] = [VEX, BRAM, LIA]
const ABBREVIATIONS = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }

const renderDialog = (props: Partial<HandOutDialogProps> = {}) => {
  const all: HandOutDialogProps = {
    open: true,
    onClose: jest.fn(),
    role: 'player',
    name: 'Thorin',
    // 700 pp and 20 gp: 200 pp and 50 gp each to three leaves 87 pp.
    currency: purse({ pp: 700, gp: 20 }),
    characters: OTHERS,
    change: true,
    onHandOut: jest.fn(),
    ...props,
  }
  render(<HandOutDialog {...all} />)
  const dialog = within(screen.getByRole('dialog', { name: 'Hand out coins' }))
  const user = userEvent.setup()
  return {
    ...all,
    dialog,
    user,
    send: () => dialog.getByRole('button', { name: 'Hand out' }),
    tick: (name: string) => user.click(dialog.getByRole('checkbox', { name })),
    type: (coin: string, count: string) =>
      user.type(
        within(dialog.getByRole('group', { name: 'Each gets' })).getByRole(
          'textbox',
          { name: coin },
        ),
        count,
      ),
  }
}

describe('features/transfers/hand-out-dialog', () => {
  it('asks who gets them, then how many each gets, and hands nothing out until both are chosen', async () => {
    const { dialog, user, send, tick, type, onHandOut } = renderDialog()

    expect(dialog.getByRole('group', { name: 'To' })).toBeVisible()
    expect(dialog.getByText('Choose who gets them.')).toBeVisible()
    expect(send()).toHaveAttribute('aria-disabled', 'true')
    await type('Gold', '50')
    expect(dialog.getByText('Choose who gets them.')).toBeVisible()
    await tick('Vex')
    await user.clear(dialog.getByRole('textbox', { name: 'Gold' }))
    expect(dialog.getByText('Choose how many each gets.')).toBeVisible()
    await user.click(send())
    expect(onHandOut).not.toHaveBeenCalled()
  })

  it('says what each gets and what that is in all, that other coins pay for the rest, and sends what each gets to those ticked, in the list’s order', async () => {
    const { dialog, user, send, tick, type, onHandOut, onClose } =
      renderDialog()
    await tick('Lia')
    await tick('Vex')
    await tick('Bram')
    await type('Gold', '50')
    await type('Platinum', '200')

    expect(
      dialog.getByText(
        'You hand out 200 pp and 50 gp each to Vex, Bram, and Lia: 600 pp and 150 gp in all. You hold only 20 gp, so other coins pay for the rest.',
      ),
    ).toBeVisible()
    expect(
      dialog.getByText(
        'Each is whispered what they received in Foundry’s chat, and your Gamemaster is told.',
      ),
    ).toBeVisible()
    await user.click(send())

    expect(onHandOut).toHaveBeenCalledWith({
      each: [VEX.id, BRAM.id, LIA.id],
      currency: { pp: 200, gp: 50 },
      words: {
        verb: 'handOut',
        things: '200 pp and 50 gp',
        other: 'Thorin',
        among: 'Vex, Bram, and Lia',
        abbreviations: ABBREVIATIONS,
      },
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each<[string, Partial<HandOutDialogProps>, string, string]>([
    [
      'more than the giver’s coins are worth',
      {},
      '300',
      'You haven’t that much: 900 pp in all is more than your coins are worth.',
    ],
    [
      'more of a coin than is held, where the game pays with no other',
      { change: false, currency: purse({ pp: 700, gp: 20 }) },
      '250',
      'You hold only 700 pp of the 750 pp in all, and your Gamemaster’s game doesn’t pay with other coins.',
    ],
    [
      'one of a coin, where the game pays with no other',
      { change: false, currency: purse({ pp: 1, gp: 3000 }) },
      '1',
      'You hold only 1 pp of the 3 pp in all, and your Gamemaster’s game doesn’t pay with other coins.',
    ],
    [
      'a coin the giver holds none of, where the game pays with no other',
      { change: false, currency: purse({ gp: 3000 }) },
      '1',
      'You hold none of the 3 pp in all, and your Gamemaster’s game doesn’t pay with other coins.',
    ],
    [
      'the Gamemaster’s, more than the character’s coins are worth',
      { role: 'gm' },
      '300',
      'Thorin hasn’t that much: 900 pp in all is more than their coins are worth.',
    ],
  ])(
    'hands nothing out of %s, and says why',
    async (_name, props, platinum, summary) => {
      const { dialog, user, send, tick, type, onHandOut } = renderDialog(props)
      for (const name of ['Vex', 'Bram', 'Lia']) await tick(name)
      await type('Platinum', platinum)

      expect(dialog.getByText(summary)).toBeVisible()
      expect(send()).toHaveAttribute('aria-disabled', 'true')
      expect(dialog.queryByText(/is whispered what they received/)).toBeNull()
      await user.click(send())
      expect(onHandOut).not.toHaveBeenCalled()
    },
  )

  it('says the Gamemaster’s in the character’s name, and that they are told', async () => {
    const { dialog, user, send, tick, type, onHandOut } = renderDialog({
      role: 'gm',
    })
    await tick('Vex')
    await tick('Bram')
    await type('Gold', '2')

    expect(
      dialog.getByText(
        'Thorin hands out 2 gp each to Vex and Bram: 4 gp in all.',
      ),
    ).toBeVisible()
    expect(
      dialog.getByText(
        'Each is whispered what they received in Foundry’s chat, and you are told.',
      ),
    ).toBeVisible()
    await user.click(send())
    expect(jest.mocked(onHandOut).mock.calls[0][0].words).toMatchObject({
      verb: 'handOut',
      mover: 'Thorin',
    })
  })

  it('hands out to no more than twenty at a time', async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      id: `actor${index + 1}`,
      name: `Character ${index + 1}`,
    }))
    const { dialog, send, tick, type } = renderDialog({ characters: many })
    for (const { name } of many) await tick(name)
    await type('Gold', '1')

    expect(dialog.getByText('Choose up to 20 at a time.')).toBeVisible()
    expect(send()).toHaveAttribute('aria-disabled', 'true')
    await tick('Character 21')
    expect(
      dialog.getByText(/^You hand out 1 gp each to .*: 20 gp in all\.$/),
    ).toBeVisible()
    expect(send()).not.toHaveAttribute('aria-disabled')
  })
})
