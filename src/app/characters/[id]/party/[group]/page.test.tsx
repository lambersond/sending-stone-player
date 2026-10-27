import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import NotFound from './not-found'
import CharacterPartyPage, { generateMetadata } from './page'
import { getCharacter } from '@/db/characters'
import { getGroupView } from '@/db/party'
import { shapedRefusal } from '@/db/wild-shape'
import { requireUser } from '@/lib/session'
import type { PartyPage as RealPartyPage } from '@/components/party-sheet'
import type { ComponentProps } from 'react'

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
// Whether the character is transformed (module 0.40.0): not, unless a test says so.
jest.mock('@/db/wild-shape', () => ({ shapedRefusal: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
/** What the page gave the party's page, as it crosses from the server to the browser. */
let given: ComponentProps<typeof RealPartyPage> | undefined
jest.mock('@/components/party-sheet', () => ({
  PartyPage: (props: any) => {
    given = props
    const { api, role, initialView, back, ownSheetHref } = props
    return (
      <p>
        {initialView.group.name} through {api} as {role}, back to {back.href} as{' '}
        {back.label}, own sheet {ownSheetHref}
      </p>
    )
  },
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
    given = undefined
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    jest.mocked(getGroupView).mockResolvedValue(view)
    // Not transformed: no refusal.
    jest.mocked(shapedRefusal).mockReset()
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

  it("takes into the player's character, through its own way in, from module 0.31.0", async () => {
    render(await CharacterPartyPage(props('char-1', 'company')))

    expect(given?.takeInto).toEqual({
      kind: 'own',
      actorId: 'thorin',
      name: 'Thorin Oakenshield',
      api: '/api/characters/char-1',
    })
  })

  it("takes into no one for a character not in the campaign's roster", async () => {
    jest
      .mocked(getCharacter)
      // eslint-disable-next-line unicorn/no-null -- a character with no actor has null
      .mockResolvedValue({ ...character, actorId: null })

    render(await CharacterPartyPage(props('char-1', 'company')))

    expect(given).toBeDefined()
    expect(given?.takeInto).toBeUndefined()
    expect(shapedRefusal).not.toHaveBeenCalled()
  })

  it('takes into no one while the character is transformed, as by Wild Shape, from module 0.40.0 (round 0.40.0 §5.9)', async () => {
    jest
      .mocked(shapedRefusal)
      .mockResolvedValue({ status: 422, reason: 'shaped' })

    render(await CharacterPartyPage(props('char-1', 'company')))

    // Asked as the Take itself would be: from the party, into the character, at its seat.
    expect(shapedRefusal).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'player',
        userId: 'user-1',
        campaignId: 'c1',
        actorId: 'thorin',
        characterId: 'char-1',
      }),
      expect.objectContaining({
        kind: 'transfer',
        transfer: { from: 'company', to: 'thorin' },
      }),
    )
    expect(given).toBeDefined()
    expect(given?.takeInto).toBeUndefined()
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
