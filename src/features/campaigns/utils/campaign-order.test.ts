import {
  attentionOf,
  campaignFlag,
  initialsOf,
  seatsOf,
  sortCampaigns,
} from './campaign-order'
import type { CampaignRefusal, OwnedCampaign } from '@/types/campaign'

const NOW = Date.parse('2026-10-28T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

/** A refusal Foundry hasn't got past since, for this reason. */
const refused = (
  reason: CampaignRefusal['reason'] = 'wrongSecret',
  current = true,
): CampaignRefusal => ({
  reason,
  status: reason === 'malformed' ? 400 : 401,
  at: ago(60_000),
  current,
})

/** A campaign as the page sorts it: connected and heard as given, in the database's order. */
const listed = (
  id: string,
  fields: Partial<
    Pick<OwnedCampaign, 'refusal' | 'connected' | 'lastSeenAt'>
  > = {},
) => ({ id, connected: true, ...fields })

/** The campaigns' ids in the page's order, as of now. */
const order = (campaigns: ReturnType<typeof listed>[]) =>
  sortCampaigns(campaigns, NOW).map(({ id }) => id)

/** One of a campaign's characters, chosen by this player, or by none. */
const character = (name: string, player?: string) => ({
  id: name.toLowerCase(),
  name,
  ...(player && { player }),
})

describe('utils/campaign-order, the campaign page (v0.39)', () => {
  describe('attentionOf', () => {
    it('needs the Gamemaster for a current refusal, of any reason, or a first connection', () => {
      expect(attentionOf(listed('a', { refusal: refused() }))).toBe('refused')
      expect(attentionOf(listed('a', { refusal: refused('malformed') }))).toBe(
        'refused',
      )
      expect(attentionOf(listed('a', { connected: false }))).toBe('waiting')
      expect(attentionOf(listed('a'))).toBeNull()
    })

    it('counts a campaign waiting with a current refusal, as one titled wrong, as refused', () => {
      expect(
        attentionOf(
          listed('a', { connected: false, refusal: refused('notSetUp') }),
        ),
      ).toBe('refused')
    })

    it('never counts a refusal shown muted as past', () => {
      expect(
        attentionOf(listed('a', { refusal: refused('wrongSecret', false) })),
      ).toBeNull()
      expect(
        attentionOf(
          listed('a', {
            connected: false,
            refusal: refused('notSetUp', false),
          }),
        ),
      ).toBe('waiting')
    })
  })

  describe('sortCampaigns', () => {
    it('puts refused before waiting, before live, before offline', () => {
      expect(
        order([
          listed('offline', { lastSeenAt: ago(3_600_000) }),
          listed('live', { lastSeenAt: ago(5000) }),
          listed('waiting', { connected: false }),
          listed('refused', { refusal: refused(), lastSeenAt: ago(7_200_000) }),
        ]),
      ).toEqual(['refused', 'waiting', 'live', 'offline'])
    })

    it('puts a live one, heard within two minutes of now, before one heard just before that', () => {
      expect(
        order([
          // Heard two minutes ago: no longer live.
          listed('quiet', { lastSeenAt: ago(120_000) }),
          listed('live', { lastSeenAt: ago(119_000) }),
        ]),
      ).toEqual(['live', 'quiet'])
    })

    it('puts the newest heard first, and those never heard last', () => {
      expect(
        order([
          listed('never'),
          listed('last week', { lastSeenAt: ago(7 * 86_400_000) }),
          listed('yesterday', { lastSeenAt: ago(86_400_000) }),
          listed('an hour ago', { lastSeenAt: ago(3_600_000) }),
        ]),
      ).toEqual(['an hour ago', 'yesterday', 'last week', 'never'])
    })

    it('keeps the database’s order, by title then when set up, where nothing else tells them apart', () => {
      const heard = ago(3_600_000)
      expect(
        order([
          listed('b', { lastSeenAt: heard }),
          listed('a', { lastSeenAt: heard }),
          listed('c', { lastSeenAt: heard }),
          listed('w2', { connected: false }),
          listed('w1', { connected: false }),
          listed('n2'),
          listed('n1'),
        ]),
      ).toEqual(['w2', 'w1', 'b', 'a', 'c', 'n2', 'n1'])
    })

    it('orders those that need the Gamemaster among themselves by when last heard too', () => {
      expect(
        order([
          listed('older', { refusal: refused(), lastSeenAt: ago(86_400_000) }),
          listed('newer', { refusal: refused(), lastSeenAt: ago(3_600_000) }),
          listed('never', { refusal: refused('notSetUp'), connected: false }),
        ]),
      ).toEqual(['newer', 'older', 'never'])
    })

    it('never counts a past refusal: such a campaign sorts by when it was heard', () => {
      expect(
        order([
          listed('heard', { lastSeenAt: ago(60_000) }),
          listed('past', {
            refusal: refused('wrongSecret', false),
            lastSeenAt: ago(3_600_000),
          }),
        ]),
      ).toEqual(['heard', 'past'])
    })

    it('a waiting campaign with a current refusal is refused, before every waiting one', () => {
      expect(
        order([
          listed('waiting', { connected: false }),
          listed('titled wrong', {
            connected: false,
            refusal: refused('notSetUp'),
          }),
        ]),
      ).toEqual(['titled wrong', 'waiting'])
    })

    it('leaves the list it was given as it was', () => {
      const campaigns = [listed('b'), listed('a', { connected: false })]
      sortCampaigns(campaigns, NOW)
      expect(campaigns.map(({ id }) => id)).toEqual(['b', 'a'])
    })
  })

  describe('campaignFlag', () => {
    it.each([
      ['wrongSecret', 'Foundry’s posts refused: wrong secret'],
      ['notSetUp', 'Foundry’s posts refused: title doesn’t match'],
      ['malformed', 'Foundry’s posts refused: couldn’t read them'],
    ] as [CampaignRefusal['reason'], string][])(
      'flags a current %s refusal in its own words',
      (reason, text) => {
        expect(campaignFlag(listed('a', { refusal: refused(reason) }))).toEqual(
          { attention: 'refused', text },
        )
      },
    )

    it('flags a first connection to make, and nothing where nothing is needed', () => {
      expect(campaignFlag(listed('a', { connected: false }))).toEqual({
        attention: 'waiting',
        text: 'Connect Foundry to start',
      })
      expect(campaignFlag(listed('a'))).toBeUndefined()
      expect(
        campaignFlag(listed('a', { refusal: refused('wrongSecret', false) })),
      ).toBeUndefined()
    })
  })

  describe('initialsOf', () => {
    it.each([
      ['Alice', 'A'],
      ['alice smith', 'AS'],
      ['Mary Jane Watson', 'MJ'],
      ['  Bob   Brown ', 'BB'],
      ['Éowyn of Rohan', 'ÉO'],
      ['', ''],
    ])('draws %j as %j', (name, letters) => {
      expect(initialsOf(name)).toBe(letters)
    })
  })

  describe('seatsOf', () => {
    it('draws each chosen character’s player as two letters, and those not chosen as none', () => {
      expect(
        seatsOf({
          characters: [
            character('Thorin', 'Alice Smith'),
            character('Vex'),
            character('Balin', 'Bob'),
          ],
        }),
      ).toEqual({
        shown: [
          { character: 'Thorin', player: 'Alice Smith', initials: 'AS' },
          { character: 'Vex' },
          { character: 'Balin', player: 'Bob', initials: 'B' },
        ],
        chosen: 2,
        total: 3,
      })
    })

    it('shows five seats at most, counting every character', () => {
      const seats = seatsOf({
        characters: [
          character('A', 'Ann'),
          character('B', 'Ben'),
          character('C'),
          character('D', 'Dee'),
          character('E', 'Eve'),
          character('F', 'Fay'),
          character('G'),
        ],
      })
      expect(seats.shown.map(({ character }) => character)).toEqual([
        'A',
        'B',
        'C',
        'D',
        'E',
      ])
      expect(seats).toMatchObject({ chosen: 5, total: 7 })
    })

    it('has none for a campaign without characters', () => {
      expect(seatsOf({ characters: [] })).toEqual({
        shown: [],
        chosen: 0,
        total: 0,
      })
    })
  })
})
