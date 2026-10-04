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
})
