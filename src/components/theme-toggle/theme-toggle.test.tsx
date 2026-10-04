import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from 'next-themes'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from './theme-toggle'

jest.mock('next-themes', () => ({ useTheme: jest.fn() }))

const setTheme = jest.fn()

describe('components/theme-toggle', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      theme: 'system',
      setTheme,
      themes: [],
    })
  })

  it('shows the chosen theme', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeChecked()
  })

  it('switches theme', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('shows no choice when rendered on the server', () => {
    const html = renderToString(<ThemeToggle />)

    expect(html).not.toContain('aria-checked="true"')
    expect(html.match(/aria-checked="false"/g)).toHaveLength(3)
  })
})
