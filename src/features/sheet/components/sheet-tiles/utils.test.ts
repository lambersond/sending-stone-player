import { initials } from './utils'

describe('features/sheet/components/sheet-tiles/utils', () => {
  it('keeps a first letter beyond one UTF-16 unit whole, as an emoji', () => {
    expect(initials('🐉 Ember')).toBe('🐉E')
  })
})
