import { refresh } from 'next/cache'
import {
  changeSecretAction,
  removeCampaignAction,
  resetInviteAction,
  setUpCampaignAction,
} from './actions'
import {
  changeCampaignSecret,
  removeCampaign,
  resetInviteCode,
  setUpCampaign,
} from '@/db/campaigns'
import { requireUser } from '@/lib/session'

jest.mock('next/cache', () => ({ refresh: jest.fn() }))
jest.mock('@/db/campaigns', () => ({
  changeCampaignSecret: jest.fn(),
  removeCampaign: jest.fn(),
  resetInviteCode: jest.fn(),
  setUpCampaign: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))

const formData = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

const values = {
  title: ' The Lonely Mountain ',
  gameUrl: 'my-game.forge-vtt.com',
  secret: 'hunter2-hunter2',
}

describe('app/campaigns/actions', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'gm-1' } as any)
  })

  describe('setUpCampaignAction', () => {
    it('sets up the campaign and hands back its secret to copy', async () => {
      jest.mocked(setUpCampaign).mockResolvedValue({ id: 'c1' })

      await expect(setUpCampaignAction({}, formData(values))).resolves.toEqual({
        saved: { title: 'The Lonely Mountain', secret: 'hunter2-hunter2' },
      })
      expect(requireUser).toHaveBeenCalledWith('/campaigns')
      expect(setUpCampaign).toHaveBeenCalledWith('gm-1', {
        title: 'The Lonely Mountain',
        gameUrl: 'https://my-game.forge-vtt.com',
        secret: 'hunter2-hunter2',
      })
      expect(refresh).toHaveBeenCalled()
    })

    it('returns field errors and what was entered when invalid', async () => {
      const state = await setUpCampaignAction({}, new FormData())

      expect(state.values).toEqual({ title: '', gameUrl: '', secret: '' })
      expect(Object.keys(state.errors ?? {})).toEqual([
        'title',
        'gameUrl',
        'secret',
      ])
      expect(setUpCampaign).not.toHaveBeenCalled()
    })

    it('refuses a campaign the Gamemaster already set up', async () => {
      jest.mocked(setUpCampaign).mockResolvedValue('duplicate')

      await expect(setUpCampaignAction({}, formData(values))).resolves.toEqual({
        values,
        errors: {
          title: [
            'You have already set up a campaign with this title for this game.',
          ],
        },
      })
      expect(refresh).not.toHaveBeenCalled()
    })

    it('reports a failure to save', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(setUpCampaign).mockRejectedValue(new Error('db down'))

      await expect(setUpCampaignAction({}, formData(values))).resolves.toEqual({
        values,
        message: 'The campaign could not be saved. Try again.',
      })
      consoleError.mockRestore()
    })
  })

  describe('changeSecretAction', () => {
    it('saves a new secret', async () => {
      await expect(
        changeSecretAction('c1', {}, formData({ secret: ' new-secret-123 ' })),
      ).resolves.toEqual({ saved: true })
      expect(changeCampaignSecret).toHaveBeenCalledWith(
        'gm-1',
        'c1',
        'new-secret-123',
      )
    })

    it('refuses a short one', async () => {
      await expect(
        changeSecretAction('c1', {}, formData({ secret: 'short' })),
      ).resolves.toEqual({ error: 'Use a secret of at least 12 characters.' })
      await expect(
        changeSecretAction('c1', {}, new FormData()),
      ).resolves.toMatchObject({ error: expect.any(String) })
      expect(changeCampaignSecret).not.toHaveBeenCalled()
    })
  })

  it.each([
    ['resets an invite link', resetInviteAction, resetInviteCode],
    ['removes a campaign', removeCampaignAction, removeCampaign],
  ])('%s for the Gamemaster', async (_, action, change) => {
    await action('c1')

    expect(change).toHaveBeenCalledWith('gm-1', 'c1')
    expect(refresh).toHaveBeenCalled()
  })
})
