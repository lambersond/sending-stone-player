import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollMenu } from './roll-menu'

const renderMenu = () => {
  const onChoose = jest.fn()
  const onClose = jest.fn()
  render(
    <>
      <button type='button'>Perception</button>
      <button type='button'>Elsewhere</button>
    </>,
  )
  render(
    <RollMenu
      anchor={screen.getByRole('button', { name: 'Perception' })}
      title='Perception check +7'
      onChoose={onChoose}
      onClose={onClose}
    />,
  )
  return { onChoose, onClose }
}

describe('components/character-sheet/roll-menu', () => {
  it('offers advantage, disadvantage and modifying the roll', async () => {
    const user = userEvent.setup()
    const { onChoose } = renderMenu()

    const menu = screen.getByRole('menu', { name: 'Perception check +7' })
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['Roll with advantage', 'Roll with disadvantage', 'Modify roll…'])
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      ).toHaveFocus(),
    )
    expect(menu).toBeInTheDocument()

    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with disadvantage' }),
    )
    expect(onChoose).toHaveBeenCalledWith('dis')
  })

  it('moves between its items with the arrow keys', async () => {
    const user = userEvent.setup()
    const { onChoose } = renderMenu()
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      ).toHaveFocus(),
    )

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Modify roll…' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onChoose).toHaveBeenCalledWith('adv')
  })

  it.each([
    [
      'Escape',
      (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    ],
    [
      'a click elsewhere',
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Elsewhere' })),
    ],
  ])('closes on %s', async (_, close) => {
    const user = userEvent.setup()
    const { onChoose, onClose } = renderMenu()

    await close(user)

    expect(onClose).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
  })
})
