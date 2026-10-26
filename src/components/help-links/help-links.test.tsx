import { render, screen, within } from '@testing-library/react'
import { HelpLinks } from './help-links'
import { ISSUE_FORMS } from '@/constants/links'

describe('components/help-links (round 0.39.0)', () => {
  it('links to the app’s own bug and feature forms, each in a new tab, its name saying so', () => {
    render(<HelpLinks />)
    const links = within(screen.getByRole('list')).getAllByRole('link')
    expect(
      links.map(link => [
        link.textContent,
        link.getAttribute('href'),
        link.getAttribute('target'),
      ]),
    ).toEqual([
      ['Report a bug (opens in a new tab)', ISSUE_FORMS.bug, '_blank'],
      ['Request a feature (opens in a new tab)', ISSUE_FORMS.feature, '_blank'],
    ])
    expect(ISSUE_FORMS).toEqual({
      bug: 'https://github.com/lambersond/sending-stone-player/issues/new?template=bug_report.yml',
      feature:
        'https://github.com/lambersond/sending-stone-player/issues/new?template=feature_request.yml',
    })
    for (const link of links) {
      // The page opened never reaches back to this one, nor learns where it was opened from.
      expect(link.getAttribute('rel')?.split(' ')).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer']),
      )
      expect(link).toHaveClass('min-h-11')
      // Its icon is no part of its name.
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
    expect(
      screen.getByRole('link', { name: 'Report a bug (opens in a new tab)' }),
    ).toBeInTheDocument()
    // Said to screen readers alone.
    expect(
      screen
        .getAllByText('(opens in a new tab)', { exact: false })
        .map(span => span.className),
    ).toEqual(['sr-only', 'sr-only'])
  })

  it('lays them out one under the other, or side by side and wrapping where inline', () => {
    const { rerender } = render(<HelpLinks />)
    expect(screen.getByRole('list')).toHaveClass('flex-col')
    rerender(<HelpLinks inline />)
    expect(screen.getByRole('list')).toHaveClass('flex-wrap', 'justify-center')
    expect(screen.getByRole('list')).not.toHaveClass('flex-col')
  })
})
