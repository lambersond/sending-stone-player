import { favoriteReasons } from './favorite-words'

describe('utils/favorite-words, from module 0.37.0', () => {
  it('says why a favorite wasn’t added or removed, where it differs from a roll, as the seat reads it', () => {
    expect(favoriteReasons('player')).toEqual({
      off: 'your Gamemaster’s game isn’t taking favorites now',
      unavailable: 'your Gamemaster’s game isn’t taking favorites now',
      moving: 'it’s on its way already',
      // Module 0.47.0: an order made from favorites Foundry has changed since.
      changed: 'the favorites changed in your Gamemaster’s game meanwhile',
    })
    expect(favoriteReasons('gm').off).toBe(
      'your game isn’t taking favorites now',
    )
  })
})
