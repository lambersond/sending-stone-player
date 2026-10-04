import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import CharacterPage, { generateMetadata } from './page'
import { getCharacter } from '@/db/characters'
import { getTableView } from '@/db/table'
import { appOrigin } from '@/lib/app-origin'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/table', () => ({ getTableView: jest.fn() }))
jest.mock('@/lib/app-origin', () => ({ appOrigin: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/game-table', () => ({
  GameTable: ({ character, initialView, listenerUrl }: any) => (
    <p>
      table for {character.name} at version {initialView.version}, listener{' '}
      {listenerUrl}
    </p>
  ),
}))

const thorin = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
}

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
})

describe('app/characters/[id]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(appOrigin).mockResolvedValue('https://stone.example')
    jest
      .mocked(getTableView)
      .mockResolvedValue({ version: 7, connected: true, messages: [] })
  })

  it("shows the chosen character's table", async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    render(await CharacterPage(props('char-1')))

    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getTableView).toHaveBeenCalledWith(thorin)
    expect(
      screen.getByText(
        'table for Thorin Oakenshield at version 7, listener https://stone.example/api/sending-stone',
      ),
    ).toBeInTheDocument()
  })

  it('is not found when the user has no such character', async () => {
    // eslint-disable-next-line unicorn/no-null -- what Prisma returns
    jest.mocked(getCharacter).mockResolvedValue(null)

    await expect(CharacterPage(props('someone-elses'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
    expect(getTableView).not.toHaveBeenCalled()
  })

  it("titles the page with the character's name", async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)

    await expect(generateMetadata(props('char-1'))).resolves.toEqual({
      title: 'Thorin Oakenshield',
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
