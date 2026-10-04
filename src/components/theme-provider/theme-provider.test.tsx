import { render, screen } from '@testing-library/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ThemeProvider } from './theme-provider'

jest.mock('next-themes', () => ({
  ThemeProvider: jest.fn(({ children }) => children),
}))

describe('components/theme-provider', () => {
  it('follows the device until a theme is chosen, using a class on <html>', () => {
    render(
      <ThemeProvider>
        <p>page</p>
      </ThemeProvider>,
    )

    expect(screen.getByText('page')).toBeInTheDocument()
    expect(jest.mocked(NextThemesProvider).mock.calls[0][0]).toMatchObject({
      attribute: 'class',
      defaultTheme: 'system',
      enableSystem: true,
    })
  })
})
