import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidePanel } from './side-panel'

describe('components/side-panel', () => {
  it('opens and closes, rendering its content only while open', () => {
    const onClose = jest.fn()
    const { rerender } = render(
      <SidePanel open={false} onClose={onClose} title='Conditions'>
        <p>Blinded</p>
      </SidePanel>,
    )
    const dialog = document.querySelector('dialog') as HTMLDialogElement
    expect(dialog.open).toBe(false)
    expect(screen.queryByText('Blinded')).toBeNull()

    rerender(
      <SidePanel
        open
        onClose={onClose}
        title='Conditions'
        subtitle='Every condition'
      >
        <p>Blinded</p>
      </SidePanel>,
    )
    expect(dialog.open).toBe(true)
    const panel = screen.getByRole('dialog', { name: 'Conditions' })
    expect(panel).toHaveTextContent('ConditionsEvery conditionBlinded')
    expect(panel).toHaveClass('ml-auto', 'h-dvh', 'max-w-md')

    rerender(
      <SidePanel open={false} onClose={onClose} title='Conditions'>
        <p>Blinded</p>
      </SidePanel>,
    )
    expect(dialog.open).toBe(false)
  })

  it('closes from its button, beside it and Escape, but not from inside', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(
      <SidePanel open onClose={onClose} title='Conditions'>
        <p>Blinded</p>
      </SidePanel>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Conditions' })

    await user.click(screen.getByText('Blinded'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent.click(dialog)
    // The browser closes the dialog on Escape, firing close.
    fireEvent(dialog, new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
