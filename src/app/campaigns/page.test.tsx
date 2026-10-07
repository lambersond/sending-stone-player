import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampaignsPage from './page'
import { listOwnedCampaigns } from '@/db/campaigns'
import { appOrigin } from '@/lib/app-origin'
import { requireUser } from '@/lib/session'

jest.mock('./actions', () => ({
  changeSecretAction: jest.fn(),
  removeCampaignAction: jest.fn(),
  removePlayerAction: jest.fn(),
  resetInviteAction: jest.fn(),
  setUpCampaignAction: jest.fn(),
}))
jest.mock('@/db/campaigns', () => ({ listOwnedCampaigns: jest.fn() }))
jest.mock('@/lib/app-origin', () => ({ appOrigin: jest.fn() }))
jest.mock('@/lib/campaign-secret', () => ({
  generateSecret: () => 'suggested-secret-0001',
}))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))

const campaign = {
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  worldTitle: 'Return to Erebor',
  inviteCode: 'AbCdEfGh_-123456',
  connected: true,
  rosterReceived: true,
  live: true,
  rolls: { enabled: false, reaching: false, attacks: false },
  characters: [
    { id: 'actor-thorin', name: 'Thorin Oakenshield', player: 'Alice' },
    { id: 'actor-vex', name: 'Vex' },
  ],
}

describe('app/campaigns/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(appOrigin).mockResolvedValue('https://stone.example')
  })

  it("lists the Gamemaster's campaigns with their invite links", async () => {
    jest.mocked(listOwnedCampaigns).mockResolvedValue([campaign])
    render(await CampaignsPage())

    expect(requireUser).toHaveBeenCalledWith('/campaigns')
    expect(listOwnedCampaigns).toHaveBeenCalledWith('gm-1')
    const card = screen.getByRole('article', { name: 'The Lonely Mountain' })
    expect(
      within(card).getByText('https://stone.example/join/AbCdEfGh_-123456'),
    ).toBeInTheDocument()
    expect(within(card).getByText('Live')).toBeInTheDocument()
    expect(within(card).getByText('Alice')).toBeInTheDocument()
    expect(within(card).getByText('Not chosen yet')).toBeInTheDocument()
  })

  it('helps a Gamemaster set up their first campaign and connect Foundry', async () => {
    jest.mocked(listOwnedCampaigns).mockResolvedValue([])
    const user = userEvent.setup()
    render(await CampaignsPage())

    expect(
      screen.getByText(/You haven't set up a campaign yet/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New campaign' }))
    const setUp = screen.getByRole('dialog', { name: 'New campaign' })
    expect(within(setUp).getByLabelText('Secret')).toHaveValue(
      'suggested-secret-0001',
    )
    await user.click(within(setUp).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Connect Foundry' }))
    const connect = screen.getByRole('dialog', {
      name: 'Connect your Foundry game',
    })
    expect(
      within(connect).getByText('https://stone.example'),
    ).toBeInTheDocument()
  })
})
