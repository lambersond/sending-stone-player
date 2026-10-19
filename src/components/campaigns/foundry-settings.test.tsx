/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignCard } from './campaign-card'
import { FoundrySettingsSection } from './foundry-settings'
import { foundrySettings, foundrySnapshot } from '@/mocks/sending-stone'
import type { OwnedCampaign } from '@/types/campaign'
import type { FoundrySnapshot } from '@/types/foundry-settings'

const OLD_MODULE = {
  receivedAt: '2026-10-19T18:30:00.000Z',
  module: { id: 'sending-stone', version: '0.29.0' },
  foundry: { version: '14.365', generation: 14 },
  system: { id: 'dnd5e', title: 'D&D Fifth Edition', version: '5.3.3' },
}

const renderSection = (foundry?: FoundrySnapshot) =>
  render(<FoundrySettingsSection campaign={{ foundry }} />)

/** The section, opened as its Gamemaster opens it. */
const opened = async (foundry?: FoundrySnapshot) => {
  const view = renderSection(foundry)
  await userEvent.click(screen.getByText('Foundry settings'))
  return view
}

/** Each pair of a list of terms, as "term: description", the notes after. */
const pairs = (list: HTMLElement) =>
  [...list.children].map(row =>
    [...row.children].map(({ textContent }) => textContent).join(': '),
  )

/** A heading inside the section, and the list after it. */
const listAfter = (name: string) =>
  screen.getByRole('heading', { level: 5, name })
    .nextElementSibling as HTMLElement

describe('components/campaigns/foundry-settings', () => {
  it('is closed until its Gamemaster opens it', async () => {
    const { container } = renderSection(foundrySnapshot())

    const details = container.querySelector('details')
    expect(details).not.toHaveAttribute('open')
    expect(
      within(details?.querySelector('summary') as HTMLElement).getByText(
        'Foundry settings',
      ),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByText('Foundry settings'))
    expect(details).toHaveAttribute('open')
  })

  it('says when Foundry has sent nothing yet', async () => {
    await opened()

    expect(
      screen.getByText(
        "Foundry hasn't sent its settings yet. They arrive the next time your game connects.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Versions' })).toBeNull()
  })

  it('shows the versions an older module sends, and that it reports no settings', async () => {
    const { container } = await opened(OLD_MODULE)

    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      OLD_MODULE.receivedAt,
    )
    expect(screen.getByText(/^As Foundry sent them at/).textContent).not.toBe(
      'As Foundry sent them at ',
    )
    expect(pairs(listAfter('Versions'))).toEqual([
      'Foundry: 14.365',
      'D&D Fifth Edition: 5.3.3',
      'Sending Stone: 0.29.0',
    ])
    expect(
      screen.getByText(
        "Sending Stone 0.29.0 in Foundry doesn't report its settings. Update it to 0.30.0 or later to see them here.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'What players see in chat' }),
    ).toBeNull()
  })

  it("says the same where it can't tell the module's version, and shows what it can't tell as a dash", async () => {
    await opened({
      receivedAt: OLD_MODULE.receivedAt,
      module: { id: 'sending-stone', version: null },
    })

    expect(pairs(listAfter('Versions'))).toEqual([
      'Foundry: —',
      'Sending Stone: —',
    ])
    expect(
      screen.getByText(
        "Your Sending Stone module in Foundry doesn't report its settings. Update it to 0.30.0 or later to see them here.",
      ),
    ).toBeInTheDocument()
  })

  it('shows what players see in chat, then each setting by section, as Foundry labels them', async () => {
    const { container } = await opened(foundrySnapshot())

    expect(pairs(listAfter('Versions'))).toEqual([
      'Foundry: 14.365',
      'D&D Fifth Edition: 5.3.3',
      'Sending Stone: 0.30.0',
      'libWrapper: 1.13.2.0',
      'Manual Dice: — (not enabled)',
    ])
    const results = within(listAfter('What players see in chat')).getAllByRole(
      'listitem',
    )
    expect(results.map(({ textContent }) => textContent)).toEqual(
      foundrySettings().results.map(({ text }) => text),
    )
    // Shown, in the accent; shown in some cases only, in amber; and hidden, muted.
    const icons = results.map(item => item.querySelector('svg'))
    expect(icons[0]).toHaveClass('lucide-eye', 'text-primary')
    expect(icons[1]).toHaveClass('lucide-eye', 'text-warning')
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden')

    expect(pairs(listAfter('This campaign'))).toEqual([
      'Players roll in the app: On',
      'Attacks, spells and features: On',
      'Save and concentration prompts: Off',
      'Allow Players to enter dice results manually: On: Manual Dice is not enabled in this world.',
      'Party sheets: The Company',
    ])
    const note = screen.getByText('Manual Dice is not enabled in this world.')
    expect(note).toHaveClass('text-xs', 'text-text-secondary')
    expect(pairs(listAfter('D&D Fifth Edition'))).toEqual([
      'Attack Result Visibility: Show only results',
      'Challenge Visibility: Show only from other players',
    ])
    expect(
      screen.getByRole('heading', {
        name: 'Sending Stone, for every campaign',
      }),
    ).toBeInTheDocument()
    // No secret, address or token was sent, and none is shown.
    expect(container.textContent).not.toMatch(/secret|https?:/i)
  })

  it('shows a result hidden from players with a shut eye', async () => {
    await opened(
      foundrySnapshot({
        settings: foundrySettings({
          results: [
            {
              id: 'chat',
              state: 'hidden',
              text: 'Chat: not sent (Chat messages: Off)',
            },
          ],
        }),
      }),
    )

    const [result] = within(listAfter('What players see in chat')).getAllByRole(
      'listitem',
    )
    expect(result.querySelector('svg')).toHaveClass(
      'lucide-eye-off',
      'text-text-secondary',
    )
  })

  it('wraps every row on a phone rather than overflowing it, with no fixed columns', async () => {
    const long = 'x'.repeat(120)
    const { container } = await opened(
      foundrySnapshot({
        system: { id: 'dnd5e', title: long, version: long },
      }),
    )

    for (const row of container.querySelectorAll('dl > div')) {
      expect(row).toHaveClass('flex', 'flex-wrap', 'min-w-0')
      for (const part of row.children) {
        expect(part).toHaveClass('min-w-0', 'wrap-anywhere')
      }
    }
    for (const item of container.querySelectorAll('li > span')) {
      expect(item).toHaveClass('min-w-0', 'wrap-anywhere')
    }
    expect(container.innerHTML).not.toMatch(
      /grid-cols|w-\[|min-w-\[|whitespace-nowrap|truncate/,
    )
  })

  it("sits on the campaign's card after the players' rolls, before its footer", () => {
    const campaign: OwnedCampaign = {
      id: 'c1',
      title: 'The Lonely Mountain',
      gameUrl: 'https://my-game.forge-vtt.com',
      inviteCode: 'code-1',
      connected: true,
      rosterReceived: true,
      live: true,
      rolls: {
        enabled: false,
        reaching: false,
        attacks: false,
        spells: false,
        prompts: false,
      },
      characters: [],
      groups: [],
      foundry: foundrySnapshot(),
    }
    render(
      <CampaignCard
        campaign={campaign}
        inviteUrl='https://stone.example/join/code-1'
        changeSecret={jest.fn()}
        resetInvite={jest.fn()}
        removePlayer={jest.fn()}
        remove={jest.fn()}
      />,
    )

    const details = screen.getByText('Foundry settings').closest('details')
    const rolls = screen.getByRole('heading', { name: "Players' rolls" })
    expect(details?.previousElementSibling).toBe(rolls.parentElement)
    expect(details?.nextElementSibling?.tagName).toBe('FOOTER')
  })
})
