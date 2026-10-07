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
  rolls: { enabled: false, reaching: false },
  characters: [],
  ...fields,
})

const renderCard = (fields: Partial<OwnedCampaign> = {}) => {
  const actions = {
    changeSecret: jest.fn().mockResolvedValue({ saved: true }),
    resetInvite: jest.fn(async () => {}),
    removePlayer: jest.fn<Promise<void>, [string]>(async () => {}),
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

  it('asks before resetting the invite link', async () => {
    const user = userEvent.setup()
    const { resetInvite } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    let dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    expect(dialog).toHaveTextContent(
      'The current link to The Lonely Mountain stops working',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(resetInvite).not.toHaveBeenCalled()
    expect(dialog).not.toHaveAttribute('open')

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    await user.click(within(dialog).getByRole('button', { name: 'Reset link' }))
    expect(resetInvite).toHaveBeenCalledTimes(1)
  })

  it('asks before deleting the campaign', async () => {
    const user = userEvent.setup()
    const { remove } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Delete campaign' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Delete The Lonely Mountain?',
    })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete campaign' }),
    )

    expect(remove).toHaveBeenCalledTimes(1)
  })

  it("removes a player's character, after asking", async () => {
    const user = userEvent.setup()
    const { removePlayer } = renderCard({
      characters: [
        {
          id: 'actor-thorin',
          name: 'Thorin',
          player: 'Alice',
          characterId: 'char-1',
        },
        { id: 'actor-vex', name: 'Vex' },
      ],
    })

    expect(
      screen.queryByRole('button', { name: /Remove .* as Vex/ }),
    ).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Remove Alice as Thorin' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove Alice as Thorin?',
    })
    expect(dialog).toHaveTextContent(
      'Alice stops following The Lonely Mountain as Thorin',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(removePlayer).toHaveBeenCalledWith('char-1')
  })

  it('changes the secret', async () => {
    const user = userEvent.setup()
    const { changeSecret } = renderCard()

    await user.click(screen.getByText('Change secret'))
    await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'Save secret' }))

    expect(changeSecret).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved. Enter the same secret beside this campaign in Manage Campaigns in Foundry.',
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

  it.each([
    [
      'made in the game',
      { enabled: true, reaching: true },
      'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice.',
    ],
    [
      'turned on, while the game is closed',
      { enabled: true, reaching: false },
      'Turned on in Foundry. Players’ rolls reach your game while it’s open; for now they stay here.',
    ],
    [
      'not turned on',
      { enabled: false, reaching: false },
      'They stay here. To have them made in your game with the same dice, tick Let players roll from Sending Stone for this campaign in Manage Campaigns in Foundry.',
    ],
  ])("says whether players' rolls are %s", (_, rolls, text) => {
    renderCard({ rolls })

    expect(screen.getByText("Players' rolls").nextSibling).toHaveTextContent(
      text,
    )
  })
})
