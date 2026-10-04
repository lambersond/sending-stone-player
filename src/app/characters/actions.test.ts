import { refresh } from 'next/cache'
import { addCharacter, removeCharacter } from './actions'
import { createCharacter, deleteCharacter } from '@/db/characters'
import { requireUser } from '@/lib/session'

jest.mock('next/cache', () => ({ refresh: jest.fn() }))
jest.mock('@/db/characters', () => ({
  createCharacter: jest.fn(),
  deleteCharacter: jest.fn(),
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

  describe('addCharacter', () => {
    it('saves a valid character for the signed-in user', async () => {
      const state = await addCharacter(
        {},
        formData({ name: ' Thorin ', gameUrl: 'my-game.forge-vtt.com/game' }),
      )

      expect(state).toEqual({})
      expect(createCharacter).toHaveBeenCalledWith('user-1', {
        name: 'Thorin',
        gameUrl: 'https://my-game.forge-vtt.com',
      })
      expect(refresh).toHaveBeenCalled()
    })

    it('returns field errors and the submitted values when invalid', async () => {
      const state = await addCharacter(
        {},
        formData({ name: '', gameUrl: 'https://example.com' }),
      )

      expect(state).toEqual({
        values: { name: '', gameUrl: 'https://example.com' },
        errors: {
          name: ['Give your character a name.'],
          gameUrl: [
            "Use your game's Forge address, like https://my-game.forge-vtt.com.",
          ],
        },
      })
      expect(createCharacter).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
    })

    it('treats missing fields as blank', async () => {
      const state = await addCharacter({}, new FormData())

      expect(state.values).toEqual({ name: '', gameUrl: '' })
      expect(state.errors?.name).toEqual(['Give your character a name.'])
    })

    it('reports a failure to save', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(createCharacter).mockRejectedValue(new Error('db down'))

      const state = await addCharacter(
        {},
        formData({ name: 'Thorin', gameUrl: 'https://my-game.forge-vtt.com' }),
      )

      expect(state).toEqual({
        values: { name: 'Thorin', gameUrl: 'https://my-game.forge-vtt.com' },
        message: 'Your character could not be saved. Try again.',
      })
      expect(refresh).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('does nothing for someone not signed in', async () => {
      jest.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))

      await expect(
        addCharacter({}, formData({ name: 'Thorin', gameUrl: 'x' })),
      ).rejects.toThrow('NEXT_REDIRECT')
      expect(createCharacter).not.toHaveBeenCalled()
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
})
