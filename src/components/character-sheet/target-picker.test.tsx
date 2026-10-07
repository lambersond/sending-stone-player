/* eslint-disable unicorn/no-null -- the view uses null for a combat without a name */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TargetPicker, targetsOf } from './target-picker'
import type { TableCombat, TableCombatant } from '@/types/table'

const combatant = (
  fields: Partial<TableCombatant> & Pick<TableCombatant, 'id' | 'name'>,
): TableCombatant => ({
  initiative: 10,
  defeated: false,
  side: 'other',
  ...fields,
})

const fight: TableCombat = {
  id: 'cmbt1',
  name: null,
  started: true,
  round: 2,
  combatants: [
    combatant({ id: 'goblin1', name: 'Goblin', initiative: 18 }),
    combatant({ id: 'thorin1', name: 'Thorin Oakenshield', side: 'me' }),
    combatant({ id: 'vex1', name: 'Vex', side: 'party' }),
    combatant({ id: 'boss1', name: 'Goblin Boss', initiative: 4 }),
    combatant({ id: 'wolf1', name: 'Wolf', defeated: true }),
  ],
}

const renderPicker = (last?: string) => {
  const onPick = jest.fn()
  const onClose = jest.fn()
  render(
    <TargetPicker
      open
      label='Warhammer attack'
      combat={fight}
      last={last}
      onPick={onPick}
      onClose={onClose}
    />,
  )
  return { onPick, onClose }
}

describe('components/character-sheet/target-picker', () => {
  it('can attack anyone in the combat but the attacker', () => {
    expect(targetsOf(fight).map(({ id }) => id)).toEqual([
      'goblin1',
      'vex1',
      'boss1',
      'wolf1',
    ])
    expect(targetsOf()).toEqual([])
  })

  it('lists who can be attacked in turn order, marking allies and the defeated, then no one', () => {
    renderPicker()

    const dialog = screen.getByRole('dialog', { name: 'Warhammer attack' })
    expect(dialog).toHaveTextContent('Choose who to attack.')
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['Goblin', 'VexAlly', 'Goblin Boss', 'WolfDefeated', 'No target'])
  })

  it('puts the one last attacked first', () => {
    renderPicker('boss1')

    const [first] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('Goblin BossLast target')
  })

  it('attacks the one picked, or no one', async () => {
    const user = userEvent.setup()
    const { onPick } = renderPicker()

    await user.click(screen.getByRole('button', { name: 'Goblin Boss' }))
    expect(onPick).toHaveBeenLastCalledWith(fight.combatants[3])

    await user.click(screen.getByRole('button', { name: 'No target' }))
    expect(onPick).toHaveBeenLastCalledWith()
  })

  it('closes without attacking', async () => {
    const user = userEvent.setup()
    const { onPick, onClose } = renderPicker()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })
})
