import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import CharacterPage, { generateMetadata } from './page'
import { getCharacter } from '@/db/characters'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))

const thorin = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
}

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
})

describe('app/characters/[id]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
  })

  it('shows the chosen character and links to its game', async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    render(await CharacterPage(props('char-1')))

    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(screen.getByRole('heading', { name: 'Thorin' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /my-game\.forge-vtt\.com/ }),
    ).toHaveAttribute('href', 'https://my-game.forge-vtt.com')
    expect(
      screen.getByRole('link', { name: 'All characters' }),
    ).toHaveAttribute('href', '/characters')
  })

  it('is not found when the user has no such character', async () => {
    // eslint-disable-next-line unicorn/no-null -- what Prisma returns
    jest.mocked(getCharacter).mockResolvedValue(null)

    await expect(CharacterPage(props('someone-elses'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
  })

  it("titles the page with the character's name", async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)

    await expect(generateMetadata(props('char-1'))).resolves.toEqual({
      title: 'Thorin',
    })
  })

  it('has a plain title when the character is not found', async () => {
    // eslint-disable-next-line unicorn/no-null -- what Prisma returns
    jest.mocked(getCharacter).mockResolvedValue(null)

    await expect(generateMetadata(props('missing'))).resolves.toEqual({
      title: 'Character',
    })
  })
})
