import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'
import { Modal } from './modal'
import { usePortalRoot, useTopmostEscape } from './portal-root'
import { SidePanel } from '@/components/side-panel'

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

  it('says under its title what it is given, such as where its content comes from', () => {
    const { rerender } = render(
      <Modal
        open
        onClose={jest.fn()}
        title='Starry Wisp'
        subtitle='Cantrip · From Bardic Flame'
      >
        <p>Its description</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Starry Wisp' })
    expect(within(dialog).getByRole('heading')).toHaveTextContent(
      /^Starry Wisp$/,
    )
    expect(
      within(dialog).getByText('Cantrip · From Bardic Flame'),
    ).toBeVisible()

    rerender(
      <Modal open onClose={jest.fn()} title='Help'>
        <p>Steps</p>
      </Modal>,
    )
    expect(
      screen.getByRole('dialog', { name: 'Help' }).querySelector('header'),
    ).toHaveTextContent(/^Help$/)
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

  it('has Escape close only a menu or tooltip open inside it, cancelling the key, which the browser would otherwise take as a request to close it too', async () => {
    const user = userEvent.setup()
    const pressed: KeyboardEvent[] = []
    const keep = (event: KeyboardEvent) => pressed.push(event)
    globalThis.addEventListener('keydown', keep, true)
    function Tip({ open }: Readonly<{ open: boolean }>) {
      useTopmostEscape(open)
      return <button type='button'>Prone</button>
    }
    const { rerender } = render(
      <Modal open onClose={jest.fn()} title='Starry Wisp'>
        <Tip open />
      </Modal>,
    )
    screen.getByRole('button', { name: 'Prone' }).focus()

    await user.keyboard('{Escape}')
    expect(pressed.at(-1)?.defaultPrevented).toBe(true)

    rerender(
      <Modal open onClose={jest.fn()} title='Starry Wisp'>
        <Tip open={false} />
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(pressed.at(-1)?.defaultPrevented).toBe(false)
    // Other keys are never cancelled.
    rerender(
      <Modal open onClose={jest.fn()} title='Starry Wisp'>
        <Tip open />
      </Modal>,
    )
    await user.keyboard('{Enter}')
    expect(pressed.at(-1)).toMatchObject({
      key: 'Enter',
      defaultPrevented: false,
    })
    globalThis.removeEventListener('keydown', keep, true)
  })

  it('has menus and tooltips opened inside it open inside it, as the page behind is inert', () => {
    const roots: (HTMLElement | null | undefined)[] = []
    function Opener() {
      roots.push(usePortalRoot())
      return <p>Opener</p>
    }
    render(
      <>
        <Opener />
        <Modal open onClose={jest.fn()} title='Starry Wisp'>
          <Opener />
        </Modal>
        <SidePanel open onClose={jest.fn()} title='Conditions'>
          <Opener />
        </SidePanel>
      </>,
    )

    // Outside any dialog, the page; inside each, its dialog, once it's there.
    expect(roots[0]).toBeUndefined()
    expect(roots.at(-2)).toBe(
      screen.getByRole('dialog', { name: 'Starry Wisp' }),
    )
    expect(roots.at(-1)).toBe(
      screen.getByRole('dialog', { name: 'Conditions' }),
    )
    expect(screen.getByRole('dialog', { name: 'Starry Wisp' })).toHaveClass(
      'overflow-visible',
    )
  })
})
