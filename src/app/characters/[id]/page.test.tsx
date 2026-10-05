/* eslint-disable unicorn/no-null -- a character with no campaign holds null */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notFound } from 'next/navigation'
import {
  chooseActor,
  deleteCharacterAndLeave,
  markChatReadUpTo,
} from '../actions'
import CharacterPage, { generateMetadata } from './page'
import { getCampaignChoice } from '@/db/campaigns'
import { getCharacter } from '@/db/characters'
import { getTableView } from '@/db/table'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('../actions', () => ({
  chooseActor: jest.fn(),
  deleteCharacterAndLeave: jest.fn(),
  markChatReadUpTo: jest.fn(),
}))
jest.mock('@/db/campaigns', () => ({ getCampaignChoice: jest.fn() }))
jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/table', () => ({ getTableView: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/game-table', () => ({
  GameTable: ({
    character,
    initialView,
    choice,
    chooseActor,
    deleteCharacter,
    markChatRead,
  }: any) => (
    <>
      <button type='button' onClick={() => deleteCharacter()}>
        Delete
      </button>
      <button
        type='button'
        onClick={() => markChatRead('2026-10-04T19:02:00.000Z')}
      >
        Read
      </button>
      <p>
        table for {character.name} at version {initialView.version}
        {choice && `, choosing in ${choice.title}`}
      </p>
      <button type='button' onClick={() => chooseActor({}, 'form')}>
        Choose
      </button>
    </>
  ),
}))

const thorin = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
})

describe('app/characters/[id]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getTableView).mockResolvedValue({
      version: 7,
      live: true,
      connected: true,
      messages: [],
    })
  })

  it("shows the chosen character's table", async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    render(await CharacterPage(props('char-1')))

    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getTableView).toHaveBeenCalledWith(thorin)
    expect(
      screen.getByText('table for Thorin Oakenshield at version 7'),
    ).toBeInTheDocument()
    expect(getCampaignChoice).not.toHaveBeenCalled()
  })

  it("offers the campaign's characters to one yet to choose which it is", async () => {
    jest.mocked(getCharacter).mockResolvedValue({ ...thorin, actorId: null })
    jest.mocked(getCampaignChoice).mockResolvedValue({
      title: 'The Lonely Mountain',
    } as any)
    const user = userEvent.setup()
    render(await CharacterPage(props('char-1')))

    expect(getCampaignChoice).toHaveBeenCalledWith('c1', 'user-1', 'char-1')
    expect(
      screen.getByText(
        'table for Thorin Oakenshield at version 7, choosing in The Lonely Mountain',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Choose' }))
    expect(chooseActor).toHaveBeenCalledWith('char-1', {}, 'form')
  })

  it('deletes this character from its page', async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    const user = userEvent.setup()
    render(await CharacterPage(props('char-1')))

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteCharacterAndLeave).toHaveBeenCalledWith('char-1')
  })

  it('notes how far the player has read its chat', async () => {
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    const user = userEvent.setup()
    render(await CharacterPage(props('char-1')))

    await user.click(screen.getByRole('button', { name: 'Read' }))
    expect(markChatReadUpTo).toHaveBeenCalledWith(
      'char-1',
      '2026-10-04T19:02:00.000Z',
    )
  })

  it('is not found when the user has no such character', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCharacter).mockResolvedValue(undefined)

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
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    await expect(generateMetadata(props('missing'))).resolves.toEqual({
      title: 'Character',
    })
  })
})
