import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoinAmounts } from './coin-amounts'
import { purse } from '@/mocks/sending-stone'
import type { SheetCurrency } from '@/types/sending-stone'

/** The fields, holding what's typed as a dialog does. */
function Fields({ currency }: Readonly<{ currency: SheetCurrency[] }>) {
  const [value, setValue] = useState<Record<string, string>>({})
  return (
    <CoinAmounts
      legend='Coins'
      currency={currency}
      value={value}
      onChange={setValue}
    />
  )
}

describe('features/transfers/coin-amounts', () => {
  it('has a field for every coin the sheet lists, in its order, saying how many whole ones are held', () => {
    // dnd5e 6 may hold part of a coin, of which only the whole ones count.
    render(<Fields currency={purse({ pp: 2, gp: 1041.5 })} />)
    const group = screen.getByRole('group', { name: 'Coins' })

    expect(
      within(group)
        .getAllByRole('textbox')
        .map(field => field.getAttribute('aria-describedby'))
        .map(id => document.querySelector(`#${CSS.escape(id ?? '')}`))
        .map(said => said?.textContent),
    ).toEqual([
      '2 pp held',
      '1,041 gp held',
      '0 ep held',
      '0 sp held',
      '0 cp held',
    ])
    expect(within(group).getByRole('textbox', { name: 'Gold' })).toHaveValue('')
    // None is capped at what's held: there's no All, as a move's coins have.
    expect(within(group).queryByRole('button')).toBeNull()
  })

  it('takes more than is held, and says what’s typed wrong under its own field alone', async () => {
    const user = userEvent.setup()
    render(<Fields currency={purse({ gp: 3 })} />)
    const gold = screen.getByRole('textbox', { name: 'Gold' })
    const silver = screen.getByRole('textbox', { name: 'Silver' })

    await user.type(gold, '500')
    expect(gold).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).toBeNull()

    await user.type(silver, '10000001')
    expect(silver).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole number up to 10,000,000.',
    )
    expect(silver).toHaveAccessibleDescription(
      '0 sp held Enter a whole number up to 10,000,000.',
    )
    expect(gold).not.toHaveAttribute('aria-invalid')

    await user.clear(silver)
    await user.type(silver, 'x')
    expect(screen.getByRole('alert')).toBeVisible()
    await user.clear(silver)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
