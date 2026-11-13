import fs from 'node:fs'
import path from 'node:path'
import {
  isValidElement,
  Suspense,
  type ReactElement,
  type ReactNode,
} from 'react'
import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import GmCharacterPage from '@/app/campaigns/[id]/characters/[actor]/page'
import CampaignsPage from '@/app/campaigns/page'
import CharacterPage from '@/app/characters/[id]/page'
import CharactersPage from '@/app/characters/page'
import { InviteSkeleton } from '@/app/join/[code]/invite-skeleton'
import JoinPage from '@/app/join/[code]/page'
import {
  findInvite,
  getCampaignChoice,
  listOwnedCampaigns,
} from '@/db/campaigns'
import { getCharacter, listCharacters } from '@/db/characters'
import { getGmSeat } from '@/db/seats'
import { getTableView } from '@/db/table'
import { CampaignIndexSkeleton } from '@/features/campaigns/components/campaign-index/campaign-index-skeleton'
import {
  CAMPAIGNS_HEADING,
  CAMPAIGNS_LEAD,
} from '@/features/campaigns/constants'
import { CharacterListSkeleton } from '@/features/characters/components/character-list/character-list-skeleton'
import { GameTableSkeleton } from '@/features/table/components/game-table/game-table-skeleton'
import { appOrigin } from '@/lib/app-origin'
import { requireUser } from '@/lib/session'
import { streamed } from '@/utils/test-utils'

// v0.48.0: a page that reads more once it knows it may be shown runs its checks first (the
// session, and the lookups that answer 404), so that a visit signed out is still redirected and a
// page not open here still answers 404 before anything is sent; and only then shows what it knows
// at once, with a shimmering skeleton of what's still to come while it reads the rest. A check only
// started before the skeleton, and awaited behind it, would be refused only once the page had begun
// to stream, with 200: so each refusal must reject the page itself. The database is mocked at its
// modules.

jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/lib/app-origin', () => ({ appOrigin: jest.fn() }))
jest.mock('@/db/characters', () => ({
  getCharacter: jest.fn(),
  listCharacters: jest.fn(),
}))
jest.mock('@/db/campaigns', () => ({
  findInvite: jest.fn(),
  getCampaignChoice: jest.fn(),
  listOwnedCampaigns: jest.fn(),
}))
jest.mock('@/db/seats', () => ({
  getGmSeat: jest.fn(),
  playerSeat: jest.requireActual('@/db/seats').playerSeat,
}))
jest.mock('@/db/table', () => ({ getTableView: jest.fn() }))
jest.mock('@/app/characters/actions', () => ({
  chooseActor: jest.fn(),
  deleteCharacterAndLeave: jest.fn(),
  joinAsCharacter: jest.fn(),
  makeCookbookCode: jest.fn(),
  markChatReadUpTo: jest.fn(),
  openInvite: jest.fn(),
  removeCharacter: jest.fn(),
  revokeCookbookCode: jest.fn(),
  setManualDice: jest.fn(),
}))
jest.mock('@/app/campaigns/actions', () => ({ setUpCampaignAction: jest.fn() }))

// Thorin yet to choose which of his campaign's characters he is, so his page reads the choice too.
const THORIN = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: null,
}
const GM_SEAT = {
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
  role: 'gm' as const,
  userId: 'user-1',
  characterId: null,
}
const params = <T,>(value: T) => ({ params: Promise.resolve(value) }) as never
const search = <T,>(value: T) =>
  ({ searchParams: Promise.resolve(value) }) as never

beforeEach(() => {
  jest
    .mocked(requireUser)
    .mockResolvedValue({ id: 'user-1', name: 'Alice' } as never)
  jest.mocked(getCharacter).mockResolvedValue(THORIN)
  jest.mocked(getGmSeat).mockResolvedValue(GM_SEAT)
  jest.mocked(listCharacters).mockResolvedValue([])
  jest.mocked(listOwnedCampaigns).mockResolvedValue([])
  jest.mocked(appOrigin).mockResolvedValue('https://player.example')
  jest.mocked(getTableView).mockResolvedValue({ version: 1 } as never)
})

/**
 * Each page that reads after its checks: how it opens, its checks and the reads after them, the
 * skeleton it shows while it reads, and the words of the page that skeleton shows, known already.
 */
const PAGES: Record<
  string,
  {
    open: () => Promise<ReactElement>
    checks: unknown[]
    reads: unknown[]
    skeleton: ReactElement
    words: string[]
  }
> = {
  'your characters': {
    open: () => CharactersPage(),
    checks: [requireUser],
    reads: [listCharacters],
    skeleton: <CharacterListSkeleton />,
    words: [],
  },
  'your campaigns': {
    open: () => CampaignsPage(search({})),
    checks: [requireUser],
    reads: [listOwnedCampaigns, appOrigin],
    skeleton: <CampaignIndexSkeleton asked={false} />,
    words: [CAMPAIGNS_HEADING, CAMPAIGNS_LEAD],
  },
  'a campaign of yours': {
    open: () => CampaignsPage(search({ campaign: 'c1' })),
    checks: [requireUser],
    reads: [listOwnedCampaigns, appOrigin],
    skeleton: <CampaignIndexSkeleton asked />,
    words: [CAMPAIGNS_HEADING, CAMPAIGNS_LEAD],
  },
  "a player's character": {
    open: () => CharacterPage(params({ id: 'char-1' })),
    checks: [requireUser, getCharacter],
    reads: [getTableView, getCampaignChoice],
    skeleton: <GameTableSkeleton name='Thorin Oakenshield' />,
    words: ['Thorin Oakenshield'],
  },
  "the Gamemaster's seat at a character": {
    open: () => GmCharacterPage(params({ id: 'c1', actor: 'thorin' })),
    checks: [requireUser, getGmSeat],
    reads: [getTableView],
    skeleton: <GameTableSkeleton name='Thorin Oakenshield' gm />,
    words: [
      'Thorin Oakenshield',
      'GM',
      "You're at Thorin Oakenshield's sheet as the Gamemaster.",
    ],
  },
  'an invite link': {
    open: () => JoinPage(params({ code: 'invite0123456789' })),
    checks: [requireUser],
    reads: [findInvite],
    skeleton: <InviteSkeleton />,
    words: [],
  },
}

/** The page's Suspense: at its root, or among the children it hands to what it draws at once. */
const suspenseIn = (node: ReactNode): ReactElement | undefined => {
  if (Array.isArray(node)) {
    return node.map(child => suspenseIn(child)).find(Boolean)
  }
  if (!isValidElement(node)) return undefined
  if (node.type === Suspense) return node
  return suspenseIn((node.props as { children?: ReactNode }).children)
}

it.each(Object.entries(PAGES))(
  'the page of %s checks who may see it first, then shows its skeleton while it reads the rest',
  async (_, { open, checks, reads, skeleton }) => {
    const shown = await open()

    for (const check of checks) expect(check).toHaveBeenCalled()
    for (const read of reads) expect(read).not.toHaveBeenCalled()
    const boundary = suspenseIn(shown)
    expect((boundary?.props as { fallback: unknown }).fallback).toEqual(
      skeleton,
    )

    await streamed(shown)
    for (const read of reads) expect(read).toHaveBeenCalled()
  },
)

it.each(Object.entries(PAGES))(
  "the skeleton of %s says it's loading, once, and nothing else to assistive technology, with nothing to focus",
  (_, { skeleton, words }) => {
    const { container } = render(skeleton)

    expect(screen.getByRole('status')).toHaveTextContent(/^Loading…$/)
    // Its blocks, and what it shows of the page, are for the eye alone.
    const shown = [...container.querySelectorAll('*')].filter(
      element =>
        element.closest('[aria-hidden="true"]') === null &&
        element.closest('[role="status"]') === null &&
        element.children.length === 0 &&
        element.textContent !== '',
    )
    expect(shown).toEqual([])
    for (const word of words) {
      expect(screen.getByText(word).closest('[aria-hidden="true"]')).not.toBe(
        null,
      )
    }
    expect(
      container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], [contenteditable]',
      ),
    ).toHaveLength(0)
  },
)

/** Nobody signed in: requireUser sends them to sign in, as Next's own redirect() does. */
const signedOut = () =>
  jest.mocked(requireUser).mockImplementation(async () => redirect('/login'))
/** What Next's redirect() and notFound() throw. */
const REDIRECTED = 'NEXT_REDIRECT'
const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'

it.each([
  ['your characters', 'signed out', signedOut, REDIRECTED],
  ['your campaigns', 'signed out', signedOut, REDIRECTED],
  ["a player's character", 'signed out', signedOut, REDIRECTED],
  [
    "a player's character",
    'to anyone but its player',
    () => jest.mocked(getCharacter).mockResolvedValue(undefined),
    NOT_FOUND,
  ],
  ["the Gamemaster's seat at a character", 'signed out', signedOut, REDIRECTED],
  [
    "the Gamemaster's seat at a character",
    'to anyone but its Gamemaster',
    () => jest.mocked(getGmSeat).mockResolvedValue(undefined),
    NOT_FOUND,
  ],
  ['an invite link', 'signed out', signedOut, REDIRECTED],
] as [string, string, () => void, string][])(
  'the page of %s, %s, is refused before it gives back anything: no skeleton, none of its reads',
  async (name, _, refuse, refusal) => {
    refuse()
    const { open, reads } = PAGES[name]

    await expect(open()).rejects.toThrow(refusal)
    for (const read of reads) expect(read).not.toHaveBeenCalled()
  },
)

// The app's folder, from this file's own path (src/__tests__/), whichever folder Jest started in.
const APP = path.resolve(path.dirname(expect.getState().testPath!), '../app')

it('has no loading file anywhere in the app, as one would stream every page below it before its checks', () => {
  // A loading.js wraps its segment's layouts and pages in a Suspense, so each page below it
  // answers 200 at once, before its checks can redirect or answer 404 (loading.md, "Status Codes").
  const loading = fs
    .readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter(file => /^loading\.[jt]sx?$/.test(path.basename(file)))

  expect(loading).toEqual([])
})

it('has no Suspense written into any layout, as one around its children would stream them the same way', () => {
  // A layout's own <Suspense> around {children} does what a loading file does: every page below it
  // starts streaming, with 200, before its checks run.
  const withSuspense = fs
    .readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter(file => /^layout\.[jt]sx?$/.test(path.basename(file)))
    .filter(file =>
      fs.readFileSync(path.join(APP, file), 'utf8').includes('Suspense'),
    )

  expect(withSuspense).toEqual([])
})
