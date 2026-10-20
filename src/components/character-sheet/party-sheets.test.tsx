import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartySheetList } from './party-sheets'
import type { TableGroup } from '@/types/party'

const company: TableGroup = {
  id: 'company',
  name: 'The Company',
  portrait: 'https://my-game.forge-vtt.com/company.webp',
  primary: true,
}
const scouts: TableGroup = { id: 'scouts', name: 'Scouts', primary: false }

describe('components/character-sheet/party-sheets', () => {
  it('is nothing without a group', () => {
    const { container } = render(
      <PartySheetList groups={[]} onOpen={jest.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("opens a single group's sheet from its row, under Party", async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartySheetList groups={[scouts]} onOpen={onOpen} />)

    const section = screen.getByRole('region', { name: 'Party' })
    const row = within(section).getByRole('button', { name: 'Party: Scouts' })
    expect(row).toHaveTextContent('ScoutsParty sheet')

    await user.click(row)
    expect(onOpen).toHaveBeenCalledWith('scouts')
  })

  it('lists several under Parties, the primary party first, with its portrait', async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartySheetList groups={[scouts, company]} onOpen={onOpen} />)

    const section = screen.getByRole('region', { name: 'Parties' })
    const rows = within(section).getAllByRole('button')
    expect(rows.map(row => row.getAttribute('aria-label'))).toEqual([
      'Party: The Company',
      'Party: Scouts',
    ])
    expect(rows[0]).toHaveTextContent('The CompanyPrimary party')
    expect(rows[0]?.querySelector('img')).toHaveAttribute(
      'src',
      company.portrait,
    )
    expect(rows[1]?.querySelector('img')).toBeNull()

    await user.click(rows[1] as HTMLElement)
    expect(onOpen).toHaveBeenCalledWith('scouts')
  })
})
