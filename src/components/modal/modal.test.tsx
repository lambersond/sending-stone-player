import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'
import { Modal } from './modal'

describe('components/modal', () => {
  it('opens and closes the dialog, rendering its content only while open', () => {
    const onClose = jest.fn()
    const { rerender } = render(
      <Modal open={false} onClose={onClose} title='New campaign'>
        <p>Form</p>
      </Modal>,
    )
    const dialog = document.querySelector('dialog') as HTMLDialogElement
    expect(dialog.open).toBe(false)
    expect(screen.queryByText('Form')).toBeNull()

    rerender(
      <Modal open onClose={onClose} title='New campaign'>
        <p>Form</p>
      </Modal>,
    )
    expect(dialog.open).toBe(true)
    expect(
      screen.getByRole('dialog', { name: 'New campaign' }),
    ).toHaveTextContent('Form')

    rerender(
      <Modal open={false} onClose={onClose} title='New campaign'>
        <p>Form</p>
      </Modal>,
    )
    expect(dialog.open).toBe(false)
  })

  it('closes from its button, its backdrop and Escape, but not from inside', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(
      <Modal open onClose={onClose} title='Help'>
        <p>Steps</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Help' })

    await user.click(screen.getByText('Steps'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent.click(dialog)
    // The browser closes the dialog on Escape, firing close.
    fireEvent(dialog, new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

describe('components/modal/confirm-dialog', () => {
  it('asks, then acts and closes', async () => {
    const onConfirm = jest.fn(async () => {})
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        trigger='Delete'
        triggerLabel='Delete Thorin'
        triggerClassName='x'
        title='Delete Thorin?'
        confirmLabel='Delete'
        onConfirm={onConfirm}
        danger
      >
        <p>Gone for good.</p>
      </ConfirmDialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Delete Thorin' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Thorin?' })
    expect(dialog).toHaveTextContent('Gone for good.')
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirm).toHaveClass('bg-danger')
    await user.click(confirm)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(dialog).not.toHaveAttribute('open')
  })

  it('does nothing when cancelled', async () => {
    const onConfirm = jest.fn(async () => {})
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        trigger='Reset link'
        triggerClassName='x'
        title='Reset?'
        confirmLabel='Reset link'
        onConfirm={onConfirm}
      >
        <p>New link.</p>
      </ConfirmDialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    const dialog = screen.getByRole('dialog', { name: 'Reset?' })
    expect(
      within(dialog).getByRole('button', { name: 'Reset link' }),
    ).toHaveClass('bg-primary')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(dialog).not.toHaveAttribute('open')
  })
})
