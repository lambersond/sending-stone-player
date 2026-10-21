import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRemoveControls } from './remove-controls'
import { MOST_MOVED } from '@/constants/sending-stone'
import { TableApiContext } from '@/hooks/use-table-api'
import { removalInventory, sheetItem } from '@/mocks/sending-stone'
import { allItems } from '@/utils/sheet-texts'
import type { LocalMove, LocalUse } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { SheetInventory } from '@/types/sending-stone'
import type { SeatRole } from '@/utils/seat-words'

const inventory = removalInventory()
/** One of Thorin's things, as his sheet has it, by its id. */
const itemOf = (id: string) => {
  const found = allItems({ inventory }).find(item => item.id === id)
  if (!found) throw new Error(`No ${id}`)
  return found
}

/** A move or removal of this page's, of an item, where it stands. */
const state = (
  item: string,
  status: TableRollState['status'] = 'sending',
): TableRollState => ({
  status,
  move: { verb: 'give', things: '1 x', other: 'Vex', item },
})

const logged: LocalUse = {
  kind: 'use',
  id: 'u-remove',
  label: '1 Rope',
  spell: false,
  at: 0,
}

type Options = Parameters<typeof useRemoveControls>[0]
const options = (fields: Partial<Options> = {}): Options => ({
  removes: true,
  inventory,
  table: { states: new Map(), sendRemove: jest.fn() },
  role: 'player',
  name: 'Thorin',
  logMove: jest.fn((move: LocalMove) => ({ ...logged, move })),
  setActed: jest.fn(),
  ...fields,
})

/** Renders the controls' dialog, at a seat, with what opens it. */
function Removing({
  given,
  role,
  item,
}: Readonly<{ given: Options; role: SeatRole; item: string }>) {
  const { remove, dialog } = useRemoveControls(given)
  const removal = remove?.(itemOf(item))
  return (
    <TableApiContext value={{ role, api: '/api/x', key: 'x' }}>
      <button type='button' onClick={removal?.open}>
        Open
      </button>
      {dialog}
    </TableApiContext>
  )
}

describe('components/transfers/remove-controls', () => {
  it('offers nothing while the game removes nothing', () => {
    const { result } = renderHook(() =>
      useRemoveControls(options({ removes: false })),
    )
    expect(result.current.remove).toBeUndefined()
    expect(result.current.dialog).toBeFalsy()
  })

  it('offers Remove… for any stack the game can be told of, none above it', () => {
    const { result } = renderHook(() => useRemoveControls(options()))
    const remove = result.current.remove!
    expect(remove(itemOf('ropeThorin01'))).toEqual({
      open: expect.any(Function),
      waiting: false,
    })
    expect(remove(itemOf('arrowsThorin'))).toBeDefined()
    expect(
      remove(sheetItem({ id: 'gems', name: 'Gems', quantity: MOST_MOVED })),
    ).toBeDefined()
    expect(
      remove(sheetItem({ id: 'gems', name: 'Gems', quantity: MOST_MOVED + 1 })),
    ).toBeUndefined()
  })

  it.each([
    ['a move of the item itself', 'ropeThorin01', 'ropeThorin01'],
    ['a removal of the container it’s in', 'backpackThor', 'gemThorin001'],
    ['a move of the container two up', 'backpackThor', 'pouchThorin1'],
    ['a move of something inside it', 'gemThorin001', 'backpackThor'],
  ])(
    'waits while %s is on its way from this page',
    (_name, moving, removed) => {
      for (const status of ['sending', 'rolling'] as const) {
        const { result } = renderHook(() =>
          useRemoveControls(
            options({
              table: {
                states: new Map([['u-1', state(moving, status)]]),
                sendRemove: jest.fn(),
              },
            }),
          ),
        )
        expect(result.current.remove!(itemOf(removed))?.waiting).toBe(true)
      }
    },
  )

  it('doesn’t wait on another item, a move that’s over, or coins', () => {
    const { result } = renderHook(() =>
      useRemoveControls(
        options({
          table: {
            states: new Map<string, TableRollState>([
              ['u-1', state('potionThorin')],
              ['u-2', state('ropeThorin01', 'done')],
              ['u-3', state('bedrollThorn', 'failed')],
              [
                'u-4',
                {
                  status: 'sending',
                  move: { verb: 'give', things: '5 gp', other: 'Vex' },
                },
              ],
            ]),
            sendRemove: jest.fn(),
          },
        }),
      ),
    )
    const remove = result.current.remove!
    expect(remove(itemOf('ropeThorin01'))?.waiting).toBe(false)
    expect(remove(itemOf('backpackThor'))?.waiting).toBe(false)
    expect(remove(itemOf('chestThorin1'))?.waiting).toBe(false)
  })

  it('keeps the same Remove… while nothing it reads changes', () => {
    const given = options()
    const { result, rerender } = renderHook(() => useRemoveControls(given))
    const first = result.current.remove
    rerender()
    expect(result.current.remove).toBe(first)
  })

  it('opens the confirmation for the item, and sends what it removes, showing the tray', async () => {
    const user = userEvent.setup()
    const given = options()
    render(<Removing given={given} role='player' item='potionThorin' />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Remove Potion of Healing?',
    })
    expect(
      within(dialog).getByText('You remove 3 Potion of Healing.'),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'One fewer' }))
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(given.setActed).toHaveBeenCalledWith(true)
    expect(given.logMove).toHaveBeenCalledWith({
      verb: 'remove',
      things: '2 Potion of Healing',
      other: 'Thorin',
      item: 'potionThorin',
    })
    expect(given.table.sendRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-remove' }),
      { item: 'potionThorin', quantity: 2, held: 3 },
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says the Gamemaster removes it as the character', async () => {
    const user = userEvent.setup()
    const given = options({ role: 'gm' })
    render(<Removing given={given} role='gm' item='ropeThorin01' />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove Rope?' })
    expect(within(dialog).getByText('Thorin removes 1 Rope.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(given.logMove).toHaveBeenCalledWith(
      expect.objectContaining({ mover: 'Thorin', things: '1 Rope' }),
    )
  })

  it('keeps the dialog open, and the item as it was, however the row changes', async () => {
    const user = userEvent.setup()
    const given = options()
    const { rerender } = render(
      <Removing given={given} role='player' item='potionThorin' />,
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    // The stack changes, then the game stops removing a while.
    const fewer: SheetInventory = {
      ...inventory,
      sections: inventory.sections.map(section => ({
        ...section,
        items: section.items.filter(({ id }) => id !== 'potionThorin'),
      })),
    }
    act(() => {
      rerender(
        <Removing
          given={{ ...given, inventory: fewer, removes: false }}
          role='player'
          item='ropeThorin01'
        />,
      )
    })
    const dialog = screen.getByRole('dialog', {
      name: 'Remove Potion of Healing?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(given.table.sendRemove).toHaveBeenCalledWith(expect.anything(), {
      item: 'potionThorin',
      quantity: 3,
      held: 3,
    })
  })
})
