/* eslint-disable unicorn/no-null -- the Gamemaster's seat has no character, null */
import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import NotFound from './not-found'
import GmCharacterPage, { generateMetadata } from './page'
import { getGmSeat } from '@/db/seats'
import { getTableView } from '@/db/table'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/db/seats', () => ({ getGmSeat: jest.fn() }))
jest.mock('@/db/table', () => ({ getTableView: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/game-table', () => ({
  GameTable: ({ character, seat, initialView, ...rest }: any) => (
    <p>
      table for {character.name} as {character.id}, through {seat.api} as{' '}
      {seat.role} at version {initialView.version}
      {Object.keys(rest).length > 0 && `, with ${Object.keys(rest).join(',')}`}
    </p>
  ),
}))

/** The campaign's Gamemaster at Balin's sheet. */
const seat = {
  name: 'Balin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'Ashlands',
  campaignId: 'camp1',
  actorId: 'balin',
  role: 'gm' as const,
  userId: 'gm-1',
  characterId: null,
}

const props = (id: string, actor: string) => ({
  params: Promise.resolve({ id, actor }),
  searchParams: Promise.resolve({}),
})

describe('app/campaigns/[id]/characters/[actor]/page (#156)', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(getTableView).mockResolvedValue({
      version: 7,
      live: true,
      connected: true,
      messages: [],
      gm: { rolls: 'made' },
    })
  })

  it("shows the campaign's owner the character's sheet, as its player sees it, to roll from as theirs", async () => {
    jest.mocked(getGmSeat).mockResolvedValue(seat)
    render(await GmCharacterPage(props('camp1', 'balin')))

    expect(requireUser).toHaveBeenCalledWith(
      '/campaigns/camp1/characters/balin',
    )
    expect(getGmSeat).toHaveBeenCalledWith('gm-1', 'camp1', 'balin')
    expect(getTableView).toHaveBeenCalledWith(seat)
    // No way to choose, delete or mark the chat read: those are the player's.
    expect(
      screen.getByText(
        'table for Balin as gm:camp1:balin, through /api/campaigns/camp1/characters/balin as gm at version 7',
      ),
    ).toBeInTheDocument()
  })

  it('sends someone signed out to sign in, and back here', async () => {
    jest.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))

    await expect(GmCharacterPage(props('camp1', 'balin'))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(requireUser).toHaveBeenCalledWith(
      '/campaigns/camp1/characters/balin',
    )
    expect(getGmSeat).not.toHaveBeenCalled()
  })

  it("is not found, saying nothing more, for another user's campaign or a character not in its roster", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getGmSeat).mockResolvedValue(undefined)

    await expect(GmCharacterPage(props('camp1', 'nobody'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()
    expect(getTableView).not.toHaveBeenCalled()
    await expect(generateMetadata(props('camp1', 'nobody'))).resolves.toEqual({
      title: 'Character',
    })
  })

  it("titles the page with the character's name", async () => {
    jest.mocked(getGmSeat).mockResolvedValue(seat)
    await expect(generateMetadata(props('camp1', 'balin'))).resolves.toEqual({
      title: 'Balin',
    })
  })

  it('says the sheet is not open here, whatever the cause, with a way back to the campaigns', () => {
    render(<NotFound />)

    expect(
      screen.getByRole('heading', {
        name: "This sheet isn't open here. Its character may have left the campaign.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Your campaigns' }),
    ).toHaveAttribute('href', '/campaigns')
  })
})
