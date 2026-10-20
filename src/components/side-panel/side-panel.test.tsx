import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Link from 'next/link'
import { SidePanel } from './side-panel'
import { Modal } from '@/components/modal'

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

  it('shows its actions beside the Close button, only while open', () => {
    const { rerender } = render(
      <SidePanel
        open
        onClose={jest.fn()}
        title='The Company'
        actions={<Link href='/characters/c/party/company'>Open as page</Link>}
      >
        <p>Members</p>
      </SidePanel>,
    )

    const dialog = screen.getByRole('dialog', { name: 'The Company' })
    const link = within(dialog).getByRole('link', { name: 'Open as page' })
    const close = within(dialog).getByRole('button', { name: 'Close' })
    // Between the title and the Close button, in the panel's header.
    expect(link.parentElement?.nextElementSibling).toBe(close)
    expect(link.closest('header')).toContainElement(close)

    rerender(
      <SidePanel
        open={false}
        onClose={jest.fn()}
        title='The Company'
        actions={<Link href='/characters/c/party/company'>Open as page</Link>}
      >
        <p>Members</p>
      </SidePanel>,
    )
    expect(screen.queryByRole('link', { name: 'Open as page' })).toBeNull()
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

  it('closes only for its own close, not one of a dialog opened inside it, which React hands it too', () => {
    const panel = jest.fn()
    const inner = jest.fn()
    render(
      <SidePanel open onClose={panel} title='The Iron Company'>
        <Modal open onClose={inner} title='Take Rope'>
          <p>Rope</p>
        </Modal>
      </SidePanel>,
    )

    // The browser closes the inner one, as on Cancel or Escape, firing close at it alone.
    fireEvent(
      screen.getByRole('dialog', { name: 'Take Rope' }),
      new Event('close'),
    )
    expect(inner).toHaveBeenCalledTimes(1)
    expect(panel).not.toHaveBeenCalled()
    fireEvent(
      screen.getByRole('dialog', { name: 'The Iron Company' }),
      new Event('close'),
    )
    expect(panel).toHaveBeenCalledTimes(1)
  })
})
