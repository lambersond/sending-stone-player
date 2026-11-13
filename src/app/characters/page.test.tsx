import { render, screen, within } from '@testing-library/react'
import CharactersPage from './page'
import { listCharacters } from '@/db/characters'
import { requireUser } from '@/lib/session'
import { firstSent, streamed } from '@/utils/test-utils'

jest.mock('@/db/characters', () => ({ listCharacters: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('./actions', () => ({
  openInvite: jest.fn(),
  removeCharacter: jest.fn(),
}))

describe('app/characters/page', () => {
  beforeEach(() => {
    jest
      .mocked(requireUser)
      .mockResolvedValue({ id: 'user-1', name: 'Alice' } as any)
  })

  it('draws who the player is, where to join a campaign and how to run one at once, only their characters waiting to be read', async () => {
    render(await firstSent(await CharactersPage()))

    expect(listCharacters).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument()
    const choose = screen.getByRole('region', { name: 'Choose a character' })
    expect(within(choose).getByRole('status')).toHaveTextContent('Loading…')
    const join = screen.getByRole('region', { name: 'Join a campaign' })
    expect(within(join).getByLabelText('Invite link')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Set up your campaign' }),
    ).toHaveAttribute('href', '/campaigns')
  })

  it("lists the user's characters to choose from", async () => {
    jest.mocked(listCharacters).mockResolvedValue([
      {
        id: 'char-1',
        name: 'Thorin',
        gameUrl: 'https://my-game.forge-vtt.com',
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: 'actor-thorin',
      },
    ])
    render(await streamed(await CharactersPage()))

    expect(listCharacters).toHaveBeenCalledWith('user-1')
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument()
    const choose = screen.getByRole('region', { name: 'Choose a character' })
    expect(
      within(choose).getByRole('link', { name: /Thorin/ }),
    ).toHaveAttribute('href', '/characters/char-1')
  })

  it('suggests joining a campaign when there are none', async () => {
    jest.mocked(listCharacters).mockResolvedValue([])
    render(await streamed(await CharactersPage()))

    expect(
      screen.getByText(
        'You have no characters yet. Join a campaign below to choose one.',
      ),
    ).toBeInTheDocument()
    const join = screen.getByRole('region', { name: 'Join a campaign' })
    expect(within(join).getByLabelText('Invite link')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Set up your campaign' }),
    ).toHaveAttribute('href', '/campaigns')
  })
})
