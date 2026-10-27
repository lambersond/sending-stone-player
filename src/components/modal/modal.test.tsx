import { useRef } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'
import { Modal } from './modal'
import { usePortalRoot, useTopmostEscape } from './portal-root'
import { SidePanel } from '@/components/side-panel'

/** A dialog as a browser shows it, which jsdom's doesn't: its first control focused. */
class FocusingDialog extends HTMLDialogElement {
  override showModal() {
    this.open = true
    this.querySelector('button')?.focus()
  }
}

/** A dialog as a browser closes it, which jsdom's stand-in doesn't: its close event only after. */
class LaterClosingDialog extends HTMLDialogElement {
  override close() {
    if (!this.open) return
    this.open = false
    setTimeout(() => this.dispatchEvent(new Event('close')))
  }
}

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

  it('closes only for its own close, not one of a dialog opened inside it, which React hands it too', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    render(
      <Modal open onClose={outer} title='Starry Wisp'>
        <Modal open onClose={inner} title='Modify damage'>
          <p>Dice</p>
        </Modal>
      </Modal>,
    )

    // The browser closes the inner one on Escape, firing close at it alone.
    fireEvent(
      screen.getByRole('dialog', { name: 'Modify damage' }),
      new Event('close'),
    )
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    fireEvent(
      screen.getByRole('dialog', { name: 'Starry Wisp' }),
      new Event('close'),
    )
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('tells its owner nothing of a close it asked for, which a browser fires only after, and still of Escape (round 0.40.0 e2e)', async () => {
    // As a browser closes a dialog, which jsdom's stand-in doesn't: its close event after, as a
    // task of its own, by when its owner may have moved focus elsewhere.
    const close = jest
      .spyOn(HTMLDialogElement.prototype, 'close')
      .mockImplementation(LaterClosingDialog.prototype.close)
    const fired = async () =>
      act(async () => {
        await new Promise(resolve => setTimeout(resolve))
      })
    const onClose = jest.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} title='Wild Shape'>
        <p>Forms</p>
      </Modal>,
    )
    const dialog = document.querySelector('dialog') as HTMLDialogElement

    rerender(
      <Modal open={false} onClose={onClose} title='Wild Shape'>
        <p>Forms</p>
      </Modal>,
    )
    await fired()
    expect(dialog.open).toBe(false)
    expect(onClose).not.toHaveBeenCalled()

    // Open again, the browser closes it itself on Escape: its owner is told, once.
    rerender(
      <Modal open onClose={onClose} title='Wild Shape'>
        <p>Forms</p>
      </Modal>,
    )
    act(() => dialog.close())
    await fired()
    expect(onClose).toHaveBeenCalledTimes(1)
    close.mockRestore()
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

  it('is as wide as a phone’s screen only where it asks to be, and leaves a gutter otherwise', () => {
    const { rerender } = render(
      <Modal open onClose={jest.fn()} title='Help'>
        <p>Steps</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Help' })
    expect(dialog).toHaveClass('w-[calc(100%-2rem)]', 'max-w-lg', 'rounded-2xl')
    expect(dialog.className).not.toMatch(/max-sm:/)

    rerender(
      <Modal open onClose={jest.fn()} title='Help' fullOnPhone>
        <p>Steps</p>
      </Modal>,
    )
    expect(dialog).toHaveClass(
      'max-sm:w-full',
      'max-sm:max-w-none',
      'max-sm:rounded-none',
      'max-sm:border-x-0',
      // Above a phone, as any other.
      'w-[calc(100%-2rem)]',
      'max-w-lg',
      'rounded-2xl',
    )
  })

  it('gives focus to what it is told to as it opens, after the browser has focused its first control (round 0.39.0)', () => {
    function Asking({ open }: Readonly<{ open: boolean }>) {
      const keep = useRef<HTMLButtonElement>(null)
      return (
        <Modal
          open={open}
          onClose={jest.fn()}
          title='Delete Thorin?'
          initialFocus={keep}
        >
          <button type='button'>Delete</button>
          <button ref={keep} type='button'>
            Keep
          </button>
        </Modal>
      )
    }
    // As a browser's showModal() does, which jsdom's doesn't: the first control, Close, focused.
    const showModal = jest
      .spyOn(HTMLDialogElement.prototype, 'showModal')
      .mockImplementation(FocusingDialog.prototype.showModal)
    const { rerender } = render(<Asking open={false} />)
    expect(document.body).toHaveFocus()

    rerender(<Asking open />)
    const dialog = screen.getByRole('dialog', { name: 'Delete Thorin?' })
    expect(showModal).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    showModal.mockRestore()
  })
})

describe('components/modal, as a sheet with a footer and a Back (round 0.40.0)', () => {
  it('rises from the bottom of a phone’s screen as a sheet, and is a centred dialog up to 640 pixels wide from sm', () => {
    render(
      <Modal open onClose={jest.fn()} title='Wild Shape' placement='sheet'>
        <p>Forms</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Wild Shape' })

    expect(dialog).toHaveClass(
      'open:flex',
      'open:flex-col',
      'max-sm:mt-auto',
      'max-sm:mb-0',
      'max-sm:max-h-[92dvh]',
      'max-sm:w-full',
      'max-sm:max-w-none',
      'max-sm:rounded-t-[20px]',
      'max-sm:rounded-b-none',
      'sm:m-auto',
      'sm:max-w-160',
      'sm:rounded-2xl',
    )
    // Not the centred dialog's, which would hold it in the middle of a phone's screen.
    expect(dialog).not.toHaveClass('m-auto', 'max-w-lg')
    // Its content scrolls between its header and whatever is under it.
    const body = screen.getByText('Forms').parentElement as HTMLElement
    expect(body).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1')
    expect(body).not.toHaveClass('max-h-[calc(100dvh-9rem)]')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveClass(
      'min-h-11',
      'min-w-11',
    )
  })

  it('keeps its footer under its content, outside what scrolls', () => {
    render(
      <Modal
        open
        onClose={jest.fn()}
        title='Wild Shape'
        placement='sheet'
        footer={<button type='button'>Become a Wolf</button>}
      >
        <p>Forms</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Wild Shape' })
    const body = screen.getByText('Forms').parentElement as HTMLElement
    const footer = dialog.querySelector('footer') as HTMLElement

    expect(footer).toContainElement(
      within(dialog).getByRole('button', { name: 'Become a Wolf' }),
    )
    expect(body).not.toContainElement(footer)
    expect(body.nextElementSibling).toBe(footer)
    expect(footer).toHaveClass('shrink-0', 'border-t')
  })

  it('offers its Back before its title, named for where it goes, and goes there on a click', async () => {
    const user = userEvent.setup()
    const back = jest.fn()
    const onClose = jest.fn()
    render(
      <Modal
        open
        onClose={onClose}
        title='Known forms'
        placement='sheet'
        back={{ label: 'Back to Wild Shape', onClick: back }}
      >
        <p>Forms</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Known forms' })
    const button = within(dialog).getByRole('button', {
      name: 'Back to Wild Shape',
    })

    expect(button).toHaveTextContent('Back')
    const header = dialog.querySelector('header') as HTMLElement
    expect(header.firstElementChild).toBe(button)
    expect(
      button.compareDocumentPosition(
        within(dialog).getByRole('heading', { name: 'Known forms' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(button)
    expect(back).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('is as ever centred, with no footer or Back unless given them', () => {
    render(
      <Modal open onClose={jest.fn()} title='Help'>
        <p>Steps</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Help' })

    expect(dialog).toHaveClass('m-auto', 'max-w-lg', 'rounded-2xl')
    expect(dialog.className).not.toMatch(/open:flex|max-sm:|sm:max-w-160/)
    expect(dialog.querySelector('footer')).toBeNull()
    expect(within(dialog).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Steps').parentElement).toHaveClass(
      'overflow-y-auto',
      'max-h-[calc(100dvh-9rem)]',
    )
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
