import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notFound } from 'next/navigation'
import NotFound from './not-found'
import GmPartyPage, { generateMetadata } from './page'
import { getGroupView } from '@/db/party'
import { requireUser } from '@/lib/session'
import { movingPartyView } from '@/mocks/sending-stone'
import type { PartyPage as RealPartyPage } from '@/components/party-sheet'
import type { ComponentProps } from 'react'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: () => ({ refresh: jest.fn() }),
}))
jest.mock('@/db/party', () => ({ getGroupView: jest.fn() }))
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
        {back.label}
        {ownSheetHref && `, own sheet ${ownSheetHref}`}
      </p>
    )
  },
}))

/** Whether a value is only data, as props from a server page to the browser must be. */
const onlyData = (value: unknown): boolean => {
  if (typeof value === 'function' || typeof value === 'symbol') return false
  if (Array.isArray(value)) return value.every(each => onlyData(each))
  if (value && typeof value === 'object') {
    return Object.values(value).every(each => onlyData(each))
  }
  return true
}

const view = {
  version: 7,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: { id: 'hidden', name: 'The Hidden Hand', primary: false },
  private: true as const,
}

const respond = (status: number, body: unknown) =>
  ({ status, ok: true, json: async () => body }) as Response

const props = (id: string, group: string) => ({
  params: Promise.resolve({ id, group }),
  searchParams: Promise.resolve({}),
})

describe('app/campaigns/[id]/party/[group]/page', () => {
  beforeEach(() => {
    jest.mocked(requireUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(getGroupView).mockResolvedValue(view)
  })

  it("shows the campaign's Gamemaster its party's sheet, whoever may see it in Foundry", async () => {
    render(await GmPartyPage(props('c1', 'hidden')))

    expect(requireUser).toHaveBeenCalledWith('/campaigns/c1/party/hidden')
    expect(getGroupView).toHaveBeenCalledWith(
      { role: 'gm', campaignId: 'c1', userId: 'gm-1' },
      'hidden',
    )
    // Changed on purpose (round 0.39.0 §4.7): back to its campaign, chosen on the campaigns page.
    expect(
      screen.getByText(
        'The Hidden Hand through /api/campaigns/c1/party/hidden as gm, back to /campaigns?campaign=c1 as Your campaigns',
      ),
    ).toBeInTheDocument()
    await expect(generateMetadata(props('c1', 'hidden'))).resolves.toEqual({
      title: 'The Hidden Hand',
    })
  })

  it('sends someone signed out to sign in, and back here', async () => {
    jest.mocked(requireUser).mockRejectedValue(new Error('NEXT_REDIRECT'))

    await expect(GmPartyPage(props('c1', 'hidden'))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
  })

  it('says only that it isn’t open here to anyone else, or of a group no longer there', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getGroupView).mockResolvedValue(undefined)

    await expect(GmPartyPage(props('c1', 'hidden'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(notFound).toHaveBeenCalled()

    render(<NotFound />)
    expect(
      screen.getByRole('heading', {
        name: "This party sheet isn't open here. Its group may have left the campaign.",
      }),
    ).toBeInTheDocument()
    // The campaign perhaps gone with it, the list of them (round 0.39.0).
    expect(
      screen.getByRole('link', { name: 'Your campaigns' }),
    ).toHaveAttribute('href', '/campaigns')
  })

  describe('taking from it (module 0.31.0)', () => {
    const thorin = { id: 'actorThorin1', name: 'Thorin' }
    const vex = { id: 'actorVex0001', name: 'Vex' }
    const gmView = movingPartyView({
      moves: { characters: [thorin, vex] },
    })

    beforeEach(() => {
      given = undefined
      jest.mocked(getGroupView).mockResolvedValue(gmView)
      globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    })

    it('takes into the character picked as it’s taken, passing the page only data', async () => {
      render(await GmPartyPage(props('c1', 'groupIronCo01')))

      expect(given?.takeInto).toEqual({ kind: 'choose', campaignId: 'c1' })
      expect(onlyData(given)).toBe(true)
    })

    it('asks whom to take into, of the campaign’s characters, and takes through their seat', async () => {
      const user = userEvent.setup()
      render(await GmPartyPage(props('c1', 'groupIronCo01')))
      const { PartyPage } = jest.requireActual<
        typeof import('@/components/party-sheet')
      >('@/components/party-sheet')
      if (!given) throw new Error('The page gave nothing')
      render(<PartyPage {...given} />)

      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      const dialog = screen.getByRole('dialog', { name: 'Take Rope' })
      const to = within(dialog).getByRole('group', { name: 'To' })
      expect(within(to).getByText('Characters')).toBeVisible()
      expect(within(to).queryByText('Parties')).toBeNull()
      expect(
        within(to)
          .getAllByRole('radio')
          .map(radio => radio.getAttribute('value')),
      ).toEqual(['actorThorin1', 'actorVex0001'])
      expect(within(dialog).getByText('Choose who gets it.')).toBeVisible()
      const take = within(dialog).getByRole('button', { name: 'Take' })
      expect(take).toHaveAttribute('aria-disabled', 'true')
      await user.click(take)
      expect(fetch).not.toHaveBeenCalled()

      await user.click(within(to).getByRole('radio', { name: 'Vex' }))
      expect(
        within(dialog).getByText('Vex takes 1 Rope from The Iron Company.'),
      ).toBeVisible()
      await user.click(take)

      expect(screen.queryByRole('dialog')).toBeNull()
      const [url, init] = jest.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/campaigns/c1/characters/actorVex0001/rolls')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        kind: 'transfer',
        transfer: {
          from: 'groupIronCo01',
          to: 'actorVex0001',
          items: [{ id: 'rope00000001', quantity: 1 }],
        },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
        label: 'Take 1 Rope from The Iron Company',
      })
      // Told inline, over the stash, as the page has no tray.
      expect(
        screen.getByText('Sending to your game…').closest('p'),
      ).toHaveAttribute('role', 'status')
    })

    it('tells inline who took it, once taken', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValue(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
          }),
        )
      const user = userEvent.setup()
      render(await GmPartyPage(props('c1', 'groupIronCo01')))
      const { PartyPage } = jest.requireActual<
        typeof import('@/components/party-sheet')
      >('@/components/party-sheet')
      if (!given) throw new Error('The page gave nothing')
      render(<PartyPage {...given} />)

      await user.click(screen.getByRole('button', { name: 'Take Rope' }))
      await user.click(screen.getByRole('radio', { name: 'Vex' }))
      await user.click(screen.getByRole('button', { name: 'Take' }))
      expect(
        await screen.findByText(
          'Vex took 1 Rope from The Iron Company',
          {},
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
    })
  })
})
