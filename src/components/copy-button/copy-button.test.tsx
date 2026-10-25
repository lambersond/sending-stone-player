import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyField } from './copy-button'

const url = 'https://stone.example/join/abc'

describe('components/copy-button', () => {
  it('copies the value', async () => {
    const user = userEvent.setup()
    const writeText = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    render(<CopyField value={url} label='invite link' />)

    expect(screen.getByText(url)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))

    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('leaves the value to copy by hand when the clipboard refuses', async () => {
    const user = userEvent.setup()
    jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('denied'))
    render(<CopyField value={url} label='invite link' />)

    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))

    expect(
      screen.getByRole('button', { name: 'Copy invite link' }),
    ).toBeInTheDocument()
  })

  it('cuts the value to one line', () => {
    render(<CopyField value={url} label='invite link' />)

    const code = screen.getByText(url)
    expect(code).toHaveClass('truncate')
    expect(code).not.toHaveClass('break-all', 'select-all')
    expect(
      screen.getByRole('button', { name: 'Copy invite link' }),
    ).not.toHaveClass('min-h-11')
  })

  it('shows the whole value over as many lines as it takes, to select by hand, with a button easy to tap, where it wraps (round 0.38.0)', () => {
    const code = 'sscb_1gT6dhjwOQSMNgkDXiyDOPt2ltW_RKU4XDAdTsRU2d4'
    render(<CopyField value={code} label='link code' wrap />)

    const shown = screen.getByText(code)
    expect(shown.tagName).toBe('CODE')
    expect(shown).toHaveClass(
      'min-w-0',
      'flex-1',
      'font-mono',
      'text-xs',
      'break-all',
      'select-all',
    )
    expect(shown).not.toHaveClass('truncate')
    expect(screen.getByRole('button', { name: 'Copy link code' })).toHaveClass(
      'min-h-11',
      'min-w-11',
    )
  })
})
