/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { applyCampaignEvent } from './campaign-events'
import {
  combat,
  foundrySettings,
  foundrySnapshot,
  roster,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import type { GameEvent } from '@/types/sending-stone'

// What Foundry says of itself for a campaign: its versions in every hello, and from module 0.30.0
// its settings, in the hello and in bridge.settings when one changes. Only the Gamemaster's card
// reads them, so no table page is made to fetch again for them.

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }
const SENT = '2026-10-19T18:45:00.000Z'

const apply = (type: string, data: unknown) =>
  applyCampaignEvent(
    'c1',
    world,
    campaign,
    parseGameEvent(type, data) as GameEvent,
    'session-1',
    SENT,
  )

/** What a hello says of Foundry, as every module sends it. */
const ABOUT = {
  module: { id: 'sending-stone', version: '0.30.0' },
  foundry: { version: '14.365', generation: 14 },
  system: { id: 'dnd5e', title: 'D&D Fifth Edition', version: '5.3.3' },
}

const hello = (fields: object) =>
  apply('bridge.hello', {
    sheetsApart: true,
    characters: roster,
    combats: [combat()],
    ...fields,
  })

/** Every write of the campaign, by what it wrote. */
const writes = () =>
  prismaMock.campaign.update.mock.calls.map(([{ data }]) => data)

/** What Foundry's snapshot was last written as. */
const savedFoundry = () =>
  writes()
    .map(data => data.foundry)
    .findLast(foundry => foundry !== undefined)

/** The write every event ends with: the title, when it was seen, and the version. */
const lastWrite = () => writes().at(-1)

describe("db/campaign-events, Foundry's settings (module 0.30.0)", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
    prismaMock.actorSheet.findMany.mockResolvedValue([])
    prismaMock.groupSheet.findMany.mockResolvedValue([])
  })

  it('keeps what a hello says of Foundry, with its settings, as of when it was sent', async () => {
    await hello({ ...ABOUT, settings: foundrySettings() })

    expect(savedFoundry()).toEqual({
      receivedAt: SENT,
      ...ABOUT,
      settings: foundrySettings(),
    })
    // A hello changes what players see, as before.
    expect(lastWrite()).toMatchObject({ version: { increment: 1 } })
  })

  it("replaces it on every hello, so an older module's clears the settings a newer one sent", async () => {
    await hello({
      ...ABOUT,
      module: { id: 'sending-stone', version: '0.29.0' },
    })

    expect(savedFoundry()).toEqual({
      receivedAt: SENT,
      ...ABOUT,
      module: { id: 'sending-stone', version: '0.29.0' },
    })
    expect(savedFoundry()).not.toHaveProperty('settings')
  })

  it('keeps a hello whose settings it can’t read, without them', async () => {
    await hello({ ...ABOUT, settings: { format: 2 } })

    expect(savedFoundry()).toEqual({ receivedAt: SENT, ...ABOUT })
  })

  it('merges settings that changed into what the hello said, without bumping the version', async () => {
    const held = foundrySnapshot({ receivedAt: '2026-10-19T18:00:00.000Z' })
    prismaMock.campaign.findUnique.mockResolvedValue({ foundry: held } as never)
    const changed = foundrySettings({ results: [] })

    await apply('bridge.settings', { settings: changed })

    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: { foundry: true },
    })
    expect(savedFoundry()).toEqual({
      ...held,
      settings: changed,
      receivedAt: SENT,
    })
    // No table page refetches for what only the Gamemaster's card shows.
    expect(lastWrite()).not.toHaveProperty('version')
    expect(lastWrite()).toMatchObject({ title: campaign.title })
  })

  it('keeps settings that arrive before any hello was kept', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ foundry: null } as never)

    await apply('bridge.settings', { settings: foundrySettings() })

    expect(savedFoundry()).toEqual({
      settings: foundrySettings(),
      receivedAt: SENT,
    })
  })

  it('ignores settings it can’t read, keeping those it has', async () => {
    await apply('bridge.settings', { settings: { format: 2 } })

    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(savedFoundry()).toBeUndefined()
    expect(lastWrite()).not.toHaveProperty('version')
  })

  it('still bumps the version for anything else players see, and not for descriptions', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ origin: 'x' } as never)
    await apply('character.texts', { texts: {} })
    expect(lastWrite()).not.toHaveProperty('version')

    await apply('chat.cleared', {})
    expect(lastWrite()).toMatchObject({ version: { increment: 1 } })
  })
})
