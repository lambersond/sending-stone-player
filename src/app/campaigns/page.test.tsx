import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { revokeCookbookLinkAction } from './actions'
import CampaignsPage from './page'
import { listOwnedCampaigns } from '@/db/campaigns'
import { appOrigin } from '@/lib/app-origin'
import { requireUser } from '@/lib/session'

jest.mock('./actions', () => ({
  changeSecretAction: jest.fn(),
  removeCampaignAction: jest.fn(),
  removePlayerAction: jest.fn(),
  resetInviteAction: jest.fn(),
  revokeCookbookLinkAction: jest.fn(),
  setUpCampaignAction: jest.fn(),
}))
jest.mock('@/db/campaigns', () => ({ listOwnedCampaigns: jest.fn() }))
jest.mock('@/lib/app-origin', () => ({ appOrigin: jest.fn() }))
jest.mock('@/lib/campaign-secret', () => ({
  generateSecret: () => 'suggested-secret-0001',
}))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
// The index reads the campaign chosen from the address, as the page was asked for it.
let address = ''
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(address),
}))

const campaign = {
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  worldTitle: 'Return to Erebor',
  inviteCode: 'AbCdEfGh_-123456',
  connected: true,
  rosterReceived: true,
  live: true,
  rolls: {
    enabled: false,
    reaching: false,
    attacks: false,
    spells: false,
    prompts: false,
  },
  transfers: { enabled: false, reaching: false },
  characters: [
    { id: 'actor-thorin', name: 'Thorin Oakenshield', player: 'Alice' },
    { id: 'actor-vex', name: 'Vex' },
  ],
  groups: [],
}

/**
 * The page's props, its address's query as given. Changed on purpose (round 0.39.0 §4.7): the page
 * reads the campaign chosen from its address.
 */
const props = (searchParams: Record<string, string | string[]> = {}) => {
  address = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      [value].flat().map(one => [key, one]),
    ),
  ).toString()
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  }
}

describe('app/campaigns/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(appOrigin).mockResolvedValue('https://stone.example')
  })

  it("lists the Gamemaster's campaigns with their invite links", async () => {
    jest.mocked(listOwnedCampaigns).mockResolvedValue([campaign])
    render(await CampaignsPage(props()))

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

  it('revokes a player’s cookbook link from the campaign’s card, from module 0.38.0', async () => {
    jest.mocked(listOwnedCampaigns).mockResolvedValue([
      {
        ...campaign,
        characters: [
          {
            id: 'actor-thorin',
            name: 'Thorin Oakenshield',
            player: 'Alice',
            characterId: 'char-1',
            cookbookLinked: true,
          },
        ],
      },
    ])
    const user = userEvent.setup()
    render(await CampaignsPage(props()))

    const card = screen.getByRole('article', { name: 'The Lonely Mountain' })
    expect(within(card).getByText('Cookbook linked')).toBeInTheDocument()
    await user.click(
      within(card).getByRole('button', {
        name: 'Revoke Alice’s cookbook link for Thorin Oakenshield',
      }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', {
          name: 'Revoke Alice’s cookbook link for Thorin Oakenshield?',
        }),
      ).getByRole('button', { name: 'Revoke link' }),
    )
    expect(revokeCookbookLinkAction).toHaveBeenCalledWith('c1', 'char-1')
  })

  it('helps a Gamemaster set up their first campaign and connect Foundry', async () => {
    jest.mocked(listOwnedCampaigns).mockResolvedValue([])
    const user = userEvent.setup()
    render(await CampaignsPage(props()))

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

  describe('the campaign the address chooses, v0.39', () => {
    it.each([
      ['a campaign id', { campaign: 'c1' }, '/campaigns?campaign=c1'],
      [
        "a campaign id of Prisma's shape",
        { campaign: 'cmh9q2x7k0003ss_c-1' },
        '/campaigns?campaign=cmh9q2x7k0003ss_c-1',
      ],
      ['no campaign', {}, '/campaigns'],
      ['an empty one', { campaign: '' }, '/campaigns'],
      ['two of them', { campaign: ['c1', 'c2'] }, '/campaigns'],
      ['one with a space', { campaign: 'c1 c2' }, '/campaigns'],
      ['one leaving the site', { campaign: '//evil.example' }, '/campaigns'],
      ['one with a query of its own', { campaign: 'c1&next=x' }, '/campaigns'],
      ['one too long', { campaign: 'c'.repeat(65) }, '/campaigns'],
    ])('returns a Gamemaster signing in to %s', async (_name, query, next) => {
      jest.mocked(listOwnedCampaigns).mockResolvedValue([campaign])
      render(await CampaignsPage(props(query)))

      expect(requireUser).toHaveBeenCalledWith(next)
    })

    it('asks the Gamemaster to sign in before reading any campaign', async () => {
      jest.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))

      await expect(CampaignsPage(props({ campaign: 'c1' }))).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      expect(listOwnedCampaigns).not.toHaveBeenCalled()
    })

    const three = [
      { ...campaign, id: 'c1', title: 'Curse of Strahd' },
      {
        ...campaign,
        id: 'c2',
        title: 'Ghosts of Saltmarsh',
        connected: false,
        live: false,
      },
      {
        ...campaign,
        id: 'c3',
        title: 'Tomb of Annihilation',
        live: false,
        refusal: {
          reason: 'wrongSecret' as const,
          status: 401,
          at: '2026-10-28T11:00:00.000Z',
          current: true,
        },
      },
    ]

    // Changed on purpose (round 0.39.0 §4.7): the index lists every campaign as a row and shows
    // one campaign's page, so the order is read from the rows.
    it.each([
      ['chosen', { campaign: 'c1' }],
      ['unknown, or gone', { campaign: 'gone' }],
    ])(
      'lists every campaign, one %s or none, those that need the Gamemaster first',
      async (_name, query) => {
        jest.mocked(listOwnedCampaigns).mockResolvedValue(three)
        render(await CampaignsPage(props(query)))

        expect(
          within(screen.getByRole('list', { name: 'Needs you' }))
            .getAllByRole('button')
            .map(row => row.textContent),
        ).toEqual([
          expect.stringMatching(/^Tomb of Annihilation/),
          expect.stringMatching(/^Ghosts of Saltmarsh/),
        ])
        expect(
          within(screen.getByRole('list', { name: 'Campaigns' }))
            .getAllByRole('button')
            .map(row => row.textContent),
        ).toEqual([expect.stringMatching(/^Curse of Strahd/)])
      },
    )

    it.each([
      ['the campaign it chooses', { campaign: 'c1' }, 'Curse of Strahd'],
      [
        'the first in order, for one unknown',
        { campaign: 'gone' },
        'Tomb of Annihilation',
      ],
      ['the first in order, for none', {}, 'Tomb of Annihilation'],
      [
        'the first in order, for two',
        { campaign: ['c1', 'c2'] },
        'Tomb of Annihilation',
      ],
      [
        'the first in order, for one of another shape',
        { campaign: 'c1 c2' },
        'Tomb of Annihilation',
      ],
    ])('draws one campaign’s page: %s', async (_name, query, title) => {
      jest.mocked(listOwnedCampaigns).mockResolvedValue(three)
      render(await CampaignsPage(props(query)))

      expect(screen.getAllByRole('article')).toHaveLength(1)
      expect(screen.getByRole('article', { name: title })).toBeInTheDocument()
    })

    it('draws the page in a box as wide as the design’s, its head inside the index', async () => {
      jest.mocked(listOwnedCampaigns).mockResolvedValue(three)
      const { container } = render(await CampaignsPage(props()))

      expect(container.firstElementChild).toHaveClass(
        'mx-auto',
        'w-full',
        'max-w-[70rem]',
        'px-4',
        'pt-6',
        'pb-8',
        'md:px-8',
        'md:pt-8',
        'md:pb-10',
      )
      const index = container.querySelector('[class~="@container/index"]')
      expect(index).toContainElement(
        screen.getByRole('heading', { level: 1, name: 'Your campaigns' }),
      )
      expect(index).toContainElement(
        screen.getByRole('button', { name: 'New campaign' }),
      )
    })
  })
})
