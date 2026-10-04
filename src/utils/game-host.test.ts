import { gameHost } from './game-host'

describe('utils/game-host', () => {
  it('shows the host of a game URL', () => {
    expect(gameHost('https://my-game.forge-vtt.com')).toBe(
      'my-game.forge-vtt.com',
    )
  })

  it('falls back to the value when it is not a URL', () => {
    expect(gameHost('not a url')).toBe('not a url')
  })
})
