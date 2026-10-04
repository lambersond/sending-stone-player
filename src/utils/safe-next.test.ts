import { safeNextPath } from './safe-next'

describe('utils/safe-next', () => {
  it.each(['/characters', '/join/abc', '/join/abc?x=1#y'])(
    'keeps a path on this site: %s',
    path => {
      expect(safeNextPath(path)).toBe(path)
    },
  )

  it.each([
    ['another site', 'https://evil.example'],
    ['a scheme-relative address', '//evil.example'],
    ['a backslash trick', String.raw`/\evil.example`],
    ['whitespace', '/ evil'],
    ['a relative path', 'characters'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['nothing', undefined],
    ['a repeated parameter', ['/a', '/b']],
  ])('refuses %s', (_, value) => {
    expect(safeNextPath(value)).toBeUndefined()
  })
})
