/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getSheetText } from '@/db/sheet-texts'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/sheet-texts', () => ({ getSheetText: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const HASH = '1a2b3c4d5e6f70'
const character = { id: 'char-1', name: 'Thorin', campaignId: 'c1' }

const get = (hash = HASH) =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-1/texts/${hash}`,
    ),
    { params: Promise.resolve({ id: 'char-1', hash }) },
  )

describe('app/api/characters/[id]/texts/[hash]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character as any)
    jest.mocked(getSheetText).mockResolvedValue('<p>Regain hit points.</p>')
  })

  it('gives a description on the player’s own sheet, for the browser to keep', async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400')
    await expect(response.json()).resolves.toEqual({
      html: '<p>Regain hit points.</p>',
    })
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getSheetText).toHaveBeenCalledWith(character, HASH)
  })

  it('asks the signed-out to sign in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await get()

    expect(response.status).toBe(401)
  })

  it.each([
    ['a malformed hash', () => {}, 'not-a-hash'],
    [
      'another player’s character',
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getCharacter).mockResolvedValue(undefined),
      HASH,
    ],
    [
      'a description its sheet doesn’t refer to',
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getSheetText).mockResolvedValue(undefined),
      HASH,
    ],
  ])('has nothing for %s', async (_, arrange, hash) => {
    arrange()

    const response = await get(hash)

    expect(response.status).toBe(404)
  })

  it('lets a browser ask again for one not yet arrived', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getSheetText).mockResolvedValue(undefined)

    const response = await get()

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
