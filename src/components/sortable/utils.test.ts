import { movedTo } from './utils'

describe('movedTo', () => {
  it('says where a row is now, from 1', () => {
    expect(movedTo('Wolves', 3, 7)).toBe('Wolves, now 3 of 7.')
  })
})
