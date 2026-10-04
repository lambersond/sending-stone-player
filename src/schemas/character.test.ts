import {
  campaignTitleSchema,
  characterSchema,
  toForgeGameUrl,
} from './character'

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

  describe('campaignTitleSchema', () => {
    it('trims the title', () => {
      expect(campaignTitleSchema.parse('  Curse of Strahd ')).toBe(
        'Curse of Strahd',
      )
    })

    it.each([
      ['blank', ' ', "Enter the campaign's title."],
      ['missing', undefined, "Enter the campaign's title."],
      [
        'too long',
        'a'.repeat(101),
        'Keep the title to 100 characters or fewer.',
      ],
    ])('rejects a title that is %s', (_, value, message) => {
      expect(
        campaignTitleSchema.safeParse(value).error?.issues[0].message,
      ).toBe(message)
    })
  })

  describe('characterSchema', () => {
    const valid = {
      name: 'Thorin',
      campaignTitle: 'The Lonely Mountain',
      gameUrl: 'https://my-game.forge-vtt.com',
    }

    it('trims the name and title and normalizes the game URL', () => {
      expect(
        characterSchema.parse({
          name: '  Thorin  ',
          campaignTitle: ' The Lonely Mountain ',
          gameUrl: ' https://my-game.forge-vtt.com/game ',
        }),
      ).toEqual(valid)
    })

    it('asks for a name, a campaign and an address when they are blank', () => {
      const result = characterSchema.safeParse({
        name: ' ',
        campaignTitle: '',
        gameUrl: '',
      })

      expect(result.success).toBe(false)
      expect(result.error?.issues.map(issue => issue.message)).toEqual([
        'Give your character a name.',
        "Enter the campaign's title.",
        "Enter your game's Forge address.",
      ])
    })

    it('limits the length of the name', () => {
      const result = characterSchema.safeParse({
        ...valid,
        name: 'a'.repeat(101),
      })

      expect(result.error?.issues[0].message).toBe(
        'Keep the name to 100 characters or fewer.',
      )
    })

    it('explains what a Forge game address looks like', () => {
      const result = characterSchema.safeParse({
        ...valid,
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
