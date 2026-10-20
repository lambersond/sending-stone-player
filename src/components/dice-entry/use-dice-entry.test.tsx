import { act, render, screen } from '@testing-library/react'
import { useDiceEntry } from './use-dice-entry'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'

// The dialog itself is APP-B's, tested beside it: here, one that says what it's asking for and
// gives back what it's told, to test how the host asks for each roll in turn.
jest.mock('./dice-entry-dialog', () => ({
  DiceEntryDialog: ({
    entry,
    onDone,
    onCancel,
  }: {
    entry?: DiceEntry
    onDone: (values: number[][]) => void
    onCancel: () => void
  }) =>
    entry ? (
      <div role='dialog' aria-label={entry.title}>
        <button
          type='button'
          onClick={() =>
            onDone(
              entry.terms.map(({ count }) =>
                Array.from({ length: count }, () => 4),
              ),
            )
          }
        >
          Done
        </button>
        <button type='button' onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : undefined,
}))

const entry = (title: string, fields: Partial<DiceEntry> = {}): DiceEntry => ({
  title,
  terms: [{ sides: 20, count: 1, label: 'd20' }],
  total: () => 0,
  ...fields,
})

/** The ways the host was asked with, each render's. */
const asked: EnterDice[] = []

/** The sheet, with the host's dialog on it. */
function Sheet() {
  const { enter, dialog } = useDiceEntry()
  asked.push(enter)
  return <>{dialog}</>
}

/** Ask for a roll's dice, as the roller does. */
const enter = (wanted: DiceEntry) => {
  let answer: Promise<number[][] | undefined> | undefined
  act(() => {
    answer = asked.at(-1)?.(wanted)
  })
  return answer as Promise<number[][] | undefined>
}

const dialog = () => screen.queryByRole('dialog')
const press = (name: string) =>
  act(() => screen.getByRole('button', { name }).click())

describe('components/dice-entry/use-dice-entry', () => {
  beforeEach(() => {
    asked.length = 0
  })

  it('asks for each roll in turn, first come first asked, the next once the last closes', async () => {
    render(<Sheet />)
    const first = enter(entry('Perception check'))
    const second = enter(
      entry('Longsword damage', {
        terms: [{ sides: 8, count: 2, label: '2d8 Slashing' }],
      }),
    )
    expect(dialog()).toHaveAccessibleName('Perception check')

    press('Done')
    await expect(first).resolves.toEqual([[4]])
    expect(dialog()).toHaveAccessibleName('Longsword damage')

    press('Done')
    await expect(second).resolves.toEqual([[4, 4]])
    expect(dialog()).toBeNull()
  })

  it('gives nothing back for a roll cancelled', async () => {
    render(<Sheet />)
    const answer = enter(entry('Perception check'))

    press('Cancel')
    await expect(answer).resolves.toBeUndefined()
    expect(dialog()).toBeNull()
  })

  it('never opens for what was answered elsewhere already, and closes, or never opens, once it is', async () => {
    render(<Sheet />)
    const answered = new AbortController()
    answered.abort()
    const open = new AbortController()
    const waiting = new AbortController()

    const before = enter(
      entry('Dexterity saving throw', { signal: answered.signal }),
    )
    const shown = enter(entry('Wisdom saving throw', { signal: open.signal }))
    const queued = enter(
      entry('Constitution saving throw', { signal: waiting.signal }),
    )
    const after = enter(entry('Perception check'))
    await expect(before).resolves.toBeUndefined()
    expect(dialog()).toHaveAccessibleName('Wisdom saving throw')

    // Answered in Foundry while waiting its turn: it never opens.
    act(() => waiting.abort())
    await expect(queued).resolves.toBeUndefined()
    // Answered while open: it closes, and the next opens.
    act(() => open.abort())
    await expect(shown).resolves.toBeUndefined()
    expect(dialog()).toHaveAccessibleName('Perception check')

    press('Done')
    await expect(after).resolves.toEqual([[4]])
  })

  it('gives nothing back for every roll still asked for once the sheet goes', async () => {
    const { unmount } = render(<Sheet />)
    const open = enter(entry('Perception check'))
    const waiting = enter(entry('Stealth check'))

    unmount()
    await expect(open).resolves.toBeUndefined()
    await expect(waiting).resolves.toBeUndefined()
  })

  it('asks through the same function every time', () => {
    const { rerender } = render(<Sheet />)
    rerender(<Sheet />)
    enter(entry('Perception check'))

    expect(asked.length).toBeGreaterThan(2)
    expect(new Set(asked).size).toBe(1)
  })
})
