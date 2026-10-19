import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import NotFound from './not-found'
import CharacterPartyPage, { generateMetadata } from './page'
import { getCharacter } from '@/db/characters'
import { getGroupView } from '@/db/party'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/party', () => ({
  ...jest.requireActual('@/db/party'),
  getGroupView: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/party-sheet', () => ({
  PartyPage: ({ api, role, initialView, back, ownSheetHref }: any) => (
    <p>
      {initialView.group.name} through {api} as {role}, back to {back.href} as{' '}
      {back.label}, own sheet {ownSheetHref}
    </p>
  ),
}))

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}
const view = {
  version: 7,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: { id: 'company', name: 'The Company', primary: true },
}

const props = (id: string, group: string) => ({
  params: Promise.resolve({ id, group }),
  searchParams: Promise.resolve({}),
})

describe('app/characters/[id]/party/[group]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    jest.mocked(getGroupView).mockResolvedValue(view)
  })

  it("shows the player their party's sheet as its own page, as their character's player", async () => {
    render(await CharacterPartyPage(props('char-1', 'company')))

    expect(requireUser).toHaveBeenCalledWith('/characters/char-1/party/company')
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getGroupView).toHaveBeenCalledWith(
      {
        role: 'player',
        campaignId: 'c1',
        actorId: 'thorin',
        characterId: 'char-1',
        name: 'Thorin Oakenshield',
      },
      'company',
    )
    expect(
      screen.getByText(
        'The Company through /api/characters/char-1/party/company as player, back to /characters/char-1 as Back to Thorin Oakenshield, own sheet /characters/char-1',
      ),
    ).toBeInTheDocument()
    await expect(generateMetadata(props('char-1', 'company'))).resolves.toEqual(
      {
        title: 'The Company',
      },
    )
  })

  it.each([
    [
      "another player's character",
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getCharacter).mockResolvedValue(undefined),
    ],
    [
      'a party sheet the player may not see',
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getGroupView).mockResolvedValue(undefined),
    ],
  ])(
    'says nothing more of %s than that it isn’t open here',
    async (_, arrange) => {
      arrange()

      await expect(
        CharacterPartyPage(props('char-1', 'company')),
      ).rejects.toThrow('NEXT_NOT_FOUND')
      expect(notFound).toHaveBeenCalled()
      await expect(
        generateMetadata(props('char-1', 'company')),
      ).resolves.toEqual({
        title: 'Party',
      })
    },
  )

  it('says so, leading back to the characters', () => {
    render(<NotFound />)

    expect(
      screen.getByRole('heading', {
        name: "This party sheet isn't open here.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'All characters' }),
    ).toHaveAttribute('href', '/characters')
  })
})
