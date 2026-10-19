import { isTablePage, TABLE_PAGES } from './table-pages'

describe('utils/table-pages', () => {
  it.each([
    '/characters/abc',
    '/characters/abc/',
    '/characters/abc/party/company',
    '/characters/abc/party/company/',
    '/campaigns/c1/characters/thorin',
    '/campaigns/c1/characters/thorin/',
    '/campaigns/c1/party/company',
    '/campaigns/c1/party/company/',
  ])('takes %s as a page a game fills', pathname => {
    expect(isTablePage(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/characters',
    '/characters/',
    '/campaigns',
    '/campaigns/c1',
    '/campaigns/c1/characters',
    '/characters/x/party',
    '/characters/x/party/',
    '/characters/x/party/y/z',
    '/campaigns/c1/party',
    '/campaigns/c1/party/y/z',
    '/join/x',
  ])('takes %s as none', pathname => {
    expect(isTablePage(pathname)).toBe(false)
  })

  it('names the four pages', () => {
    expect(TABLE_PAGES).toHaveLength(4)
  })
})
