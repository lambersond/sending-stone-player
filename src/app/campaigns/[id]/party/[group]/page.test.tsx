import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import NotFound from './not-found'
import GmPartyPage, { generateMetadata } from './page'
import { getGroupView } from '@/db/party'
import { requireUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
jest.mock('@/db/party', () => ({ getGroupView: jest.fn() }))
jest.mock('@/lib/session', () => ({ requireUser: jest.fn() }))
jest.mock('@/components/party-sheet', () => ({
  PartyPage: ({ api, role, initialView, back, ownSheetHref }: any) => (
    <p>
      {initialView.group.name} through {api} as {role}, back to {back.href} as{' '}
      {back.label}
      {ownSheetHref && `, own sheet ${ownSheetHref}`}
    </p>
  ),
}))

const view = {
  version: 7,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: { id: 'hidden', name: 'The Hidden Hand', primary: false },
  private: true as const,
}

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
    expect(
      screen.getByText(
        'The Hidden Hand through /api/campaigns/c1/party/hidden as gm, back to /campaigns as Your campaigns',
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
    expect(
      screen.getByRole('link', { name: 'Your campaigns' }),
    ).toHaveAttribute('href', '/campaigns')
  })
})
