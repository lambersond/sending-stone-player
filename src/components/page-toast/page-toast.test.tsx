import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageToasts, TOAST_FOR, useToast } from './page-toast'

/** Buttons that toast, each as told. */
function Toaster() {
  const toast = useToast()
  return (
    <>
      <button type='button' onClick={() => toast('A new invite link is ready')}>
        Reset
      </button>
      <button
        type='button'
        onClick={() => toast('Invite link copied', { announce: false })}
      >
        Copy
      </button>
    </>
  )
}

/** The pill on screen, if one shows. */
const pill = () =>
  document.querySelector<HTMLElement>('[data-page-toast]') ?? undefined

describe('components/page-toast', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('shows a toast for a moment, and says it through the one status region the page keeps', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <PageToasts>
        <Toaster />
      </PageToasts>,
    )
    // One region, there before any toast, so a screen reader is told what changes in it.
    const region = screen.getByRole('status')
    expect(region).toHaveClass('sr-only')
    expect(region).toBeEmptyDOMElement()
    expect(pill()).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getAllByRole('status')).toEqual([region])
    expect(region).toHaveTextContent(/^A new invite link is ready$/)
    // The pill is for the eye: the region says it.
    expect(pill()).toHaveTextContent('A new invite link is ready')
    expect(pill()).toHaveAttribute('aria-hidden', 'true')
    expect(pill()).toHaveClass('fixed', 'bottom-5', 'left-1/2', 'z-40')

    act(() => jest.advanceTimersByTime(TOAST_FOR - 1))
    expect(pill()).toBeDefined()
    act(() => jest.advanceTimersByTime(1))
    expect(pill()).toBeUndefined()
    // Emptied as it goes, so the same words again are told again.
    expect(region).toBeEmptyDOMElement()
    expect(TOAST_FOR).toBe(1800)
  })

  it('leaves the status region as it was for a toast not to be announced, which still shows', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <PageToasts>
        <Toaster />
      </PageToasts>,
    )
    const region = screen.getByRole('status')

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(pill()).toHaveTextContent('Invite link copied')
    expect(region).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(pill()).toHaveTextContent('Invite link copied')
    expect(region).toHaveTextContent(/^A new invite link is ready$/)
  })

  it('shows each toast its full time, the latest in place of the one before', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <PageToasts>
        <Toaster />
      </PageToasts>,
    )

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    act(() => jest.advanceTimersByTime(TOAST_FOR - 100))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    act(() => jest.advanceTimersByTime(TOAST_FOR - 100))
    expect(pill()).toHaveTextContent('A new invite link is ready')
    expect(document.querySelectorAll('[data-page-toast]')).toHaveLength(1)
  })

  it('toasts nothing outside a page that shows them', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<Toaster />)

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(pill()).toBeUndefined()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
