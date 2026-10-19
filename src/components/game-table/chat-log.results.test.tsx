/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { ChatLog } from './chat-log'
import { chatMessage } from '@/mocks/sending-stone'
import { toTableMessages, type Viewer } from '@/utils/table-view'
import type { RollSummary, SerializedMessage } from '@/types/sending-stone'

// What module 0.30.0 sends of chat results that reaches the chat: a check's Success or Failure,
// and the Gamemaster's rolls on Midi-QOL's cards, trimmed as Midi-QOL trims them for players.

const viewer: Viewer = {
  actorId: 'actor-thorin',
  party: new Set(['actor-thorin', 'actor-vex']),
}

const dnd5e = (
  fields: Partial<NonNullable<SerializedMessage['dnd5e']>>,
): SerializedMessage['dnd5e'] => ({
  messageType: 'roll',
  roll: null,
  item: null,
  activity: null,
  targets: [],
  ...fields,
})

/** A check, as module 0.30.0 sends it, by the creature that rolled it. */
const checked = (
  id: string,
  speaker: string,
  check: NonNullable<SerializedMessage['dnd5e']>['check'],
) =>
  chatMessage({
    id,
    speaker: { alias: speaker, actorId: null },
    rolls: [{ formula: '1d20 + 5', total: 17, dice: [] }],
    dnd5e: dnd5e({ roll: { type: 'skill', skillId: 'prc' }, check }),
  })

/** The Gamemaster's roll as a monster, as module 0.30.0 sends it trimmed. */
const gmCard = (rolls: RollSummary[], type: string) =>
  chatMessage({
    id: `gm-${type}`,
    speaker: { alias: 'Goblin Boss', actorId: 'boss' },
    author: { id: 'u-gm', name: 'Gamemaster' },
    text: '',
    rolls,
    dnd5e: dnd5e({ roll: { type } }),
  })

const renderChat = (messages: SerializedMessage[]) =>
  render(<ChatLog messages={toTableMessages(messages, viewer)} />)

/** What the chat says, but when each message was sent. */
const said = (container: HTMLElement) => {
  const copy = container.cloneNode(true) as HTMLElement
  for (const time of copy.querySelectorAll('time')) time.remove()
  return copy.textContent
}

describe('components/game-table/chat-log, results from module 0.30.0', () => {
  it("says whether a check succeeded, in the accent's look, or failed, muted with a cross, read after the name", () => {
    renderChat([
      checked('m1', 'Thorin', { target: 'Actor.thorin', outcome: 'success' }),
      checked('m2', 'Vex', { target: 'Actor.vex', outcome: 'failure' }),
    ])

    const success = screen.getByText('Success')
    expect(success).toHaveClass('bg-primary/10', 'text-primary-text')
    expect(success.querySelector('svg')).toBeNull()
    const failure = screen.getByText('Failure')
    expect(failure).toHaveClass('bg-text-secondary/10', 'text-text-secondary')
    expect(failure.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const named = (name: string) =>
      within(screen.getByRole('list', { name: /chat/i }))
        .getAllByText(name, { selector: '.font-semibold' })
        .at(-1)?.parentElement?.textContent
    expect(named('Thorin')).toBe('Thorin, Success')
    expect(named('Vex')).toBe('Vex, Failure')
  })

  it("keeps a check's outcome from a reader it doesn't name", () => {
    renderChat([
      checked('m1', 'Vex', {
        target: 'Actor.vex',
        outcome: 'success',
        readers: ['actor-vex'],
      }),
    ])

    expect(screen.queryByText('Success')).toBeNull()
    expect(screen.getAllByText('Vex').length).toBeGreaterThan(0)
  })

  describe("the Gamemaster's rolls on Midi-QOL's cards, trimmed", () => {
    it('shows an attack whose roll is hidden as a dash, with no formula, dice nor critical', () => {
      const { container } = renderChat([
        gmCard(
          [
            {
              formula: '',
              total: null,
              dice: [],
              class: 'D20Roll',
              attack: true,
            },
          ],
          'attack',
        ),
      ])

      const total = screen.getByText('Total').parentElement
      expect(total?.textContent).toBe('Total –')
      expect(screen.queryByRole('list', { name: 'Dice' })).toBeNull()
      expect(container.querySelector('.font-mono')?.textContent ?? '').toBe('')
      expect(screen.queryByText('Critical')).toBeNull()
      expect(screen.queryByText('Nat 1')).toBeNull()
    })

    it('shows damage folded into one total with no type, as Damage Total Only does', () => {
      const { container } = renderChat([
        gmCard(
          [
            {
              formula: '',
              total: 12,
              dice: [],
              class: 'DamageRoll',
              damage: true,
              section: 'damage',
            },
          ],
          'damage',
        ),
      ])

      expect(said(container)).toBe('GBGoblin BossDamage12 = 12')
    })

    it('shows hidden damage as a dash', () => {
      const { container } = renderChat([
        gmCard(
          [
            {
              formula: '',
              total: null,
              dice: [],
              class: 'DamageRoll',
              damage: true,
              section: 'damage',
            },
          ],
          'damage',
        ),
      ])

      expect(said(container)).toBe('GBGoblin BossDamage– = –')
    })
  })
})
