import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  chooseActor,
  deleteCharacterAndLeave,
  joinAsCharacter,
  markChatReadUpTo,
  openInvite,
  removeCharacter,
} from './actions'
import {
  chooseCharacter,
  deleteCharacter,
  joinCampaign,
  markChatRead,
} from '@/db/characters'
import { requireUser } from '@/lib/session'

jest.mock('next/cache', () => ({ refresh: jest.fn() }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
jest.mock('@/db/characters', () => ({
  chooseCharacter: jest.fn(),
  deleteCharacter: jest.fn(),
  joinCampaign: jest.fn(),
  markChatRead: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))

const formData = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe('app/characters/actions', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as any)
  })

  describe('joinAsCharacter', () => {
    it('makes the chosen character and opens its table', async () => {
      jest.mocked(joinCampaign).mockResolvedValue({ id: 'char-9' })

      await expect(
        joinAsCharacter('code-1', {}, formData({ actorId: 'actor-vex' })),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(requireUser).toHaveBeenCalledWith('/join/code-1')
      expect(joinCampaign).toHaveBeenCalledWith('user-1', 'code-1', 'actor-vex')
      expect(redirect).toHaveBeenCalledWith('/characters/char-9')
    })

    it.each([
      [
        'invalid-invite',
        'This invite link no longer works. Ask your Gamemaster for a new one.',
      ],
      [
        'unknown-character',
        'That character is no longer in the campaign. Choose another.',
      ],
      [
        'taken',
        'Another player has just chosen that character. Choose another.',
      ],
    ] as const)('explains a %s choice', async (problem, message) => {
      jest.mocked(joinCampaign).mockResolvedValue(problem)

      await expect(
        joinAsCharacter('code-1', {}, formData({ actorId: 'actor-vex' })),
      ).resolves.toEqual({ message })
      expect(redirect).not.toHaveBeenCalled()
    })

    it('asks for a choice', async () => {
      await expect(
        joinAsCharacter('code-1', {}, new FormData()),
      ).resolves.toEqual({ message: 'Choose a character.' })
      expect(joinCampaign).not.toHaveBeenCalled()
    })
  })

  describe('chooseActor', () => {
    it("saves which of its campaign's characters it is", async () => {
      jest.mocked(chooseCharacter).mockResolvedValue(true)

      await expect(
        chooseActor('char-1', {}, formData({ actorId: 'actor-vex' })),
      ).resolves.toEqual({})
      expect(chooseCharacter).toHaveBeenCalledWith(
        'user-1',
        'char-1',
        'actor-vex',
      )
      expect(refresh).toHaveBeenCalled()
    })

    it('says why it could not', async () => {
      jest.mocked(chooseCharacter).mockResolvedValueOnce('missing')
      await expect(
        chooseActor('char-1', {}, formData({ actorId: 'actor-vex' })),
      ).resolves.toEqual({
        message: 'This character is no longer in a campaign.',
      })

      jest.mocked(chooseCharacter).mockResolvedValueOnce('taken')
      await expect(
        chooseActor('char-1', {}, formData({ actorId: 'actor-vex' })),
      ).resolves.toEqual({
        message:
          'Another player has just chosen that character. Choose another.',
      })

      await expect(chooseActor('char-1', {}, new FormData())).resolves.toEqual({
        message: 'Choose a character.',
      })
      expect(refresh).not.toHaveBeenCalled()
    })
  })

  describe('openInvite', () => {
    it('follows a pasted invite link', async () => {
      await expect(
        openInvite(
          {},
          formData({ invite: 'https://stone.example/join/AbCdEfGh_-123456' }),
        ),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(redirect).toHaveBeenCalledWith('/join/AbCdEfGh_-123456')
    })

    it('asks again for something that is not an invite link', async () => {
      await expect(
        openInvite({}, formData({ invite: 'https://example.com' })),
      ).resolves.toEqual({
        value: 'https://example.com',
        error: 'Paste the invite link your Gamemaster shared.',
      })
      await expect(openInvite({}, new FormData())).resolves.toMatchObject({
        value: '',
      })
    })
  })

  describe('deleteCharacterAndLeave', () => {
    it('deletes the character and goes back to the list', async () => {
      await expect(deleteCharacterAndLeave('char-1')).rejects.toThrow(
        'NEXT_REDIRECT',
      )
      expect(deleteCharacter).toHaveBeenCalledWith('user-1', 'char-1')
      expect(redirect).toHaveBeenCalledWith('/characters')
    })
  })

  describe('removeCharacter', () => {
    it("deletes the character from the signed-in user's list", async () => {
      await removeCharacter('char-1')

      expect(deleteCharacter).toHaveBeenCalledWith('user-1', 'char-1')
      expect(refresh).toHaveBeenCalled()
    })

    it('does nothing for someone not signed in', async () => {
      jest.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))

      await expect(removeCharacter('char-1')).rejects.toThrow('NEXT_REDIRECT')
      expect(deleteCharacter).not.toHaveBeenCalled()
    })
  })

  describe('markChatReadUpTo', () => {
    it("notes how far the player has read the character's chat", async () => {
      await markChatReadUpTo('char-1', '2026-10-04T19:02:00.000Z')

      expect(markChatRead).toHaveBeenCalledWith(
        'user-1',
        'char-1',
        new Date('2026-10-04T19:02:00.000Z'),
      )
    })

    it('takes a time to come as now, and ignores one it cannot read', async () => {
      const before = Date.now()
      await markChatReadUpTo('char-1', '2999-01-01T00:00:00.000Z')
      const at = jest.mocked(markChatRead).mock.calls[0][2]
      expect(at.getTime()).toBeGreaterThanOrEqual(before)
      expect(at.getTime()).toBeLessThanOrEqual(Date.now())

      await markChatReadUpTo('char-1', 'soon')
      expect(markChatRead).toHaveBeenCalledTimes(1)
    })
  })
})
