import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModifyRoll } from './modify-roll'
import type { RollMode } from '@/types/sending-stone'

const target = {
  label: 'Stealth check',
  modifier: 1,
  mode: -1 as RollMode,
  source: { kind: 'skill' as const, key: 'ste' },
}

const renderForm = (mode: RollMode = -1) => {
  const onRoll = jest.fn()
  const onCancel = jest.fn()
  render(
    <ModifyRoll
      target={target}
      mode={mode}
      onRoll={onRoll}
      onCancel={onCancel}
    />,
  )
  return { onRoll, onCancel }
}

describe('components/character-sheet/modify-roll', () => {
  it("starts from how a tap would roll, saying where the character's mode comes from", () => {
    renderForm()

    expect(screen.getByText(/^, d20 \+1/).parentElement).toHaveTextContent(
      "Stealth check, d20 +1. Disadvantage from the character's conditions or features.",
    )
    expect(screen.getByRole('radio', { name: 'Disadvantage' })).toBeChecked()
  })

  it('rolls with the mode chosen and the extra dice and modifiers', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderForm()

    await user.click(screen.getByRole('radio', { name: 'Advantage' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Extra dice or modifiers' }),
      '1d4, -1d6 +2',
    )
    await user.click(screen.getByRole('button', { name: 'Roll' }))

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: 'adv',
      extras: [
        { sign: 1, count: 1, sides: 4 },
        { sign: -1, count: 1, sides: 6 },
        { sign: 1, flat: 2 },
      ],
      // The player's say, for the Gamemaster's game too.
      source: { kind: 'skill', key: 'ste' },
      explicit: true,
    })
  })

  it('rolls normally with nothing extra', async () => {
    const user = userEvent.setup()
    const { onRoll } = renderForm(0)

    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Roll' }))

    expect(onRoll).toHaveBeenCalledWith({
      label: 'Stealth check',
      modifier: 1,
      advantage: undefined,
      extras: [],
      source: { kind: 'skill', key: 'ste' },
      explicit: true,
    })
  })

  it("says what it can't read, until the player changes it", async () => {
    const user = userEvent.setup()
    const { onRoll } = renderForm()
    const input = screen.getByRole('textbox', {
      name: 'Extra dice or modifiers',
    })

    await user.type(input, '1d7')
    await user.click(screen.getByRole('button', { name: 'Roll' }))

    expect(onRoll).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      "There's no d7. Use d4, d6, d8, d10, d12, d20 or d100.",
    )

    await user.type(input, '{Backspace}8')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription(/Such as 1d4 for Bless/)
  })

  it('cancels', async () => {
    const user = userEvent.setup()
    const { onRoll, onCancel } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onRoll).not.toHaveBeenCalled()
  })
})
