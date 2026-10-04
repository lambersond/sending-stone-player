import { characterSchema, toForgeGameUrl } from './character'

describe('schemas/character', () => {
  describe('toForgeGameUrl', () => {
    it.each([
      ['https://my-game.forge-vtt.com', 'https://my-game.forge-vtt.com'],
      ['https://my-game.forge-vtt.com/game', 'https://my-game.forge-vtt.com'],
      [
        'https://My-Game.Forge-VTT.com/join?x=1',
        'https://my-game.forge-vtt.com',
      ],
      ['https://my-game.forge-vtt.com', 'https://my-game.forge-vtt.com'],
      ['my-game.forge-vtt.com/game', 'https://my-game.forge-vtt.com'],
    ])('reduces %s to its game origin', (value, expected) => {
      expect(toForgeGameUrl(value)).toBe(expected)
    })

    it.each([
      [
        'an invitation link on the main site',
        'https://forge-vtt.com/invite/abc',
      ],
      ['the www site', 'https://www.forge-vtt.com'],
      ['a nested subdomain', 'https://a.b.forge-vtt.com'],
      ['a look-alike domain', 'https://my-game.forge-vtt.com.evil.example'],
      ['another site', 'https://example.com'],
      ['a port', 'https://my-game.forge-vtt.com:8443'],
      ['credentials', 'https://user:pass@my-game.forge-vtt.com'],
      ['another scheme', 'ftp://my-game.forge-vtt.com'],
      ['a javascript URL', 'javascript:alert(1)'],
      ['nonsense', 'not a url'],
    ])('rejects %s', (_, value) => {
      expect(toForgeGameUrl(value)).toBeUndefined()
    })
  })

  describe('characterSchema', () => {
    it('trims the name and normalizes the game URL', () => {
      expect(
        characterSchema.parse({
          name: '  Thorin  ',
          gameUrl: ' https://my-game.forge-vtt.com/game ',
        }),
      ).toEqual({ name: 'Thorin', gameUrl: 'https://my-game.forge-vtt.com' })
    })

    it('asks for a name and an address when they are blank', () => {
      const result = characterSchema.safeParse({ name: ' ', gameUrl: '' })

      expect(result.success).toBe(false)
      expect(result.error?.issues.map(issue => issue.message)).toEqual([
        'Give your character a name.',
        "Enter your game's Forge address.",
      ])
    })

    it('limits the length of the name', () => {
      const result = characterSchema.safeParse({
        name: 'a'.repeat(101),
        gameUrl: 'https://my-game.forge-vtt.com',
      })

      expect(result.error?.issues[0].message).toBe(
        'Keep the name to 100 characters or fewer.',
      )
    })

    it('explains what a Forge game address looks like', () => {
      const result = characterSchema.safeParse({
        name: 'Thorin',
        gameUrl: 'https://example.com',
      })

      expect(result.error?.issues[0]).toMatchObject({
        path: ['gameUrl'],
        message:
          "Use your game's Forge address, like https://my-game.forge-vtt.com.",
      })
    })
  })
})
