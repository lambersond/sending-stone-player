import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { computeAccessibleName } from 'dom-accessibility-api'
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
    // Named by what it shows, starting with its words (PR #44's review).
    const row = within(section).getByRole('button', {
      name: 'Scouts Party sheet',
    })
    expect(row).not.toHaveAttribute('aria-label')
    expect(row).toHaveTextContent(/^Scouts Party sheet$/)

    await user.click(row)
    expect(onOpen).toHaveBeenCalledWith('scouts')
  })

  it('lists several under Parties, the primary party first, with its portrait', async () => {
    const onOpen = jest.fn()
    const user = userEvent.setup()
    render(<PartySheetList groups={[scouts, company]} onOpen={onOpen} />)

    const section = screen.getByRole('region', { name: 'Parties' })
    const rows = within(section).getAllByRole('button')
    expect(rows.map(row => computeAccessibleName(row))).toEqual([
      'The Company Primary party',
      'Scouts Party sheet',
    ])
    for (const row of rows) expect(row).not.toHaveAttribute('aria-label')
    expect(rows[0]).toHaveTextContent(/^The Company Primary party$/)
    expect(rows[0]?.querySelector('img')).toHaveAttribute(
      'src',
      company.portrait,
    )
    expect(rows[1]?.querySelector('img')).toBeNull()

    await user.click(rows[1] as HTMLElement)
    expect(onOpen).toHaveBeenCalledWith('scouts')
  })
})
