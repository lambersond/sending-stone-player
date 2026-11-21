import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GiveButton } from './give-button'

const renderGive = ({ busy = false, quiet = false } = {}) => {
  const onGive = jest.fn()
  render(
    <GiveButton
      label='Give Plain Ring'
      className=''
      busy={busy}
      quiet={quiet}
      onGive={onGive}
    >
      Give…
    </GiveButton>,
  )
  return { button: screen.getByRole('button'), onGive }
}

describe('features/transfers/give-button', () => {
  it('opens its dialog when clicked, as the move is not on its way', async () => {
    const { button, onGive } = renderGive()

    expect(button).toHaveAccessibleName('Give Plain Ring')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).not.toHaveAttribute('aria-disabled')
    expect(button).not.toHaveAttribute('aria-busy')
    await userEvent.click(button)

    expect(onGive).toHaveBeenCalledTimes(1)
  })

  it('waits while its move is on its way: it says so and does nothing, but keeps taking focus (item 85)', async () => {
    const { button, onGive } = renderGive({ busy: true })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).not.toHaveAttribute('disabled')
    button.focus()
    expect(button).toHaveFocus()
    await userEvent.click(button)
    await userEvent.keyboard('{Enter}')

    expect(onGive).not.toHaveBeenCalled()
  })

  it.each([
    [false, 1],
    [true, 0],
  ])(
    'spins while it waits unless quiet (%p), as its row says what is on its way',
    (quiet, spinners) => {
      const { button } = renderGive({ busy: true, quiet })

      expect(button.querySelectorAll('svg')).toHaveLength(spinners)
    },
  )
})
