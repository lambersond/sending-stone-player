import {
  campaignSetupSchema,
  campaignTitleSchema,
  secretSchema,
  toForgeGameUrl,
  toInviteCode,
} from './campaign'

describe('schemas/campaign', () => {
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

  describe('secretSchema', () => {
    it('trims a secret and asks for a long one', () => {
      expect(secretSchema.parse('  hunter2-hunter2 ')).toBe('hunter2-hunter2')
      expect(secretSchema.safeParse('short').error?.issues[0].message).toBe(
        'Use a secret of at least 12 characters.',
      )
      expect(
        secretSchema.safeParse('a'.repeat(201)).error?.issues[0].message,
      ).toBe('Keep the secret to 200 characters or fewer.')
      expect(secretSchema.safeParse(7).error?.issues[0].message).toBe(
        'Enter a secret.',
      )
    })
  })

  describe('campaignSetupSchema', () => {
    it("trims the title and secret and normalizes the game's address", () => {
      expect(
        campaignSetupSchema.parse({
          title: ' The Lonely Mountain ',
          gameUrl: ' my-game.forge-vtt.com/game ',
          secret: ' hunter2-hunter2 ',
        }),
      ).toEqual({
        title: 'The Lonely Mountain',
        gameUrl: 'https://my-game.forge-vtt.com',
        secret: 'hunter2-hunter2',
      })
    })

    it('says what is missing or wrong with each field', () => {
      const result = campaignSetupSchema.safeParse({
        title: ' ',
        gameUrl: 'https://example.com',
        secret: '',
      })

      expect(
        result.error?.issues.map(({ path, message }) => [path[0], message]),
      ).toEqual([
        ['title', "Enter the campaign's title."],
        [
          'gameUrl',
          "Use your game's Forge address, like https://my-game.forge-vtt.com.",
        ],
        ['secret', 'Use a secret of at least 12 characters.'],
      ])
      expect(
        campaignSetupSchema.safeParse({ title: 'x', gameUrl: '', secret: 'y' })
          .error?.issues[0].message,
      ).toBe("Enter your game's Forge address.")
    })
  })

  describe('toInviteCode', () => {
    it.each([
      ['a link', 'https://stone.example/join/AbCdEfGh_-123456'],
      [
        'a link with a trailing slash',
        'https://stone.example/join/AbCdEfGh_-123456/',
      ],
      ['a path', ' /join/AbCdEfGh_-123456?utm=1 '],
      ['the code alone', 'AbCdEfGh_-123456'],
    ])('reads the code from %s', (_, value) => {
      expect(toInviteCode(value)).toBe('AbCdEfGh_-123456')
    })

    it.each([
      ['another page', 'https://stone.example/characters'],
      ['a short code', 'https://stone.example/join/abc'],
      ['nonsense', 'hello there'],
    ])('reads nothing from %s', (_, value) => {
      expect(toInviteCode(value)).toBeUndefined()
    })
  })
})
