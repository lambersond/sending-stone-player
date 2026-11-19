import { tabStep } from './tab-keys'

describe('utils/tab-keys', () => {
  it.each([
    ['ArrowRight', 0, 3, 1],
    ['ArrowRight', 2, 3, 0],
    ['ArrowLeft', 1, 3, 0],
    ['ArrowLeft', 0, 3, 2],
    ['Home', 2, 3, 0],
    ['End', 0, 3, 2],
    ['Enter', 1, 3, undefined],
    ['ArrowDown', 1, 3, undefined],
  ])('%s from %p of %p goes to %p', (key, at, count, next) => {
    expect(tabStep(key, at, count)).toBe(next)
  })
})
