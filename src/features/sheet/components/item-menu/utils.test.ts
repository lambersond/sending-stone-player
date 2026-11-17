import { moveExtras } from './utils'

describe('features/sheet/components/item-menu/utils', () => {
  // ROADMAP item 47: a skill's or a tool's roll menu among the favorites. The first that moves has
  // no Move up and the last no Move down, as `stepOrders` leaves each out; what's offered does the
  // move it was handed.
  const up = jest.fn()
  const down = jest.fn()

  it.each([
    ['no move where the favorite may not move', undefined, []],
    ['Move down alone on the first of them', { down }, [['Move down', down]]],
    ['Move up alone on the last', { up }, [['Move up', up]]],
    [
      'Move up, then Move down, on one between, each doing its own',
      { up, down },
      [
        ['Move up', up],
        ['Move down', down],
      ],
    ],
  ])('hands a roll’s menu %s', (_, moves, offered) => {
    expect(
      moveExtras(moves).map(({ label, onChoose }) => [label, onChoose]),
    ).toEqual(offered)
  })
})
