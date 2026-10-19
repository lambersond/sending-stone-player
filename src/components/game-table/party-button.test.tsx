import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartyButton } from './party-button'
import type { TableGroup } from '@/types/party'

const company: TableGroup = {
  id: 'company',
  name: 'The Company',
  primary: true,
}
const scouts: TableGroup = { id: 'scouts', name: 'Scouts', primary: false }

describe('components/game-table/party-button', () => {
  it('is nothing without a group', () => {
    const { container } = render(<PartyButton groups={[]} onOpen={jest.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("opens a single group's sheet at once", async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartyButton groups={[scouts]} onOpen={onOpen} />)

    const button = screen.getByRole('button', { name: 'Party: Scouts' })
    expect(button).toHaveAttribute('title', 'Party: Scouts')
    expect(button).not.toHaveAttribute('aria-haspopup')
    expect(button).toHaveClass(
      'rounded-lg',
      'p-2',
      'text-text-secondary',
      'hover:bg-primary/10',
      'hover:text-text-primary',
    )
    expect(button.querySelector('svg')).toHaveClass('size-4')

    await user.click(button)
    expect(onOpen).toHaveBeenCalledWith('scouts')
  })

  it('offers several in a menu, the primary party first', async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartyButton groups={[scouts, company]} onOpen={onOpen} />)

    const button = screen.getByRole('button', { name: 'Parties' })
    expect(button).toHaveAttribute('title', 'Parties')
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['The Company', 'Scouts'])

    await user.click(within(menu).getByRole('menuitem', { name: 'Scouts' }))
    expect(onOpen).toHaveBeenCalledWith('scouts')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes its menu on Escape, opening nothing', async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartyButton groups={[company, scouts]} onOpen={onOpen} />)

    await user.click(screen.getByRole('button', { name: 'Parties' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
