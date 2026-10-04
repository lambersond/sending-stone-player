import { render, screen } from '@testing-library/react'
import JoinPage from './page'
import { joinAsCharacter } from '@/app/characters/actions'
import { findInvite } from '@/db/campaigns'
import { requireUser } from '@/lib/session'

jest.mock('@/app/characters/actions', () => ({ joinAsCharacter: jest.fn() }))
jest.mock('@/db/campaigns', () => ({ findInvite: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/character-chooser', () => ({
  CharacterChooser: ({ choice, action, submitLabel }: any) => (
    <button type='button' onClick={() => action({}, 'form')}>
      {submitLabel} in {choice.title}
    </button>
  ),
}))

const props = (code: string) => ({
  params: Promise.resolve({ code }),
  searchParams: Promise.resolve({}),
})

describe('app/join/[code]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
  })

  it("offers the campaign's characters, sending anyone signed out back here after", async () => {
    jest.mocked(findInvite).mockResolvedValue({
      id: 'c1',
      title: 'The Lonely Mountain',
      worldTitle: 'Return to Erebor',
      gameUrl: 'https://my-game.forge-vtt.com',
      gamemaster: 'Gandalf',
      characters: [
        {
          id: 'actor-thorin',
          name: 'Thorin Oakenshield',
          claimedBy: 'you',
          characterId: 'char-1',
        },
        { id: 'actor-vex', name: 'Vex' },
      ],
    })
    render(await JoinPage(props('code-1')))

    expect(requireUser).toHaveBeenCalledWith('/join/code-1')
    expect(findInvite).toHaveBeenCalledWith('code-1', 'user-1')
    expect(
      screen.getByRole('heading', { name: 'The Lonely Mountain' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Return to Erebor · my-game.forge-vtt.com · run by Gandalf',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Thorin Oakenshield' }),
    ).toHaveAttribute('href', '/characters/char-1')

    screen
      .getByRole('button', {
        name: 'Join as this character in The Lonely Mountain',
      })
      .click()
    expect(joinAsCharacter).toHaveBeenCalledWith('code-1', {}, 'form')
  })

  it("says when a link doesn't work", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(findInvite).mockResolvedValue(undefined)
    render(await JoinPage(props('old')))

    expect(
      screen.getByRole('heading', { name: "This invite link doesn't work" }),
    ).toBeInTheDocument()
  })
})
