import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DistributeDialog,
  type DistributeDialogProps,
} from './distribute-dialog'
import { TableApiContext } from '@/hooks/use-table-api'
import { COMPANY_CHARACTERS } from '@/mocks/sending-stone'
import type { SheetCurrency } from '@/types/sending-stone'

const party = { id: 'groupIronCo01', name: 'The Iron Company', primary: true }
/** The Iron Company's coin: 4 pp, 103 gp, 8 sp and 3 cp, and no ep at all. */
const coins: SheetCurrency[] = [
  { id: 'pp', label: 'Platinum', abbreviation: 'pp', value: 4 },
  { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 103 },
  { id: 'ep', label: 'Electrum', abbreviation: 'ep', value: 0 },
  { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 8 },
  { id: 'cp', label: 'Copper', abbreviation: 'cp', value: 3 },
]

const renderDialog = (
  props: Partial<DistributeDialogProps> = {},
  role: 'player' | 'gm' = 'player',
) => {
  const onMove = jest.fn()
  const onClose = jest.fn()
  render(
    <TableApiContext value={{ role, api: '/api/x', key: 'x' }}>
      <DistributeDialog
        open
        onClose={onClose}
        mover='You'
        from={party}
        currency={coins}
        among={COMPANY_CHARACTERS}
        onMove={onMove}
        {...props}
      />
    </TableApiContext>,
  )
  return { onMove, onClose }
}

const summary = () =>
  screen.getByText(/^(You|Thorin) |^Choose |^There /, { selector: 'p' })
const distribute = () => screen.getByRole('button', { name: 'Distribute' })

describe('components/transfers/distribute-dialog', () => {
  it('lists the party’s whole coins, those too few to share among them disabled and said so', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Distribute coins' })
    expect(within(dialog).getByText('From The Iron Company')).toBeVisible()
    const coin = within(
      within(dialog).getByRole('group', { name: 'Coin' }),
    ).getAllByRole('radio')
    // Named by their words, as "Gold 103 gp".
    for (const radio of coin) expect(radio).not.toHaveAttribute('aria-label')
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map(radio => (radio.closest('label') as HTMLElement).textContent),
    ).toEqual(['Platinum 4 pp', 'Gold 103 gp', 'Silver 8 sp', 'Copper 3 cp'])
    for (const name of ['Platinum 4 pp', 'Gold 103 gp', 'Silver 8 sp']) {
      expect(screen.getByRole('radio', { name })).toBeEnabled()
    }
    const copper = screen.getByRole('radio', { name: 'Copper 3 cp' })
    expect(copper).toBeDisabled()
    expect(copper).toHaveAccessibleDescription('Too few to share among 4')
    // None is chosen at first.
    expect(
      within(dialog)
        .getAllByRole('radio')
        .some(radio => (radio as HTMLInputElement).checked),
    ).toBe(false)
    expect(summary()).toHaveTextContent(/^Choose a coin\.$/)
    expect(screen.queryByText('Foundry’s chat will say so.')).toBeNull()
    expect(distribute()).toHaveAttribute('aria-disabled', 'true')
  })

  it('lists who shares it, in the sheet’s order', () => {
    renderDialog()

    const among = screen.getByRole('list', { name: 'Among' })
    expect(
      within(among)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['Bram', 'Lia', 'Thorin', 'Vex'])
  })

  it('does nothing until a coin is chosen', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog()

    await user.click(distribute())
    expect(onMove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says what each is given and what stays, and distributes all of the coin chosen', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog()

    await user.click(screen.getByRole('radio', { name: 'Gold 103 gp' }))
    expect(summary()).toHaveTextContent(
      'You distribute 100 gp among Bram, Lia, Thorin, and Vex: 25 gp each. 3 gp stays with The Iron Company.',
    )
    expect(screen.getByText('Foundry’s chat will say so.')).toBeVisible()
    expect(distribute()).not.toHaveAttribute('aria-disabled')
    await user.click(distribute())
    expect(onMove).toHaveBeenCalledWith({
      among: ['actorBram001', 'actorLia0001', 'actorThorin1', 'actorVex0001'],
      currency: { gp: 103 },
      words: {
        verb: 'distribute',
        things: '100 gp',
        other: 'The Iron Company',
        among: 'Bram, Lia, Thorin, and Vex',
        each: '25 gp',
      },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('says nothing stays where the coin shares out evenly', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('radio', { name: 'Silver 8 sp' }))
    expect(summary()).toHaveTextContent(
      'You distribute 8 sp among Bram, Lia, Thorin, and Vex: 2 sp each. Nothing stays with The Iron Company.',
    )
  })

  it('says the Gamemaster’s in the character’s name, which their words carry', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog({ mover: 'Thorin' }, 'gm')

    await user.click(screen.getByRole('radio', { name: 'Platinum 4 pp' }))
    expect(summary()).toHaveTextContent(
      'Thorin distributes 4 pp among Bram, Lia, Thorin, and Vex: 1 pp each. Nothing stays with The Iron Company.',
    )
    await user.click(distribute())
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: { pp: 4 },
        words: expect.objectContaining({ mover: 'Thorin', each: '1 pp' }),
      }),
    )
  })

  it('says there isn’t a whole coin for each where none can be chosen', () => {
    renderDialog({
      currency: [
        { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 3.5 },
        { id: 'cp', label: 'Copper', abbreviation: 'cp', value: 2 },
      ],
    })

    expect(summary()).toHaveTextContent(
      /^There isn’t a whole coin for each of them\.$/,
    )
    expect(screen.getByRole('radio', { name: 'Gold 3 gp' })).toBeDisabled()
    expect(distribute()).toHaveAttribute('aria-disabled', 'true')
  })

  it('shares only whole coins, as dnd5e 6 may hold part of one', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog({
      currency: [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 103.5 }],
    })

    await user.click(screen.getByRole('radio', { name: 'Gold 103 gp' }))
    await user.click(distribute())
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ currency: { gp: 103 } }),
    )
  })
})
