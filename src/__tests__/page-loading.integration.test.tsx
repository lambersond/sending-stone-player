import fs from 'node:fs'
import path from 'node:path'
import { Suspense, type ReactElement } from 'react'
import { redirect } from 'next/navigation'
import GmCharacterPage from '@/app/campaigns/[id]/characters/[actor]/page'
import CampaignsPage from '@/app/campaigns/page'
import CharacterPage from '@/app/characters/[id]/page'
import CharactersPage from '@/app/characters/page'
import JoinPage from '@/app/join/[code]/page'
import { LoadingStone } from '@/components/loading-stone/loading-stone'
import {
  findInvite,
  getCampaignChoice,
  listOwnedCampaigns,
} from '@/db/campaigns'
import { getCharacter, listCharacters } from '@/db/characters'
import { getGmSeat } from '@/db/seats'
import { getTableView } from '@/db/table'
import { appOrigin } from '@/lib/app-origin'
import { requireUser } from '@/lib/session'
import { streamed } from '@/utils/test-utils'

// v0.48.0: a page that reads more once it knows it may be shown runs its checks first (the
// session, and the lookups that answer 404), so that a visit signed out is still redirected and a
// page not open here still answers 404 before anything is sent; and only then shows the loading
// stone, while its content reads the rest. A check only started before the stone, and awaited
// behind it, would be refused only once the page had begun to stream, with 200: so each refusal
// must reject the page itself. The database is mocked at its modules.

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

/** Each page that reads after its checks: how it opens, its checks and the reads after them. */
const PAGES: Record<
  string,
  [() => Promise<ReactElement>, unknown[], unknown[]]
> = {
  'your characters': [() => CharactersPage(), [requireUser], [listCharacters]],
  'your campaigns': [
    () => CampaignsPage(search({})),
    [requireUser],
    [listOwnedCampaigns, appOrigin],
  ],
  "a player's character": [
    () => CharacterPage(params({ id: 'char-1' })),
    [requireUser, getCharacter],
    [getTableView, getCampaignChoice],
  ],
  "the Gamemaster's seat at a character": [
    () => GmCharacterPage(params({ id: 'c1', actor: 'thorin' })),
    [requireUser, getGmSeat],
    [getTableView],
  ],
  'an invite link': [
    () => JoinPage(params({ code: 'invite0123456789' })),
    [requireUser],
    [findInvite],
  ],
}

it.each(Object.entries(PAGES))(
  'the page of %s checks who may see it first, then shows the loading stone while it reads the rest',
  async (_, [page, checks, reads]) => {
    const shown = await page()

    for (const check of checks) expect(check).toHaveBeenCalled()
    for (const read of reads) expect(read).not.toHaveBeenCalled()
    expect(shown.type).toBe(Suspense)
    expect((shown.props as { fallback: unknown }).fallback).toEqual(
      <LoadingStone />,
    )

    await streamed(shown)
    for (const read of reads) expect(read).toHaveBeenCalled()
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
  'the page of %s, %s, is refused before it gives back anything: no stone, none of its reads',
  async (name, _, refuse, refusal) => {
    refuse()
    const [page, , reads] = PAGES[name]

    await expect(page()).rejects.toThrow(refusal)
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
