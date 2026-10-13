import { renderHook } from '@testing-library/react'
import { TableApiContext, useTableApi, useTableRole } from './use-table-api'
import type { TableSeat } from '@/types/character'

const withSeat =
  (seat: TableSeat) =>
  ({ children }: { children: React.ReactNode }) => (
    <TableApiContext value={seat}>{children}</TableApiContext>
  )

describe('hooks/use-table-api (#156)', () => {
  it("is the character's own API, a player's, where no seat is given", () => {
    const { result } = renderHook(() => [useTableApi('char-1'), useTableRole()])

    expect(result.current).toEqual(['/api/characters/char-1', 'player'])
  })

  it("is the seat's own API where one is given, the Gamemaster's at a character's sheet", () => {
    const { result } = renderHook(
      () => [useTableApi('gm:c1:thorin'), useTableRole()],
      {
        wrapper: withSeat({
          role: 'gm',
          api: '/api/campaigns/c1/characters/thorin',
          key: 'gm:c1:thorin',
        }),
      },
    )

    expect(result.current).toEqual([
      '/api/campaigns/c1/characters/thorin',
      'gm',
    ])
  })
})
