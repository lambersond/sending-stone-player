import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignRow, rowOf, subOf } from './campaign-row'
import type { OwnedCampaign } from '@/types/campaign'

const campaign = (fields: Partial<OwnedCampaign> = {}): OwnedCampaign => ({
  id: 'strahd',
  title: 'Curse of Strahd',
  gameUrl: 'https://mists.forge-vtt.com',
  worldTitle: 'Barovia',
  inviteCode: 'code-1',
  connected: true,
  rosterReceived: true,
  live: true,
  lastSeenAt: '2026-10-28T19:00:00.000Z',
  rolls: {
    enabled: false,
    reaching: false,
    attacks: false,
    spells: false,
    prompts: false,
  },
  transfers: { enabled: false, reaching: false },
  characters: [
    {
      id: 'ireena',
      name: 'Ireena Kolyana',
      player: 'Maya Ross',
      characterId: 'char-1',
    },
    { id: 'kasimir', name: 'Kasimir' },
  ],
  groups: [],
  ...fields,
})

const refused = (current: boolean): OwnedCampaign['refusal'] => ({
  reason: 'wrongSecret',
  status: 401,
  at: '2026-10-28T20:15:00.000Z',
  current,
})

const renderRow = (
  fields: Partial<OwnedCampaign> = {},
  current = false,
  onChoose = jest.fn(),
) => {
  render(
    <CampaignRow
      row={rowOf(campaign(fields))}
      current={current}
      onChoose={onChoose}
    />,
  )
  return screen.getByRole('button')
}

describe('components/campaigns/campaign-row (round 0.39.0)', () => {
  describe('rowOf', () => {
    it('hands the index no more of a campaign than its row draws', () => {
      expect(rowOf(campaign())).toEqual({
        id: 'strahd',
        title: 'Curse of Strahd',
        worldTitle: 'Barovia',
        sub: 'Barovia · mists.forge-vtt.com',
        state: 'live',
        seats: {
          shown: [
            {
              character: 'Ireena Kolyana',
              player: 'Maya Ross',
              initials: 'MR',
            },
            { character: 'Kasimir' },
          ],
          chosen: 1,
          total: 2,
        },
        live: true,
        lastSeenAt: '2026-10-28T19:00:00.000Z',
      })
    })

    it.each([
      [
        'a refusal, current',
        { refusal: refused(true), live: false },
        'refused',
      ],
      ['a refusal, current, while live', { refusal: refused(true) }, 'refused'],
      ['a refusal, past', { refusal: refused(false) }, 'live'],
      ['no first connection', { connected: false, live: false }, 'waiting'],
      ['Foundry not heard of late', { live: false }, 'offline'],
    ] as const)('says where its Foundry stands: %s', (_, fields, state) => {
      expect(rowOf(campaign(fields as Partial<OwnedCampaign>)).state).toBe(
        state,
      )
    })

    it('flags what the campaign needs of its Gamemaster, and nothing where it needs nothing', () => {
      expect(rowOf(campaign({ refusal: refused(true) })).flag).toEqual({
        attention: 'refused',
        text: 'Foundry’s posts refused: wrong secret',
      })
      expect(rowOf(campaign({ connected: false, live: false })).flag).toEqual({
        attention: 'waiting',
        text: 'Connect Foundry to start',
      })
      expect(rowOf(campaign({ refusal: refused(false) }))).not.toHaveProperty(
        'flag',
      )
    })

    it.each([
      [{ worldTitle: 'Barovia' }, 'Barovia · mists.forge-vtt.com'],
      [{ worldTitle: undefined }, 'mists.forge-vtt.com'],
      [{ worldTitle: undefined, gameUrl: '' }, 'Not connected yet'],
      [{ worldTitle: 'Barovia', gameUrl: '' }, 'Barovia'],
    ])('words its line under the title: %j', (fields, sub) => {
      expect(subOf(campaign(fields))).toBe(sub)
    })
  })

  it('is a button named by what it shows, its seats hidden, its title and line each cut to one line', () => {
    const button = renderRow({ live: false })

    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAccessibleName(
      new RegExp(
        String.raw`^Curse of Strahd\s*Barovia · mists\.forge-vtt\.com\s*Offline\s*` +
          String.raw`1 of 2 characters chosen\s*Last heard`,
      ),
    )
    expect(within(button).getByText('Curse of Strahd')).toHaveClass(
      'truncate',
      'text-[15px]',
      'font-semibold',
    )
    expect(
      within(button).getByText('Barovia · mists.forge-vtt.com'),
    ).toHaveClass('truncate')
    expect(button).toHaveClass('min-h-11', 'w-full', 'text-left')
    // Only what a button may hold.
    expect(button.querySelector('div, p, ul, h2, h3')).toBeNull()
    expect(button.querySelector('[data-seats]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('flags a campaign that needs its Gamemaster in place of its seats', () => {
    const button = renderRow({ refusal: refused(true), live: false })

    expect(within(button).getByText('Refused')).toBeInTheDocument()
    const flag = within(button).getByText(
      'Foundry’s posts refused: wrong secret',
    )
    expect(flag).toHaveClass('text-danger')
    expect(flag.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(within(button).queryByText(/characters chosen/)).toBeNull()
  })

  it('flags a campaign waiting for its first connection, in the warning colour', () => {
    const button = renderRow({
      connected: false,
      live: false,
      lastSeenAt: undefined,
    })

    expect(within(button).getByText('Waiting for Foundry')).toBeInTheDocument()
    expect(within(button).getByText('Connect Foundry to start')).toHaveClass(
      'text-warning',
    )
    // Never heard: no Last heard.
    expect(within(button).queryByText(/Last heard/)).toBeNull()
  })

  it('says when Foundry was last heard only where it isn’t live', () => {
    expect(renderRow()).not.toHaveTextContent('Last heard')
  })

  it('opens its campaign when pressed, marked current only where told', async () => {
    const user = userEvent.setup()
    const onChoose = jest.fn()
    const button = renderRow({}, false, onChoose)
    expect(button).not.toHaveAttribute('aria-current')

    await user.click(button)
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('is drawn as chosen, with an inset bar, while current', () => {
    const button = renderRow({}, true)

    expect(button).toHaveAttribute('aria-current', 'true')
    expect(button).toHaveClass(
      'border-primary',
      'shadow-[inset_3px_0_0_var(--color-primary)]',
    )
  })

  it('pulses its Live chip’s dot only where the reader allows motion', () => {
    const dot = renderRow().querySelector('[data-state="live"] > [aria-hidden]')

    expect(dot).toHaveClass('bg-primary', 'motion-safe:animate-pulse')
    expect(dot).not.toHaveClass('animate-pulse')
  })

  it.each([
    ['refused', { refusal: refused(true), live: false }],
    ['waiting', { connected: false, live: false }],
    ['offline', { live: false }],
  ] as const)('never pulses the dot of a chip saying %s', (state, fields) => {
    const chip = renderRow(fields as Partial<OwnedCampaign>).querySelector(
      '[data-state]',
    )
    const dot = chip?.querySelector(':scope > [aria-hidden]')

    expect(chip).toHaveAttribute('data-state', state)
    expect(dot).toBeInTheDocument()
    expect(dot?.className).not.toMatch(/animate-pulse/)
  })
})
