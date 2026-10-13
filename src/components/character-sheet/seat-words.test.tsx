import { render, screen } from '@testing-library/react'
import { PromptBanner } from './prompt-banner'
import { RollToasts } from './roll-toasts'
import {
  briefOf,
  reasons,
  REASONS,
  RollTray,
  type TableRolls,
} from './roll-tray'
import { TableApiContext } from '@/hooks/use-table-api'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { LocalCheck } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

// The Gamemaster at one of their campaign's characters' sheets (#156) reads every string that
// names the Gamemaster as their own: "your game", never "your Gamemaster's"; the player reads
// them as they always did.

const seat = {
  role: 'gm' as const,
  api: '/api/campaigns/c1/characters/thorin',
  key: 'gm:c1:thorin',
}
const asGm = (ui: React.ReactNode) => (
  <TableApiContext value={seat}>{ui}</TableApiContext>
)

const perception: LocalCheck = {
  kind: 'check',
  id: 'c1',
  label: 'Perception check',
  total: 16,
  modifier: 4,
  d20s: [12],
  natural: 12,
  extras: [],
  at: 0,
}
const failed = (reason: string): TableRollState => ({
  status: 'failed',
  reason,
})
const tableOf = (state: TableRollState, available = true): TableRolls => ({
  states: new Map([['c1', state]]),
  available,
  sending: true,
})
const sheet = toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com')

describe("the table's words for each seat (#156)", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each(Object.keys(REASONS))(
    "%s: the Gamemaster's tray and toast never name the Gamemaster as someone else",
    reason => {
      const tray = render(
        asGm(
          <RollTray
            rolls={[perception]}
            rolling={false}
            table={tableOf(failed(reason))}
          />,
        ),
      )
      expect(tray.container.textContent).not.toMatch(/your Gamemaster/i)
      tray.unmount()

      render(
        asGm(
          <RollToasts
            rolls={[perception]}
            states={tableOf(failed(reason)).states}
            on
          />,
        ),
      )
      expect(screen.getByRole('log')).toHaveTextContent(/Not made at the table/)
      expect(document.body.textContent).not.toMatch(/your Gamemaster/i)
      expect(briefOf(perception, failed(reason), 'gm').table?.text).not.toMatch(
        /Gamemaster/,
      )
      expect(reasons('gm')[reason]).not.toMatch(/Gamemaster/)
    },
  )

  it("names the game as the Gamemaster's own on its way there, and while nothing is sent", () => {
    const { rerender } = render(
      asGm(
        <RollTray
          rolls={[perception]}
          rolling={false}
          table={tableOf({ status: 'sending' })}
        />,
      ),
    )
    expect(screen.getByText('Sending to your game…')).toBeInTheDocument()

    rerender(
      asGm(
        <RollTray
          rolls={[perception]}
          rolling={false}
          table={tableOf({ status: 'sending' }, false)}
        />,
      ),
    )
    expect(
      screen.getByText(
        "Only you see these rolls for now. They aren't sent to your game.",
      ),
    ).toBeInTheDocument()
    expect(reasons('gm')).toMatchObject({
      unavailable: 'your game isn’t taking rolls now',
      scene: 'you aren’t viewing that target’s level or scene',
      enchant:
        'it was used, but the enchantment wasn’t applied: you can apply it from the card',
    })
  })

  it("leaves the player's words as they were", () => {
    expect(REASONS).toBe(reasons('player'))
    expect(REASONS).toMatchObject({
      unavailable: 'your Gamemaster’s game isn’t taking rolls now',
      lost: 'no answer from your Gamemaster’s game',
      scene: 'your Gamemaster isn’t viewing that target’s level or scene',
      'active-defence': 'your Gamemaster’s targets defend themselves',
      enchant:
        'it was used, but the enchantment wasn’t applied: your Gamemaster can apply it from the card',
    })
    expect(briefOf(perception, failed('unavailable')).table?.text).toBe(
      'Not made at the table: your Gamemaster’s game isn’t taking rolls now',
    )

    render(
      <RollTray
        rolls={[perception]}
        rolling={false}
        table={tableOf({ status: 'sending' }, false)}
      />,
    )
    expect(
      screen.getByText(
        "Only you see these rolls for now. They aren't sent to your Gamemaster's game.",
      ),
    ).toBeInTheDocument()
  })

  it.each([
    ['player', (ui: React.ReactNode) => ui, 'Your Gamemaster asks'],
    ['Gamemaster', asGm, 'Your game asks'],
  ])(
    "heads the saves the game asks for in the %s's words",
    (_who, wrap, heading) => {
      render(
        wrap(
          <PromptBanner
            prompts={[
              {
                id: 'msg1-thorin',
                type: 'save',
                abilities: ['dex'],
                dc: 13,
                expiresAt: '2099-01-01T00:00:00.000Z',
              },
            ]}
            sheet={sheet}
            answering={new Set()}
            sending
            onSend={() => {}}
            onRoll={() => {}}
          />,
        ),
      )

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    },
  )
})
