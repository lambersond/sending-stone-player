import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollTray, type TableRolls } from './roll-tray'
import type { LocalCheck } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

// Decision 5's guard (module 0.32.0): a critical hit's damage as dnd5e makes it, 2d6 + 4, reads as
// the game says it, never with Midi-QOL's `mx2` or an `x2` the app might write.

const attack: LocalCheck = {
  kind: 'check',
  id: 'r1',
  label: 'Longsword attack',
  total: 25,
  modifier: 5,
  d20s: [20],
  natural: 20,
  extras: [],
  at: 0,
}

const made: TableRollState = {
  status: 'done',
  visible: true,
  total: 25,
  requestId: 'req-1',
  attack: { critical: true, fumble: false, outcome: 'hit' },
  damage: {
    critical: true,
    plannable: true,
    rolls: [
      {
        formula: '2d6 + 4',
        type: 'Slashing',
        dice: [{ faces: 6, number: 2 }],
        perDie: 2,
      },
    ],
  },
}

const table = (fields: Partial<TableRolls> = {}): TableRolls => ({
  states: new Map([['r1', made]]),
  available: true,
  sending: true,
  modifies: true,
  rollDamage: jest.fn(),
  ...fields,
})

describe('components/character-sheet/roll-tray, a critical hit as dnd5e makes it (decision 5)', () => {
  it('J2 offers its damage as the game says it, doubled dice and the same number, with no x anywhere', async () => {
    const user = userEvent.setup()
    render(<RollTray rolls={[attack]} rolling={false} table={table()} />)

    const button = screen.getByRole('button', { name: 'Roll critical damage' })
    fireEvent.contextMenu(button)
    const menu = screen.getByRole('menu', {
      name: 'Longsword damage 2d6 + 4',
    })
    expect(document.body.textContent).not.toMatch(/\dx\d|mx/)

    await user.click(
      within(menu).getByRole('menuitem', { name: 'Modify damage…' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '2d6 + 4 Slashing',
    )
    expect(document.body.textContent).not.toMatch(/\dx\d|mx/)
  })
})
