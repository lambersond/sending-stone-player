import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignCard } from './campaign-card'
import type { OwnedCampaign } from '@/types/campaign'

const campaign = (fields: Partial<OwnedCampaign> = {}): OwnedCampaign => ({
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  worldTitle: 'Return to Erebor',
  inviteCode: 'code-1',
  connected: true,
  rosterReceived: true,
  live: true,
  characters: [],
  ...fields,
})

const renderCard = (fields: Partial<OwnedCampaign> = {}) => {
  const actions = {
    changeSecret: jest.fn().mockResolvedValue({ saved: true }),
    resetInvite: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  }
  render(
    <CampaignCard
      campaign={campaign(fields)}
      inviteUrl='https://stone.example/join/code-1'
      {...actions}
    />,
  )
  return actions
}

describe('components/campaigns/campaign-card', () => {
  it.each([
    ['live', {}, 'Live'],
    [
      'offline',
      { live: false, lastSeenAt: '2026-10-04T19:00:00.000Z' },
      'Offline',
    ],
    [
      'never connected',
      { live: false, connected: false },
      'Waiting for Foundry',
    ],
  ])('shows a campaign that is %s', (_, fields, status) => {
    renderCard(fields)

    expect(screen.getByText(status)).toBeInTheDocument()
  })

  it('says when the last word from Foundry was', () => {
    renderCard({ live: false, lastSeenAt: '2026-10-04T19:00:00.000Z' })

    expect(screen.getByText(/Last heard/)).toBeInTheDocument()
  })

  it("explains that the campaign's characters arrive from Foundry", () => {
    renderCard({ connected: false, rosterReceived: false, live: false })

    expect(
      screen.getByText(/Reloading the game in Foundry sends them at once/),
    ).toBeInTheDocument()
  })

  it('says when Foundry sent the campaign no characters', () => {
    renderCard()

    expect(
      screen.getByText(/Tick its characters in Manage Campaigns in Foundry/),
    ).toBeInTheDocument()
  })

  it('asks before resetting the invite link or removing the campaign', async () => {
    const user = userEvent.setup()
    const { resetInvite, remove } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    const reset = screen.getByRole('group', { name: 'Reset link' })
    expect(reset).toHaveTextContent(
      'Stop this link working and make a new one?',
    )
    await user.click(within(reset).getByRole('button', { name: 'Cancel' }))
    expect(resetInvite).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    await user.click(
      within(screen.getByRole('group', { name: 'Reset link' })).getByRole(
        'button',
        { name: 'Reset link' },
      ),
    )
    expect(resetInvite).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Remove campaign' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('changes the secret', async () => {
    const user = userEvent.setup()
    const { changeSecret } = renderCard()

    await user.click(screen.getByText('Change secret'))
    await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'Save secret' }))

    expect(changeSecret).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Saved. Enter the same secret in the module's Configure Connection.",
    )
  })

  it('shows why a secret was refused', async () => {
    const user = userEvent.setup()
    const { changeSecret } = renderCard()
    changeSecret.mockResolvedValue({
      error: 'Use a secret of at least 12 characters.',
    })

    await user.click(screen.getByText('Change secret'))
    await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'Save secret' }))

    const input = await screen.findByLabelText('New secret')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Use a secret of at least 12 characters.',
    )
  })
})
