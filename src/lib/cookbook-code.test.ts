import {
  generateCookbookCode,
  hashCookbookCode,
  isCookbookCode,
} from './cookbook-code'
import { COOKBOOK_CODE } from '@/constants/cookbook'

const EXAMPLE = 'sscb_1gT6dhjwOQSMNgkDXiyDOPt2ltW_RKU4XDAdTsRU2d4'

describe('link codes', () => {
  it('makes a 48-character code of the shape this app and the cookbook take', () => {
    const code = generateCookbookCode()
    expect(code).toHaveLength(48)
    expect(code).toMatch(COOKBOOK_CODE)
    // The cookbook stores a trimmed code of [A-Za-z0-9_.~-].
    expect(code).toMatch(/^[\w.~-]+$/)
    expect(generateCookbookCode()).not.toBe(code)
  })

  it('takes the example and refuses what no code is', () => {
    expect(isCookbookCode(EXAMPLE)).toBe(true)
    // eslint-disable-next-line unicorn/no-useless-undefined -- no code at all
    expect(isCookbookCode(undefined)).toBe(false)
    expect(isCookbookCode('x')).toBe(false)
    expect(isCookbookCode(EXAMPLE.slice(0, -1))).toBe(false)
    expect(isCookbookCode(`${EXAMPLE.slice(0, -1)}+`)).toBe(false)
    expect(isCookbookCode(`${EXAMPLE.slice(0, -1)}/`)).toBe(false)
  })

  it('keeps a stable SHA-256 of a code, as 64 hex digits', () => {
    const hash = hashCookbookCode(EXAMPLE)
    expect(hash).toMatch(/^[\da-f]{64}$/)
    expect(hashCookbookCode(EXAMPLE)).toBe(hash)
    expect(hashCookbookCode(generateCookbookCode())).not.toBe(hash)
  })
})
