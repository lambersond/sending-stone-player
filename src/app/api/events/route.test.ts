/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { z } from 'zod'
import { OPTIONS, POST } from './route'
import { MAX_ENVELOPE_BYTES } from '@/constants/sending-stone'
import { applyCampaignEvent } from '@/db/campaign-events'
import {
  checkGameSecret,
  findEventCampaign,
  markSeen,
  recordRefusal,
} from '@/db/campaigns'
import { recordCommandResult } from '@/db/roll-requests'
import {
  characterSheet,
  chatMessage,
  foundrySettings,
  groupEntry,
  mockJournalUpdated,
  roster,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'

jest.mock('@/db/campaign-events', () => ({ applyCampaignEvent: jest.fn() }))
jest.mock('@/db/campaigns', () => ({
  checkGameSecret: jest.fn(),
  findEventCampaign: jest.fn(),
  markSeen: jest.fn(),
  recordRefusal: jest.fn(),
}))
jest.mock('@/db/roll-requests', () => ({ recordCommandResult: jest.fn() }))
// The real parser, unless a test needs one that fails as no real event can.
jest.mock('@/schemas/sending-stone', () => {
  const actual = jest.requireActual('@/schemas/sending-stone')
  return { ...actual, parseGameEvent: jest.fn(actual.parseGameEvent) }
})

const URL = 'https://player.example/api/events'
const GAME = 'https://my-game.forge-vtt.com'
/** What the app tells the module it does, beyond taking events. */
const FEATURES = {
  commands: true,
  slimSheets: 1,
  maxBytes: 4_000_000,
  midiPrompts: 1,
  groups: 1,
  settings: 1,
  // From module 0.31.0: moves of items and coins.
  transfers: 1,
  // From module 0.33.0: removals of characters' items, fetched for with rolls and moves off.
  removals: 1,
  // From module 0.34.0: journal notes, fetched for with rolls, moves and removals off; 2 from
  // module 0.35.0, as the app reads who changed a journal in Foundry and sends orders of notes.
  notes: 2,
}
const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

/** When the module sent an event, by the game's clock. */
const TIME = '2026-10-04T19:02:00Z'

const envelope = (type: string, data: object, fields: object = {}) => ({
  protocol: 2,
  id: 'ev1',
  session: 's1',
  sequence: 1,
  type,
  time: TIME,
  world,
  campaign,
  data,
  ...fields,
})

const post = (
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  POST(
    new Request(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer hunter2',
        Origin: GAME,
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )

/** A connection test from a module that names the campaign tested. */
const testCampaign = () =>
  post(
    envelope(
      'bridge.ping',
      { userId: 'u-gm', name: 'Gamemaster' },
      { sequence: null },
    ),
  )

const ping = () =>
  envelope(
    'bridge.ping',
    { userId: 'u-gm', name: 'Gamemaster' },
    { sequence: null, campaign: null },
  )

/** A refusal as the module reads it: its status kept, CORS headers, and why, in JSON. */
const expectRefusal = async (
  response: Response,
  status: number,
  body: object,
  origin = GAME,
) => {
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  expect(response.headers.get('access-control-allow-origin')).toBe(origin)
  await expect(response.json()).resolves.toEqual(body)
}

const NOT_SET_UP = {
  reason: 'notSetUp',
  message: `No campaign titled “The Lonely Mountain” is set up for ${GAME} in Sending Stone`,
}
const WRONG_SECRET = {
  reason: 'wrongSecret',
  message: 'The secret isn’t this campaign’s in Sending Stone',
}
const UNAVAILABLE = {
  reason: 'unavailable',
  message: 'Sending Stone couldn’t take this just now',
}
const TOO_LARGE = {
  reason: 'tooLarge',
  message: 'Larger than the 4000000 bytes Sending Stone takes',
  limit: 4_000_000,
}

describe('app/api/events', () => {
  beforeEach(() => {
    jest
      .mocked(findEventCampaign)
      .mockResolvedValue({ id: 'c1', helloSession: 's1' })
    jest.mocked(checkGameSecret).mockResolvedValue('ok')
  })

  describe('OPTIONS', () => {
    it('lets the game page post from its own origin', () => {
      const response = OPTIONS(
        new Request(URL, { method: 'OPTIONS', headers: { Origin: GAME } }),
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'POST, OPTIONS',
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization',
      )
      expect(
        response.headers.get('Access-Control-Allow-Private-Network'),
      ).toBeNull()
    })

    it('allows a public page to reach a private listener when asked', () => {
      const response = OPTIONS(
        new Request(URL, {
          method: 'OPTIONS',
          headers: {
            Origin: GAME,
            'Access-Control-Request-Private-Network': 'true',
          },
        }),
      )

      expect(response.headers.get('Access-Control-Allow-Private-Network')).toBe(
        'true',
      )
    })

    it('allows any origin when none is sent', () => {
      const response = OPTIONS(new Request(URL, { method: 'OPTIONS' }))

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('POST', () => {
    it("applies an event to its campaign, once the secret is checked as that campaign's", async () => {
      const message = chatMessage()
      const response = await post(envelope('chat.message.created', { message }))

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'chat.message.created', data: { message } },
        's1',
        TIME,
      )
    })

    it.each([
      ['a campaign set up after its hello was refused', undefined],
      ['a new session of the module', 's0'],
    ])(
      "asks for the campaign's hello again for %s",
      async (_, helloSession) => {
        jest
          .mocked(findEventCampaign)
          .mockResolvedValue({ id: 'c1', helloSession })

        const response = await post(
          envelope('bridge.heartbeat', {}, { sequence: null }),
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toMatch(
          /^application\/json/,
        )
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
        await expect(response.json()).resolves.toEqual({
          resend: 'hello',
          features: FEATURES,
        })
        expect(markSeen).toHaveBeenCalledWith('c1')
      },
    )

    it("doesn't ask for a hello in answer to a hello", async () => {
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })

      const response = await post(
        envelope('bridge.hello', { characters: [], combats: [] }),
      )

      await expect(response.json()).resolves.toEqual({
        features: FEATURES,
      })
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        {
          type: 'bridge.hello',
          data: { characters: [], combats: [], prompts: [], groups: [] },
        },
        's1',
        TIME,
      )
    })

    it('takes descriptions sent ahead of their session’s hello, without asking for it', async () => {
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })
      const texts = { '0f1a2b3c4d5e6f': '<p>Second Wind</p>' }

      const response = await post(
        envelope(
          'character.texts',
          { texts: { ...texts, bad: '<p/>' } },
          { sequence: null },
        ),
      )

      expect(response.status).toBe(204)
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'character.texts', data: { texts } },
        's1',
        TIME,
      )
    })

    it.each([
      ['a hello', envelope('bridge.hello', { characters: [], combats: [] })],
      [
        'a changed character',
        envelope('character.updated', {
          character: { id: 'actor-thorin', name: 'Thorin', sheet: null },
        }),
      ],
    ])(
      'asks for everything again when %s refers to a description not held',
      async (_, event) => {
        jest
          .mocked(applyCampaignEvent)
          .mockResolvedValueOnce({ lacksTexts: true })

        const response = await post(event)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
          resend: 'hello',
        })
      },
    )

    it('refuses an event for a campaign not set up, saying so', async () => {
      jest.mocked(findEventCampaign).mockResolvedValue('unknown')

      const response = await post(envelope('chat.cleared', {}))

      await expectRefusal(response, 404, NOT_SET_UP)
      // Recorded there, as it looked the campaign up.
      expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it("refuses an event without the campaign's secret", async () => {
      jest.mocked(findEventCampaign).mockResolvedValue('refused')

      const response = await post(envelope('chat.cleared', {}))

      await expectRefusal(response, 401, WRONG_SECRET)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it.each([
      ['a heartbeat', 'bridge.heartbeat'],
      ['an event type it does not use', 'actor.updated'],
    ])('notes %s as the game being connected', async (_, type) => {
      await post(envelope(type, {}, { sequence: null }))

      expect(markSeen).toHaveBeenCalledWith('c1')
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('tells the module, in answer to its hello, heartbeat or a sheet only, that it has commands to fetch, reads slim sheets and what Midi-QOL asks, and how large a post it takes', async () => {
      const heartbeat = await post(
        envelope('bridge.heartbeat', {}, { sequence: null }),
      )
      expect(heartbeat.status).toBe(200)
      expect(heartbeat.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      await expect(heartbeat.json()).resolves.toEqual({
        features: FEATURES,
      })

      // From module 0.22.0, which sizes each sheet's post by it, and sends it slim or not by it.
      const sheet = await post(
        envelope('character.updated', {
          character: { id: 'actor-thorin', name: 'Thorin', sheet: null },
        }),
      )
      expect(sheet.status).toBe(200)
      expect(sheet.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      await expect(sheet.json()).resolves.toEqual({ features: FEATURES })

      for (const event of [
        envelope('actor.updated', {}),
        envelope('chat.message.created', { message: chatMessage() }),
        envelope(
          'character.texts',
          { texts: { '0f1a2b3c4d5e6f': '<p/>' } },
          { sequence: null },
        ),
      ]) {
        const other = await post(event)
        expect(other.status).toBe(204)
      }
    })

    it("answers a group's sheet with what it does too, as the module sends a party's sheet slim and sizes it by that, but not a group's leaving, from module 0.30.0", async () => {
      jest.mocked(applyCampaignEvent).mockResolvedValue({ lacksTexts: false })
      const group = { ...groupEntry(), sheet: null }

      const sheet = await post(envelope('group.updated', { group }))

      expect(sheet.status).toBe(200)
      expect(sheet.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      await expect(sheet.json()).resolves.toEqual({ features: FEATURES })
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'group.updated', data: { group } },
        's1',
        TIME,
      )

      const removed = await post(envelope('group.removed', { id: 'company' }))
      expect(removed.status).toBe(204)
      expect(applyCampaignEvent).toHaveBeenLastCalledWith(
        'c1',
        world,
        campaign,
        { type: 'group.removed', data: { id: 'company' } },
        's1',
        TIME,
      )
    })

    it('asks for no hello in answer to one whose sheets follow it, from module 0.22.0', async () => {
      const characters = [
        {
          id: 'actor-thorin',
          uuid: 'Actor.actor-thorin',
          name: 'Thorin',
          img: null,
          type: 'character',
          owners: [],
        },
      ]
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })
      jest.mocked(applyCampaignEvent).mockResolvedValue({ lacksTexts: false })

      const response = await post(
        envelope('bridge.hello', {
          sheetsApart: true,
          characters,
          combats: [],
        }),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ features: FEATURES })
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        {
          type: 'bridge.hello',
          data: {
            sheetsApart: true,
            characters,
            combats: [],
            prompts: [],
            groups: [],
          },
        },
        's1',
        TIME,
      )
    })

    it('takes a slim sheet, made whole, answering that it reads them', async () => {
      const sheet = characterSheet()

      const response = await post(
        envelope('character.updated', {
          character: { ...roster[0], sheet: { ...sheet, slim: 1 } },
        }),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ features: FEATURES })
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        {
          type: 'character.updated',
          data: { character: { ...roster[0], sheet } },
        },
        's1',
        TIME,
      )
    })

    it('applies the saves the game asks for, as they open and close', async () => {
      const prompt = {
        id: 'msg1-thorin',
        actorId: 'thorin',
        messageId: 'msg1',
        type: 'concentration',
        abilities: ['con'],
        dc: null,
        label: 'Bless',
        openedAt: '2026-10-08T12:00:00.000Z',
        expiresAt: '2026-10-08T12:10:00.000Z',
      }

      const opened = await post(envelope('roll.prompt.opened', { prompt }))
      const closed = await post(
        envelope('roll.prompt.closed', { id: prompt.id, reason: 'answered' }),
      )

      expect([opened.status, closed.status]).toEqual([204, 204])
      expect(
        jest.mocked(applyCampaignEvent).mock.calls.map(call => call[3]),
      ).toEqual([
        { type: 'roll.prompt.opened', data: { prompt } },
        {
          type: 'roll.prompt.closed',
          data: { id: prompt.id, reason: 'answered' },
        },
      ])
    })

    it('applies what Midi-QOL asks, from module 0.27.0, and refuses one it couldn’t answer as asked', async () => {
      const web = {
        id: 'k3yk3yk3yk3yk3yk-thorin',
        actorId: 'thorin',
        messageId: 'k3yk3yk3yk3yk3yk',
        type: 'skill',
        abilities: [],
        skills: ['ath', 'acr'],
        dc: 12,
        label: 'Web',
        openedAt: '2026-10-08T12:00:00.000Z',
        expiresAt: '2026-10-08T12:01:00.000Z',
        source: 'overtime',
        advantage: { ath: 'adv' },
        askedInFoundry: false,
      }

      const opened = await post(envelope('roll.prompt.opened', { prompt: web }))
      expect(opened.status).toBe(204)
      expect(jest.mocked(applyCampaignEvent).mock.calls[0][3]).toEqual({
        type: 'roll.prompt.opened',
        data: { prompt: web },
      })

      // An ability or skill check said to come from nowhere, as no chat card asks one.
      const refused = await post(
        envelope('roll.prompt.opened', {
          prompt: { ...web, source: undefined },
        }),
      )
      await expectRefusal(refused, 400, {
        reason: 'malformed',
        message: 'Malformed roll.prompt.opened',
        type: 'roll.prompt.opened',
        detail: expect.any(String),
      })
      expect(applyCampaignEvent).toHaveBeenCalledTimes(1)
    })

    it("applies Foundry's settings when one changes, from module 0.30.0, answering nothing more, and one it can't read as none", async () => {
      const settings = foundrySettings()

      const changed = await post(envelope('bridge.settings', { settings }))
      expect(changed.status).toBe(204)
      expect(jest.mocked(applyCampaignEvent).mock.calls[0][3]).toEqual({
        type: 'bridge.settings',
        data: { settings },
      })

      // Never refused, for the Gamemaster's card shows them only.
      const unread = await post(
        envelope('bridge.settings', { settings: { format: 2 } }),
      )
      expect(unread.status).toBe(204)
      expect(jest.mocked(applyCampaignEvent).mock.calls[1][3]).toEqual({
        type: 'bridge.settings',
        data: { settings: undefined },
      })
      expect(recordRefusal).not.toHaveBeenCalled()
    })

    it('applies a journal of notes as Foundry holds it, from module 0.34.0, answering nothing more, and refuses one it can’t read', async () => {
      const book = mockJournalUpdated('party')

      const applied = await post(envelope('journal.updated', book))
      expect(applied.status).toBe(204)
      expect(jest.mocked(applyCampaignEvent).mock.calls[0][3]).toEqual({
        type: 'journal.updated',
        data: book,
      })

      // One note it can't read fails the whole book, which the module doesn't send again.
      const refused = await post(
        envelope('journal.updated', {
          ...book,
          journal: {
            ...book.journal,
            notes: [{ ...book.journal!.notes[0], title: '' }],
          },
        }),
      )
      await expectRefusal(refused, 400, {
        reason: 'malformed',
        message: 'Malformed journal.updated',
        type: 'journal.updated',
        detail: expect.any(String),
      })
      expect(applyCampaignEvent).toHaveBeenCalledTimes(1)
    })

    describe('command.result', () => {
      const result = {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [],
      }

      it("records what became of a player's roll, without bumping the campaign's version", async () => {
        const response = await post(
          envelope('command.result', result, { sequence: null }),
        )

        expect(response.status).toBe(204)
        expect(recordCommandResult).toHaveBeenCalledWith('c1', result)
        expect(markSeen).toHaveBeenCalledWith('c1')
        expect(applyCampaignEvent).not.toHaveBeenCalled()
      })

      it('records what came of an attack, and the dice its damage throws', async () => {
        const attack = {
          ...result,
          attack: { critical: false, fumble: false, outcome: 'miss' },
          damage: {
            critical: false,
            plannable: true,
            rolls: [
              {
                formula: '1d8 + 4',
                type: 'bludgeoning',
                dice: [{ faces: 8, number: 1 }],
              },
            ],
          },
        }
        const response = await post(
          envelope('command.result', attack, { sequence: null }),
        )

        expect(response.status).toBe(204)
        expect(recordCommandResult).toHaveBeenCalledWith('c1', attack)
      })

      it('refuses a result without its id', async () => {
        const response = await post(
          envelope('command.result', { ...result, id: '' }, { sequence: null }),
        )

        await expectRefusal(response, 400, {
          reason: 'malformed',
          message: 'Malformed command.result',
          type: 'command.result',
          detail: expect.stringMatching(/→ at id/),
        })
        expect(recordCommandResult).not.toHaveBeenCalled()
      })

      it('asks for a retry when the result cannot be stored', async () => {
        const consoleError = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        jest
          .mocked(recordCommandResult)
          .mockRejectedValueOnce(new Error('db down'))

        const response = await post(
          envelope('command.result', result, { sequence: null }),
        )

        await expectRefusal(response, 500, UNAVAILABLE)
        expect(consoleError).toHaveBeenCalledWith(
          `Failed to apply command.result from ${GAME}`,
          expect.any(Error),
        )
        consoleError.mockRestore()
      })
    })

    it('refuses an event sent to no campaign', async () => {
      const response = await post(
        envelope('chat.cleared', {}, { campaign: null }),
      )

      await expectRefusal(response, 400, {
        reason: 'malformed',
        message: 'No campaign for chat.cleared',
        type: 'chat.cleared',
      })
      // No campaign to record it on.
      expect(recordRefusal).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('refuses a campaign without a title', async () => {
      const response = await post(
        envelope(
          'chat.cleared',
          {},
          { campaign: { id: 'camp-a', title: ' ' } },
        ),
      )

      await expectRefusal(response, 400, {
        reason: 'badEnvelope',
        message: 'Not a Sending Stone envelope',
      })
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it.each([
      ['no secret', {}],
      ['a malformed header', { Authorization: 'hunter2' }],
    ])('refuses %s', async (_, headers) => {
      const request = new Request(URL, {
        method: 'POST',
        headers: { Origin: GAME, ...headers },
        body: JSON.stringify(envelope('chat.cleared', {})),
      })

      const response = await POST(request)

      await expectRefusal(response, 401, {
        reason: 'noSecret',
        message: 'Send the campaign’s secret',
      })
      expect(findEventCampaign).not.toHaveBeenCalled()
    })

    it.each([
      ['no origin', { Origin: '' }],
      ['a site that is not a Forge game', { Origin: 'https://evil.example' }],
      ['a Forge page that is not a game', { Origin: 'https://forge-vtt.com' }],
      ['a game origin with a path', { Origin: `${GAME}/game` }],
    ])('refuses %s', async (_, headers) => {
      const response = await post(envelope('chat.cleared', {}), headers)

      await expectRefusal(
        response,
        403,
        {
          reason: 'notForge',
          message: 'Only games on The Forge are accepted',
        },
        headers.Origin,
      )
      expect(findEventCampaign).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('takes a hello of more than 1 MB, as a party with large spellbooks sends', async () => {
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })

      const response = await post(
        envelope('bridge.hello', {
          characters: [],
          combats: [],
          padding: 'x'.repeat(1_200_000),
        }),
      )

      expect(response.status).toBe(200)
      expect(applyCampaignEvent).toHaveBeenCalled()
    })

    it('refuses an oversized body, saying how much it takes', async () => {
      const response = await post('x'.repeat(MAX_ENVELOPE_BYTES + 1))

      await expectRefusal(response, 413, TOO_LARGE)
    })

    it('refuses a declared oversized body without reading it', async () => {
      const request = new Request(URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer hunter2',
          Origin: GAME,
          'Content-Length': String(MAX_ENVELOPE_BYTES + 1),
        },
        body: '{}',
      })
      const text = jest.spyOn(request, 'text')

      const response = await POST(request)

      await expectRefusal(response, 413, TOO_LARGE)
      expect(text).not.toHaveBeenCalled()
    })

    it.each([
      ['not JSON', 'nope'],
      ['not an envelope', { hello: 'world' }],
    ])('refuses a body that is %s', async (_, body) => {
      const response = await post(body)

      await expectRefusal(response, 400, {
        reason: 'badEnvelope',
        message: 'Not a Sending Stone envelope',
      })
    })

    it.each([1, 3])(
      'refuses protocol %i, saying which it takes',
      async protocol => {
        const response = await post(envelope('chat.cleared', {}, { protocol }))

        await expectRefusal(response, 400, {
          reason: 'unsupportedProtocol',
          message: `Unsupported protocol ${protocol}`,
          protocol: 2,
        })
      },
    )

    it("answers a connection test with the secret of one of the game's campaigns", async () => {
      const response = await post(ping())

      expect(response.status).toBe(204)
      expect(checkGameSecret).toHaveBeenCalledWith(GAME, 'hunter2')
      expect(findEventCampaign).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('tests the campaign a connection test names, recording nothing of it', async () => {
      let response = await testCampaign()
      expect(response.status).toBe(204)
      expect(findEventCampaign).toHaveBeenCalledWith(
        GAME,
        campaign,
        'hunter2',
        { record: false },
      )
      expect(checkGameSecret).not.toHaveBeenCalled()

      jest.mocked(findEventCampaign).mockResolvedValue('unknown')
      response = await testCampaign()
      await expectRefusal(response, 404, NOT_SET_UP)

      jest.mocked(findEventCampaign).mockResolvedValue('refused')
      response = await testCampaign()
      await expectRefusal(response, 401, WRONG_SECRET)
      expect(
        jest.mocked(findEventCampaign).mock.calls.map(call => call[3]),
      ).toEqual([{ record: false }, { record: false }, { record: false }])
      expect(recordRefusal).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
      expect(markSeen).not.toHaveBeenCalled()
    })

    it('tells a connection test when no campaign is set up, or the secret is wrong', async () => {
      jest.mocked(checkGameSecret).mockResolvedValue('unknown')
      let response = await post(ping())
      await expectRefusal(response, 404, {
        reason: 'notSetUp',
        message: `No campaign is set up for ${GAME} in Sending Stone`,
      })

      jest.mocked(checkGameSecret).mockResolvedValue('refused')
      response = await post(ping())
      await expectRefusal(response, 401, WRONG_SECRET)
      expect(recordRefusal).not.toHaveBeenCalled()
    })

    it('asks for a retry when the campaign cannot be looked up', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(findEventCampaign).mockRejectedValue(new Error('db down'))
      jest.mocked(checkGameSecret).mockRejectedValue(new Error('db down'))

      const event = await post(envelope('chat.cleared', {}))
      const test = await post(ping())

      await expectRefusal(event, 500, UNAVAILABLE)
      await expectRefusal(test, 500, UNAVAILABLE)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check a Sending Stone event',
        expect.any(Error),
      )
      consoleError.mockRestore()
    })

    it('refuses an event missing what the app relies on, saying what, and records it for the campaign', async () => {
      const response = await post(
        envelope('chat.message.created', { message: { id: 'm1' } }),
      )

      await expectRefusal(response, 400, {
        reason: 'malformed',
        message: 'Malformed chat.message.created',
        type: 'chat.message.created',
        detail: expect.stringMatching(/timestamp/),
      })
      expect(recordRefusal).toHaveBeenCalledTimes(1)
      const [target, refusal] = jest.mocked(recordRefusal).mock.calls[0]
      expect(target).toEqual({ ids: ['c1'] })
      expect(refusal).toEqual({
        reason: 'malformed',
        status: 400,
        detail: expect.stringMatching(/^chat\.message\.created: ✖ /),
      })
      // What was wrong first: its message, and where.
      expect(refusal.detail?.split('\n')).toHaveLength(2)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('records what was wrong in at most 300 characters, and answers it in at most 1000', async () => {
      const long = 'y'.repeat(2000)
      jest.mocked(parseGameEvent).mockImplementationOnce(() => {
        throw new z.ZodError([
          { code: 'custom', message: long, path: ['message'], input: {} },
          { code: 'custom', message: 'and more', path: ['id'], input: {} },
        ])
      })

      const response = await post(
        envelope('chat.message.created', { message: chatMessage() }),
      )

      const body = await response.json()
      expect(body.detail).toHaveLength(1000)
      expect(body.detail).toMatch(/^✖ y+$/)
      const [, refusal] = jest.mocked(recordRefusal).mock.calls[0]
      expect(refusal.detail).toHaveLength(300)
      expect(refusal.detail).toMatch(/^chat\.message\.created: ✖ y+$/)
    })

    it("records nothing malformed for a post without the campaign's secret, nor for a test", async () => {
      jest.mocked(findEventCampaign).mockResolvedValue('refused')
      const wrong = await post(
        envelope('chat.message.created', { message: { id: 'm1' } }),
      )
      await expectRefusal(wrong, 401, WRONG_SECRET)

      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })
      const test = await post(
        envelope('bridge.ping', { nope: true }, { sequence: null }),
      )
      expect(test.status).toBe(204)

      expect(recordRefusal).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('asks for a retry when the event cannot be stored', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(applyCampaignEvent).mockRejectedValue(new Error('db down'))

      const response = await post(envelope('chat.cleared', {}))

      await expectRefusal(response, 500, UNAVAILABLE)
      expect(consoleError).toHaveBeenCalledWith(
        `Failed to apply chat.cleared from ${GAME}`,
        expect.any(Error),
      )
      consoleError.mockRestore()
    })
  })
})
