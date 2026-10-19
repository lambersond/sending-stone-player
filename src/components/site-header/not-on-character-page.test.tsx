import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { NotOnCharacterPage } from './not-on-character-page'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

const renderAt = (pathname: string) => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  return render(
    <NotOnCharacterPage>
      <header>App bar</header>
    </NotOnCharacterPage>,
  )
}

describe('components/site-header/not-on-character-page', () => {
  it.each([
    '/',
    '/characters',
    '/characters/',
    '/campaigns',
    '/campaigns/c1',
    '/campaigns/c1/characters',
    '/characters/abc/party',
    '/join/x',
  ])('shows what it holds on %s', pathname => {
    renderAt(pathname)

    expect(screen.getByRole('banner')).toHaveTextContent('App bar')
  })

  it.each([
    '/characters/abc',
    '/characters/abc/',
    // The Gamemaster at one of their campaign's characters' sheets (#156).
    '/campaigns/c1/characters/thorin',
    '/campaigns/c1/characters/thorin/',
    // A party's sheet, as its player or its Gamemaster sees it (module 0.30.0).
    '/characters/abc/party/company',
    '/campaigns/c1/party/company',
  ])("hides it on a character's page, %s", pathname => {
    const { container } = renderAt(pathname)

    expect(container).toBeEmptyDOMElement()
  })
})
