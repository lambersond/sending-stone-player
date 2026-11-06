import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Charging } from '../charging/charging'
import { HitPointsTile } from './hit-points-tile'
import type { ChargeActions } from '../charging/types'

/** Thorin before the GM's fall: 22 of 30, 3 temporary. */
const THORIN = { value: 22, max: 30, temp: 3 }
const NAME = 'Hit points: 22 of 30, 3 temporary. Change hit points'

/** The tile, where the sheet does these with the character's numbers. */
const renderTile = (actions: ChargeActions = {}) =>
  render(
    <Charging actions={actions}>
      <HitPointsTile hp={THORIN} />
    </Charging>,
  )

const tile = () => screen.getByRole('button', { name: NAME })

describe('features/sheet/components/hit-points-editor/hit-points-tile', () => {
  it('shows the numbers alone where the game doesn’t take them from here', () => {
    renderTile()

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('22')).toBeVisible()
    expect(screen.getByText('+3 temp')).toBeVisible()
  })

  it('opens the editor from the tile, named for its numbers, saves from it, and gives focus back', async () => {
    const user = userEvent.setup()
    const hitPoints = jest.fn()
    renderTile({ hitPoints })

    expect(tile()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(tile()).toHaveAttribute('aria-expanded', 'false')
    await user.click(tile())
    expect(tile()).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'One hit point fewer' }),
      ).toHaveFocus(),
    )
    await user.click(
      screen.getByRole('button', { name: 'One hit point fewer' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(hitPoints).toHaveBeenCalledWith({
      op: 'set',
      value: 21,
      from: { value: 22 },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(tile()).toHaveFocus())
  })

  it('closes on Escape, sending nothing, focus back on the tile', async () => {
    const user = userEvent.setup()
    const hitPoints = jest.fn()
    renderTile({ hitPoints })

    await user.click(tile())
    await screen.findByRole('dialog', { name: 'Hit points' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(hitPoints).not.toHaveBeenCalled()
    await waitFor(() => expect(tile()).toHaveFocus())
  })

  it('waits for the game once a change is sent, saying so, and opens nothing meanwhile', async () => {
    const user = userEvent.setup()
    renderTile({ hitPoints: jest.fn(), hitPointsWaiting: true })

    expect(tile()).toHaveAttribute('aria-disabled', 'true')
    expect(tile()).toHaveAccessibleDescription('Waiting for the game')
    expect(screen.getByText('Waiting for the game')).toBeVisible()
    await user.click(tile())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
