import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MADE_SHOWN_FOR, MoveStatus } from './move-status'
import { TableApiContext } from '@/hooks/use-table-api'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

const move: LocalMove = {
  verb: 'take',
  things: '1 Rope',
  other: 'The Iron Company',
}
const statusOf = (state: TableRollState, onDismiss = jest.fn()) =>
  render(<MoveStatus latest={{ move, state }} onDismiss={onDismiss} />)

describe('components/transfers/move-status', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows nothing without a move', () => {
    const { container } = render(<MoveStatus onDismiss={jest.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says a move is on its way, spinning, with nothing to dismiss', () => {
    statusOf({ status: 'rolling' })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Taking it in your Gamemaster’s game…')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('says a move was made, as the tray does, and clears itself a while after', async () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    statusOf({ status: 'done', visible: true, rolls: [] }, onDismiss)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Took 1 Rope from The Iron Company',
    )
    expect(screen.getByRole('status').querySelector('svg')).toHaveClass(
      'text-primary',
    )
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MADE_SHOWN_FOR - 1)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("says why one wasn't made, in the warning colour, until it's dismissed", async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const onDismiss = jest.fn()
    statusOf({ status: 'failed', reason: 'gone' }, onDismiss)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Not taken: it isn’t there any more')
    expect(status).toHaveClass('text-warning')
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MADE_SHOWN_FOR * 2)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('says it as the Gamemaster reads it, of the character that moved it', () => {
    render(
      <TableApiContext
        value={{
          role: 'gm',
          api: '/api/campaigns/c1/party/company',
          key: 'party',
        }}
      >
        <MoveStatus
          latest={{
            move: { ...move, mover: 'Vex' },
            state: { status: 'done', visible: true, rolls: [] },
          }}
          onDismiss={jest.fn()}
        />
      </TableApiContext>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Vex took 1 Rope from The Iron Company',
    )
  })
})
