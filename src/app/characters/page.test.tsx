import { render, screen, within } from '@testing-library/react'
import CharactersPage from './page'
import { listCharacters } from '@/db/characters'
import { requireUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ listCharacters: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('./actions', () => ({
  addCharacter: jest.fn(),
  removeCharacter: jest.fn(),
}))

describe('app/characters/page', () => {
  beforeEach(() => {
    jest
      .mocked(requireUser)
      .mockResolvedValue({ id: 'user-1', name: 'Alice' } as any)
  })

  it("lists the user's characters to choose from", async () => {
    jest.mocked(listCharacters).mockResolvedValue([
      {
        id: 'char-1',
        name: 'Thorin',
        gameUrl: 'https://my-game.forge-vtt.com',
        campaignTitle: 'The Lonely Mountain',
      },
    ])
    render(await CharactersPage())

    expect(listCharacters).toHaveBeenCalledWith('user-1')
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument()
    const choose = screen.getByRole('region', { name: 'Choose a character' })
    expect(
      within(choose).getByRole('link', { name: /Thorin/ }),
    ).toHaveAttribute('href', '/characters/char-1')
  })

  it('suggests adding a character when there are none', async () => {
    jest.mocked(listCharacters).mockResolvedValue([])
    render(await CharactersPage())

    expect(
      screen.getByText('You have no characters yet. Add one below.'),
    ).toBeInTheDocument()
    const add = screen.getByRole('region', { name: 'Add a character' })
    expect(within(add).getByLabelText('Character name')).toBeInTheDocument()
  })
})
