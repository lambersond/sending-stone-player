import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountField, amountOf, typedCount } from './amount-field'

/** The field as a dialog holds it: what's typed, from 1. */
function Held({ max, start = '1' }: Readonly<{ max: number; start?: string }>) {
  const [value, setValue] = useState(start)
  return (
    <>
      <AmountField max={max} value={value} onChange={setValue} />
      <output aria-label='Held'>{value}</output>
    </>
  )
}

const field = () => screen.getByRole('textbox', { name: 'How many' })
const held = () => screen.getByRole('status', { name: 'Held' })
const alert = () => screen.queryByRole('alert')

describe('components/transfers/amount-field', () => {
  it('reads only plain digits as a number, and only 1 to as many as there are as an amount', () => {
    expect(typedCount('12')).toBe(12)
    expect(typedCount('007')).toBe(7)
    for (const text of ['', '1,000', '1 000', '+3', '-1', '2.5', '3a', ' 4']) {
      expect(typedCount(text)).toBeUndefined()
    }
    expect(amountOf('1', 3)).toBe(1)
    expect(amountOf('3', 3)).toBe(3)
    expect(amountOf('0', 3)).toBeUndefined()
    expect(amountOf('4', 3)).toBeUndefined()
  })

  it('is a numeric text field named How many, of as many as there are, under its legend', () => {
    render(<Held max={3} />)
    expect(screen.getByRole('group', { name: 'How many' })).toBeVisible()
    expect(field()).toHaveAttribute('type', 'text')
    expect(field()).toHaveAttribute('inputmode', 'numeric')
    expect(field()).toHaveAttribute('pattern', '[0-9]*')
    expect(field()).toHaveValue('1')
    expect(screen.getByText('of 3')).toBeVisible()
    expect(alert()).toBeNull()
  })

  it('steps by one, no further than its ends, which say so', async () => {
    const user = userEvent.setup()
    render(<Held max={3} />)
    const fewer = screen.getByRole('button', { name: 'One fewer' })
    const more = screen.getByRole('button', { name: 'One more' })
    expect(fewer).toHaveAttribute('aria-disabled', 'true')
    expect(more).toHaveAttribute('aria-disabled', 'false')

    await user.click(fewer)
    expect(held()).toHaveTextContent('1')
    await user.click(more)
    await user.click(more)
    expect(held()).toHaveTextContent('3')
    expect(more).toHaveAttribute('aria-disabled', 'true')
    expect(fewer).toHaveAttribute('aria-disabled', 'false')
    await user.click(more)
    expect(held()).toHaveTextContent('3')
    await user.click(fewer)
    expect(held()).toHaveTextContent('2')
  })

  it('steps into range from a number out of it, or from nothing typed', async () => {
    const user = userEvent.setup()
    render(<Held max={3} start='9' />)
    await user.click(screen.getByRole('button', { name: 'One fewer' }))
    expect(held()).toHaveTextContent('3')
    await user.clear(field())
    await user.click(screen.getByRole('button', { name: 'One more' }))
    expect(held()).toHaveTextContent('1')
  })

  it('refuses separators, and says what it takes', async () => {
    const user = userEvent.setup()
    render(<Held max={2000} />)
    await user.clear(field())
    await user.type(field(), '1,000')
    expect(alert()).toHaveTextContent('Enter a whole number from 1 to 2,000.')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription(
      'Enter a whole number from 1 to 2,000.',
    )
  })

  it('says 0, or one more than there are, is out of range', async () => {
    const user = userEvent.setup()
    render(<Held max={3} />)
    await user.clear(field())
    await user.type(field(), '0')
    expect(alert()).toHaveTextContent('Enter a whole number from 1 to 3.')
    await user.clear(field())
    await user.type(field(), '4')
    expect(alert()).toHaveTextContent('Enter a whole number from 1 to 3.')
    await user.clear(field())
    await user.type(field(), '3')
    expect(alert()).toBeNull()
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('takes them all at a tap', async () => {
    const user = userEvent.setup()
    render(<Held max={12} />)
    await user.click(screen.getByRole('button', { name: 'All 12' }))
    expect(field()).toHaveValue('12')
  })
})
