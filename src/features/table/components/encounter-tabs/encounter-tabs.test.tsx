import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EncounterTabs } from './encounter-tabs'
import { mockTurnCombat } from '@/mocks/sending-stone'

/** Thorin's fight, the goblin's turn; Brakka's, hers; and Vex's, Thorin's turn. */
const combats = [
  mockTurnCombat({ id: 'a', currentId: 'c-goblin', round: 2 }),
  mockTurnCombat({ id: 'b', currentId: 'c-brakka' }),
  mockTurnCombat({ id: 'c', currentId: 'c-thorin', name: 'Goblin Ambush' }),
]

describe('features/table/components/encounter-tabs', () => {
  it('names its tablist and each tab, the shown one selected with the Tab stop, news only on the rest', () => {
    render(<EncounterTabs combats={combats} shown='b' onChoose={jest.fn()} />)

    const list = screen.getByRole('tablist', { name: 'Encounters' })
    const tabs = within(list).getAllByRole('tab')
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual([
      'Thorin, round 2',
      'Thorin (2), round 1',
      'Goblin Ambush, round 1, your turn',
    ])
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(tabs.map(tab => tab.tabIndex)).toEqual([-1, 0, -1])
    expect(tabs[1]).toHaveAttribute('aria-controls', 'encounter-panel')
    expect(
      tabs.map(tab => tab.querySelector('.rounded-full') !== null),
    ).toEqual([false, false, true])
    expect(tabs[0]).toHaveTextContent('ThorinRound 2')
  })

  it('moves with the arrows, wrapping, and Home and End, focus first, then shows it', async () => {
    const user = userEvent.setup()
    const onChoose = jest.fn()
    const { rerender } = render(
      <EncounterTabs combats={combats} shown='a' onChoose={onChoose} />,
    )
    const tabs = screen.getAllByRole('tab')

    await user.click(tabs[0])
    await user.keyboard('{ArrowLeft}')
    expect(tabs[2]).toHaveFocus()
    expect(onChoose).toHaveBeenLastCalledWith('c')
    rerender(<EncounterTabs combats={combats} shown='c' onChoose={onChoose} />)
    await user.keyboard('{ArrowRight}')
    expect(onChoose).toHaveBeenLastCalledWith('a')
    rerender(<EncounterTabs combats={combats} shown='a' onChoose={onChoose} />)
    await user.keyboard('{End}')
    expect(tabs[2]).toHaveFocus()
    expect(onChoose).toHaveBeenLastCalledWith('c')
    await user.keyboard('{Home}')
    expect(tabs[0]).toHaveFocus()
    expect(onChoose).toHaveBeenLastCalledWith('a')
  })
})
