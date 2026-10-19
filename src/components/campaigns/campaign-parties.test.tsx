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

    expect(
      screen.getByRole('heading', { level: 4, name: 'Party sheets' }),
    ).toBeInTheDocument()
    const [company, hidden] = screen.getAllByRole('listitem')
    expect(
      within(company).getByRole('link', {
        name: "Open The Company's party sheet",
      }),
    ).toHaveAttribute('href', '/campaigns/c1/party/company')
    expect(company).toHaveTextContent('Primary party')
    expect(company).not.toHaveTextContent('Not shared')
    expect(
      within(hidden).getByRole('link', {
        name: "Open The Hidden Hand's party sheet",
      }),
    ).toHaveAttribute('href', '/campaigns/c1/party/hidden')
    expect(hidden).toHaveTextContent('Not shared with any player in Foundry')
    expect(hidden).not.toHaveTextContent('Primary party')
  })

  it('is nothing without any', () => {
    const { container } = render(
      <CampaignParties campaign={{ id: 'c1', groups: [] }} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
