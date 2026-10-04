import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectFoundryButton, NewCampaignButton } from './campaign-buttons'

describe('components/campaigns/campaign-buttons', () => {
  it('sets up a new campaign in a modal, closing when done', async () => {
    const action = jest.fn().mockResolvedValue({
      saved: { title: 'Ashlands', secret: 'ashlands-secret-1' },
    })
    const user = userEvent.setup()
    render(
      <NewCampaignButton action={action} suggestedSecret='ashlands-secret-1' />,
    )

    await user.click(screen.getByRole('button', { name: 'New campaign' }))
    const dialog = screen.getByRole('dialog', { name: 'New campaign' })
    await user.type(within(dialog).getByLabelText('Campaign title'), 'Ashlands')
    await user.type(
      within(dialog).getByLabelText('Forge game address'),
      'my-game.forge-vtt.com',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Set up campaign' }),
    )
    await within(dialog).findByText('ashlands-secret-1')
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(dialog).not.toHaveAttribute('open')

    // Opened again, it starts afresh.
    await user.click(screen.getByRole('button', { name: 'New campaign' }))
    expect(within(dialog).getByLabelText('Campaign title')).toHaveValue('')
  })

  it('explains how to connect Foundry', async () => {
    const user = userEvent.setup()
    render(<ConnectFoundryButton destination='https://stone.example' />)

    await user.click(screen.getByRole('button', { name: 'Connect Foundry' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Connect your Foundry game',
    })
    expect(
      within(dialog).getByText('https://stone.example'),
    ).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Manage Campaigns')
  })
})
