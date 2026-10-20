import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoinFields, coinsMoved, movableCoins } from './coin-fields'
import { MOST_MOVED } from '@/constants/sending-stone'
import type { SheetCurrency } from '@/types/sending-stone'

const purse: SheetCurrency[] = [
  { id: 'pp', label: 'Platinum', abbreviation: 'pp', value: 0 },
  // dnd5e 6 holds part of a coin, which can't be moved.
  { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 10.5 },
  { id: 'ep', label: 'Electrum', abbreviation: 'ep', value: 0.5 },
  { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 1200 },
]

/** The fields as a dialog holds them: what's typed, by coin. */
function Held({ currency = purse }: Readonly<{ currency?: SheetCurrency[] }>) {
  const [value, setValue] = useState<Record<string, string>>({})
  const moved = coinsMoved(currency, value)
  return (
    <>
      <CoinFields currency={currency} value={value} onChange={setValue} />
      <output aria-label='Moved'>
        {moved ? JSON.stringify(moved) : 'none'}
      </output>
    </>
  )
}

const moved = () => screen.getByRole('status', { name: 'Moved' })

describe('components/transfers/coin-fields', () => {
  it('lists only coins there is a whole one of, in the sheet’s order, of as many as there are', () => {
    render(<Held />)
    const coins = screen.getByRole('group', { name: 'Coins' })
    expect(within(coins).getAllByRole('textbox')).toEqual([
      screen.getByRole('textbox', { name: 'Gold' }),
      screen.getByRole('textbox', { name: 'Silver' }),
    ])
    expect(screen.queryByRole('textbox', { name: 'Platinum' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Electrum' })).toBeNull()
    // 10.5 gp is 10 to move.
    expect(screen.getByText('of 10 gp')).toBeVisible()
    expect(screen.getByText('of 1,200 sp')).toBeVisible()
    const gold = screen.getByRole('textbox', { name: 'Gold' })
    expect(gold).toHaveAttribute('inputmode', 'numeric')
    expect(gold).toHaveAttribute('pattern', '[0-9]*')
    expect(gold).toHaveValue('')
  })

  it('floors each coin, and holds no more than may be moved', () => {
    expect(
      movableCoins([
        ...purse,
        { id: 'cp', label: 'Copper', abbreviation: 'cp', value: 1e9 },
      ]).map(({ id, max }) => [id, max]),
    ).toEqual([
      ['gp', 10],
      ['sp', 1200],
      ['cp', MOST_MOVED],
    ])
  })

  it('moves nothing while every field is empty, or none is more than 0', async () => {
    const user = userEvent.setup()
    render(<Held />)
    expect(moved()).toHaveTextContent('none')
    await user.type(screen.getByRole('textbox', { name: 'Gold' }), '0')
    expect(moved()).toHaveTextContent('none')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.type(screen.getByRole('textbox', { name: 'Silver' }), '25')
    expect(moved()).toHaveTextContent('{"sp":25}')
  })

  it('says of a row typed as more than there is, or not as a number, what it takes, moving nothing', async () => {
    const user = userEvent.setup()
    render(<Held />)
    await user.type(screen.getByRole('textbox', { name: 'Silver' }), '5')
    const gold = screen.getByRole('textbox', { name: 'Gold' })
    await user.type(gold, '11')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole number up to 10.',
    )
    expect(gold).toHaveAttribute('aria-invalid', 'true')
    expect(moved()).toHaveTextContent('none')
    await user.clear(gold)
    await user.type(gold, '1,0')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole number up to 10.',
    )
    await user.clear(gold)
    await user.type(gold, '10')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(moved()).toHaveTextContent('{"gp":10,"sp":5}')
  })

  it('takes all of a coin at a tap', async () => {
    const user = userEvent.setup()
    render(<Held />)
    await user.click(screen.getByRole('button', { name: 'All Gold' }))
    expect(screen.getByRole('textbox', { name: 'Gold' })).toHaveValue('10')
    expect(moved()).toHaveTextContent('{"gp":10}')
  })
})
