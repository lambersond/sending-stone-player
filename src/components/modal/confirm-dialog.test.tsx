import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'

// jsdom shows a dialog without focusing anything in it. A browser's showModal() runs the dialog's
// focusing steps, focusing its first control, here the header's Close: stood in for here.
class FocusingDialog extends HTMLDialogElement {
  override showModal() {
    this.open = true
    this.querySelector<HTMLElement>('button, a[href], input, summary')?.focus()
  }
}
const showModal = HTMLDialogElement.prototype.showModal
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = FocusingDialog.prototype.showModal
})
afterAll(() => {
  HTMLDialogElement.prototype.showModal = showModal
})

const renderDialog = (focusCancel?: boolean) =>
  render(
    <ConfirmDialog
      trigger='Reset link'
      triggerClassName='x'
      title='Reset the invite link?'
      confirmLabel='Reset link'
      onConfirm={jest.fn(async () => {})}
      focusCancel={focusCancel}
    >
      <p>The current link stops working.</p>
    </ConfirmDialog>,
  )

describe('components/modal/confirm-dialog (round 0.39.0)', () => {
  it('opens on Cancel where asked, so Enter keeps things as they are', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Reset the invite link?',
    })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('opens as the browser opens it otherwise, on its Close, as every other dialog of the app', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Reset the invite link?',
    })
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('opens on Cancel again each time it opens', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    let dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
})
