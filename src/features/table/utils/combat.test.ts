import { hpBar } from './combat'

describe('features/table/utils/combat', () => {
  describe('hpBar', () => {
    it.each([
      ['a living sliver', { value: 1, max: 250, temp: 0 }, 1, 'bg-warning'],
      ['down at none', { value: 0, max: 250, temp: 0 }, 0, 'bg-danger'],
    ])('draws %s', (_, hp, percent, bar) => {
      expect(hpBar(hp)).toEqual({ percent, bar })
    })
  })
})
