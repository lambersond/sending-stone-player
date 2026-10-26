import { render, screen, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SiteFooter } from './site-footer'
import { ISSUE_FORMS } from '@/constants/links'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

const renderAt = (pathname: string) => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  return render(<SiteFooter />)
}

describe('components/site-footer (round 0.39.0)', () => {
  it.each(['/', '/characters', '/campaigns', '/join/x'])(
    'is the page’s footer on %s, its nav named Help holding the two links',
    pathname => {
      renderAt(pathname)
      const footer = screen.getByRole('contentinfo')
      expect(footer).toHaveClass('border-t', 'text-xs')
      const nav = within(footer).getByRole('navigation', { name: 'Help' })
      expect(nav).toHaveClass('mx-auto', 'max-w-[70rem]', 'px-4')
      expect(
        within(nav)
          .getAllByRole('link')
          .map(link => link.getAttribute('href')),
      ).toEqual([ISSUE_FORMS.bug, ISSUE_FORMS.feature])
      // Side by side, wrapping on a narrow phone.
      expect(within(nav).getByRole('list')).toHaveClass('flex-wrap')
    },
  )

  it.each([
    '/characters/abc',
    '/campaigns/c1/characters/thorin',
    '/characters/abc/party/company',
    '/campaigns/c1/party/company',
  ])(
    "has none on a character's or party's page, %s, as the header",
    pathname => {
      const { container } = renderAt(pathname)
      expect(container).toBeEmptyDOMElement()
    },
  )
})
