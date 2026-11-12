import { render, screen, within } from '@testing-library/react'
import { CampaignParties } from './campaign-parties'

describe('components/campaigns/campaign-parties', () => {
  it("links each of the campaign's party sheets, saying which is primary and which no player may see", () => {
    render(
      <CampaignParties
        campaign={{
          id: 'c1',
          groups: [
            { id: 'company', name: 'The Company', primary: true, shared: true },
            {
              id: 'hidden',
              name: 'The Hidden Hand',
              primary: false,
              shared: false,
            },
          ],
        }}
      />,
    )

    // Changed on purpose (round 0.39.0 §4.7): a section of the campaign's page, under its h2.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Party sheets' }),
    ).toBeInTheDocument()
    const [company, hidden] = screen.getAllByRole('listitem')
    const link = within(company).getByRole('link', {
      name: "Open The Company's party sheet",
    })
    expect(link).toHaveAttribute('href', '/campaigns/c1/party/company')
    // Its name wraps, whole (item 17): kept on one line, a long one held the column wider than
    // the card.
    expect(link).toHaveClass('wrap-anywhere')
    expect(link).not.toHaveClass('truncate')
    expect(company).toHaveTextContent('Primary party')
    expect(company).not.toHaveTextContent('Not shared')
    expect(
      within(hidden).getByRole('link', {
        name: "Open The Hidden Hand's party sheet",
      }),
    ).toHaveAttribute('href', '/campaigns/c1/party/hidden')
    expect(hidden).toHaveTextContent('Not shared with any player in Foundry')
    expect(hidden).not.toHaveTextContent('Primary party')
    // As tall as a character's row, easy to tap (round 0.39.0).
    expect(company).toHaveClass('min-h-11')
  })

  it('is nothing without any', () => {
    const { container } = render(
      <CampaignParties campaign={{ id: 'c1', groups: [] }} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
