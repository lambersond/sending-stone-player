import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoinsDialog } from './coins-dialog'
import { purse } from '@/mocks/sending-stone'
import type { CoinsDialogProps } from './types'

/** Thorin's coins: 2 pp and 3 gp, worth 23 gp, with 40 sp more where a case says. */
const HELD = purse({ pp: 2, gp: 3 })
const ABBREVIATIONS = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }

const renderDialog = (props: Partial<CoinsDialogProps> = {}) => {
  const all: CoinsDialogProps = {
    open: true,
    onClose: jest.fn(),
    role: 'player',
    name: 'Thorin',
    currency: HELD,
    change: true,
    onChange: jest.fn(),
    ...props,
  }
  render(<CoinsDialog {...all} />)
  const dialog = screen.getByRole('dialog', { name: 'Add or remove coins' })
  return { ...all, dialog: within(dialog), user: userEvent.setup() }
}

/** The dialog's main button, whatever it reads now: the last of its buttons. */
const send = (dialog: ReturnType<typeof within>) =>
  dialog.getAllByRole('button').at(-1) as HTMLElement

// Changed on purpose (item give): Add or take away reads Add or remove, its choices Add and Remove.
describe('features/transfers/coins-dialog', () => {
  it('asks which first, then how many, its button saying what it’ll do only once chosen', async () => {
    const { dialog, user, onChange, onClose } = renderDialog()

    expect(dialog.getByRole('radio', { name: 'Add' })).not.toBeChecked()
    expect(dialog.getByRole('radio', { name: 'Remove' })).not.toBeChecked()
    expect(dialog.getByText('Choose Add or Remove.')).toBeVisible()
    expect(send(dialog)).toHaveTextContent(/^Add or remove$/)
    expect(send(dialog)).toHaveAttribute('aria-disabled', 'true')
    expect(dialog.queryByText('Foundry’s chat will say so.')).toBeNull()
    // Typing alone chooses neither.
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
    expect(dialog.getByText('Choose Add or Remove.')).toBeVisible()
    await user.click(send(dialog))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(dialog.getByRole('radio', { name: 'Remove' }))
    expect(send(dialog)).toHaveTextContent(/^Remove coins$/)
    await user.clear(dialog.getByRole('textbox', { name: 'Gold' }))
    expect(dialog.getByText('Choose how many.')).toBeVisible()
    expect(send(dialog)).toHaveAttribute('aria-disabled', 'true')

    await user.click(dialog.getByRole('radio', { name: 'Add' }))
    expect(send(dialog)).toHaveTextContent(/^Add coins$/)
    await user.click(send(dialog))
    expect(onChange).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('adds coins whatever is held, in the sheet’s order, sent as received', async () => {
    const { dialog, user, onChange, onClose } = renderDialog({
      currency: purse({}),
    })
    await user.click(dialog.getByRole('radio', { name: 'Add' }))
    await user.type(dialog.getByRole('textbox', { name: 'Silver' }), '3')
    await user.type(dialog.getByRole('textbox', { name: 'Platinum' }), '2')

    expect(dialog.getByText('You add 2 pp and 3 sp.')).toBeVisible()
    expect(dialog.getByText('Foundry’s chat will say so.')).toBeVisible()
    expect(send(dialog)).not.toHaveAttribute('aria-disabled')
    await user.click(send(dialog))

    expect(onChange).toHaveBeenCalledWith({
      coins: { op: 'add', currency: { pp: 2, sp: 3 } },
      words: { verb: 'receive', things: '2 pp and 3 sp', other: 'Thorin' },
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each<
    [
      string,
      Partial<CoinsDialogProps>,
      Record<string, string>,
      string,
      'sent' | 'held back',
    ]
  >([
    ['coins it holds', {}, { Gold: '3' }, 'You remove 3 gp.', 'sent'],
    [
      'more of a coin than it holds, which its other coins pay',
      {},
      { Gold: '5' },
      'You remove 5 gp. You hold only 3 gp, so other coins pay for the rest.',
      'sent',
    ],
    [
      'a coin it holds none of, which its other coins pay',
      {},
      { Silver: '7' },
      'You remove 7 sp. You hold no sp, so other coins pay for the rest.',
      'sent',
    ],
    [
      'more of a coin than the one it holds, which its other coins pay',
      { currency: purse({ pp: 2, gp: 1 }) },
      { Gold: '2' },
      'You remove 2 gp. You hold only 1 gp, so other coins pay for the rest.',
      'sent',
    ],
    [
      'more than its coins are worth',
      {},
      { Gold: '25' },
      'You haven’t that much: 25 gp is more than your coins are worth.',
      'held back',
    ],
    [
      'more of a coin than it holds, where the game pays with no other',
      { change: false },
      { Gold: '5' },
      'You hold only 3 gp, and your Gamemaster’s game doesn’t pay with other coins.',
      'held back',
    ],
    [
      'more of a coin the app can’t rate, which the game is left to decide',
      {
        currency: HELD.map(coin =>
          coin.id === 'gp' ? { ...coin, conversion: null } : coin,
        ),
      },
      { Gold: '5' },
      'You remove 5 gp.',
      'sent',
    ],
    [
      'more of a coin the app can’t rate, where the game pays with no other, which it would refuse',
      {
        change: false,
        currency: HELD.map(coin =>
          coin.id === 'gp' ? { ...coin, conversion: null } : coin,
        ),
      },
      { Gold: '5' },
      'You hold only 3 gp, and your Gamemaster’s game doesn’t pay with other coins.',
      'held back',
    ],
    [
      'the Gamemaster’s, more of a coin than the character holds',
      { role: 'gm' },
      { Gold: '5' },
      'Thorin removes 5 gp. Thorin holds only 3 gp, so other coins pay for the rest.',
      'sent',
    ],
    [
      'the Gamemaster’s, more than the character’s coins are worth',
      { role: 'gm' },
      { Gold: '25' },
      'Thorin hasn’t that much: 25 gp is more than their coins are worth.',
      'held back',
    ],
    [
      'the Gamemaster’s, where their game pays with no other coin',
      { role: 'gm', change: false },
      { Gold: '5' },
      'Thorin holds only 3 gp, and your game doesn’t pay with other coins.',
      'held back',
    ],
  ])(
    'says what removing does: %s',
    async (_name, props, typed, summary, outcome) => {
      const { dialog, user, onChange } = renderDialog(props)
      await user.click(dialog.getByRole('radio', { name: 'Remove' }))
      for (const [coin, count] of Object.entries(typed)) {
        await user.type(dialog.getByRole('textbox', { name: coin }), count)
      }

      expect(dialog.getByText(summary)).toBeVisible()
      await user.click(send(dialog))
      if (outcome === 'sent') {
        expect(dialog.getByText('Foundry’s chat will say so.')).toBeVisible()
        expect(onChange).toHaveBeenCalledTimes(1)
      } else {
        expect(send(dialog)).toHaveAttribute('aria-disabled', 'true')
        expect(dialog.queryByText('Foundry’s chat will say so.')).toBeNull()
        expect(onChange).not.toHaveBeenCalled()
      }
    },
  )

  it('sends coins removed as paid, with the sheet’s abbreviations for what else the game uses, in the character’s name at the Gamemaster’s page', async () => {
    const { dialog, user, onChange } = renderDialog({ role: 'gm' })
    await user.click(dialog.getByRole('radio', { name: 'Remove' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
    await user.click(send(dialog))

    expect(onChange).toHaveBeenCalledWith({
      coins: { op: 'remove', currency: { gp: 5 } },
      words: {
        verb: 'pay',
        things: '5 gp',
        other: 'Thorin',
        mover: 'Thorin',
        abbreviations: ABBREVIATIONS,
      },
    })
  })

  it('says the Gamemaster’s add in the character’s name', async () => {
    const { dialog, user } = renderDialog({ role: 'gm' })
    await user.click(dialog.getByRole('radio', { name: 'Add' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
    expect(dialog.getByText('Thorin adds 5 gp.')).toBeVisible()
  })

  it('closes on Cancel, changing nothing', async () => {
    const { dialog, user, onChange, onClose } = renderDialog()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
