/**
 * @jest-environment node
 */
import {
  atFixedTime,
  minutesAgo,
  normalizeIds,
  normalizeTimes,
  ordered,
  posts,
  respond,
  responding,
  rollServer,
  sent,
} from './test-utils'
import {
  prismaFake,
  prismaMock,
  resetPrisma,
  routeCall,
} from './test-utils-node'

// The kit's own table test: its two halves, run in Node, as routeCall needs Node's Request; the
// copies adopted from the suites (advance, brokenImages) are held by those suites.

describe('normalizeIds', () => {
  it.each([
    [
      'names each id by where it first appears, the same id the same name',
      '<div id="_r_3_" aria-labelledby="_r_a_ _r_3_"></div><p id="_r_a_"></p>',
      '<div id="id-1" aria-labelledby="id-2 id-1"></div><p id="id-2"></p>',
    ],
    [
      'names an id inside another value',
      '<div id="_r_3_-panel" aria-controls="_r_3_-tab"></div>',
      '<div id="id-1-panel" aria-controls="id-1-tab"></div>',
    ],
    [
      "names a hydrated id and older React's",
      '_R_1H2_ «r5» :r7: _R_2_',
      'id-1 id-2 id-3 id-4',
    ],
    [
      'leaves an id a pane gives itself',
      '<div id="creature-wolf-sheet-tab-actions"></div>',
      '<div id="creature-wolf-sheet-tab-actions"></div>',
    ],
  ])('%s', (_, html, normalized) => {
    expect(normalizeIds(html)).toBe(normalized)
  })
})

describe('normalizeTimes', () => {
  it.each([
    [
      '<time dateTime="2026-10-04T19:30:00.000Z">7:30 PM</time>',
      '<time dateTime="2026-10-04T19:30:00.000Z">⟨time⟩</time>',
    ],
    [
      '<time dateTime="2026-10-04T19:30:00.000Z"></time>',
      '<time dateTime="2026-10-04T19:30:00.000Z"></time>',
    ],
    ['Last heard 7:30 PM', 'Last heard ⟨time⟩'],
    ['Last heard 7:30 PM', 'Last heard ⟨time⟩'],
    ['As Foundry sent them at 19:30.', 'As Foundry sent them at ⟨time⟩.'],
    ['at Oct 4, 7:30 PM.', 'at ⟨time⟩.'],
    [
      '<time title="Sunday, October 4, 2026 at 7:30 PM">2 hours ago</time>',
      '<time title="⟨time⟩">⟨time⟩</time>',
    ],
    ['Changed 4 Oct', 'Changed ⟨time⟩'],
    ['Changed 4 Oct 2025', 'Changed ⟨time⟩'],
    [
      'just now · 3 minutes ago · yesterday',
      'just now · 3 minutes ago · yesterday',
    ],
    ['2026-10-04T19:30:00.000Z', '2026-10-04T19:30:00.000Z'],
    ['1d20 + 4, DC 15', '1d20 + 4, DC 15'],
  ])('%j → %j', (text, normalized) => {
    expect(normalizeTimes(text)).toBe(normalized)
  })
})

describe('ordered', () => {
  it('keeps the keys in their order, as a snapshot of an object would not', () => {
    expect(ordered({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      '{\n "b": 1,\n "a": [\n  1,\n  {\n   "d": 2,\n   "c": 3\n  }\n ]\n}',
    )
  })
})

describe('respond and responding', () => {
  it.each([
    [200, true],
    [202, true],
    [204, true],
    [299, true],
    [300, false],
    [404, false],
    [500, false],
  ])('answers %i ok: %s', async (status, ok) => {
    const answer = respond(status, { id: 'req-1' })
    expect(answer).toMatchObject({ status, ok })
    await expect(answer.json()).resolves.toEqual({ id: 'req-1' })
    await expect(responding(status)).resolves.toMatchObject({ status, ok })
  })
})

describe('sent and posts', () => {
  it('gives each request whole, in order, and each POST parsed', () => {
    const signal = new AbortController().signal
    void fetch('/api/characters/c1/rolls', {
      method: 'POST',
      headers: { 'X-B': '2', 'Content-Type': 'application/json' },
      body: '{"kind":"skill","key":"prc"}',
      signal,
    })
    void fetch('/api/characters/c1/rolls/req-1', { cache: 'no-store', signal })
    void fetch(new URL('https://player.example/api/characters/c1/table'))
    void fetch('/api/notes', {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: '{}',
    })
    void fetch('/api/notes/order', {
      method: 'POST',
      headers: [['Content-Type', 'application/json']],
      body: '[2,1]',
    })

    expect(sent()).toEqual([
      {
        url: '/api/characters/c1/rolls',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-B': '2' },
        body: '{"kind":"skill","key":"prc"}',
        signal: true,
      },
      {
        url: '/api/characters/c1/rolls/req-1',
        method: 'GET',
        headers: {},
        body: undefined,
        cache: 'no-store',
        signal: true,
      },
      {
        url: 'https://player.example/api/characters/c1/table',
        method: 'GET',
        headers: {},
        body: undefined,
      },
      {
        url: '/api/notes',
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      },
      {
        url: '/api/notes/order',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '[2,1]',
      },
    ])
    expect(Object.keys(sent()[0].headers)).toEqual(['Content-Type', 'X-B'])
    expect(posts()).toEqual([
      { url: '/api/characters/c1/rolls', body: { kind: 'skill', key: 'prc' } },
      { url: '/api/notes/order', body: [2, 1] },
    ])
  })
})

describe('rollServer', () => {
  const fetched = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = fetched
  })

  it('takes each roll posted, and answers each asked after as given, else pending', async () => {
    const posted = rollServer({ 'req-1': { status: 'done', total: 17 } })

    const taken = await fetch('/api/characters/c1/rolls', {
      method: 'POST',
      body: '{"kind":"skill"}',
    })
    await expect(taken.json()).resolves.toEqual({ id: 'req-1' })
    await fetch('/api/characters/c1/rolls', { method: 'POST', body: '{}' })
    const done = await fetch('/api/characters/c1/rolls/req-1')
    const pending = await fetch('/api/characters/c1/rolls/req-2')

    expect(posted).toEqual([{ kind: 'skill' }, {}])
    expect(taken.status).toBe(202)
    await expect(done.json()).resolves.toEqual({
      id: 'req-1',
      status: 'done',
      total: 17,
    })
    await expect(pending.json()).resolves.toEqual({
      id: 'req-2',
      status: 'pending',
    })
  })
})

describe('atFixedTime and minutesAgo', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('sets the clock, and counts back from it', () => {
    const now = atFixedTime('2026-10-04T19:30:00.000Z')

    expect(now).toBe(Date.parse('2026-10-04T19:30:00.000Z'))
    expect(Date.now()).toBe(now)
    expect(minutesAgo(90)).toBe('2026-10-04T18:00:00.000Z')
  })
})

const ids = (found: unknown) => (found as { id: string }[]).map(({ id }) => id)
/** A journal note's compound key, by the name Prisma gives it. */
const NOTE_KEY = 'bookId_noteId'

describe('prismaFake', () => {
  const rows = () => ({
    campaign: [
      {
        id: 'c1',
        ownerId: 'u1',
        title: 'The Lonely Mountain',
        lastSeenAt: new Date('2026-10-04T19:00:00.000Z'),
        seats: [{ userId: 'u2' }],
      },
      {
        id: 'c2',
        ownerId: 'u2',
        title: 'Curse of Strahd',
        lastSeenAt: new Date('2026-10-01T19:00:00.000Z'),
        seats: [],
      },
    ],
    journalNote: [{ bookId: 'b1', noteId: 'n1', order: 1 }],
  })
  afterEach(() => {
    resetPrisma()
  })

  it.each([
    ['a field', { ownerId: 'u2' }, ['c2']],
    ['in', { id: { in: ['c2', 'c9'] } }, ['c2']],
    ['notIn and not', { id: { notIn: ['c2'] }, title: { not: 'x' } }, ['c1']],
    [
      'a time',
      { lastSeenAt: { gt: new Date('2026-10-02T00:00:00.000Z') } },
      ['c1'],
    ],
    ['OR', { OR: [{ id: 'c2' }, { ownerId: 'u1' }] }, ['c1', 'c2']],
    ['NOT', { NOT: { ownerId: 'u1' } }, ['c2']],
    ['AND', { AND: [{ ownerId: 'u1' }, { id: 'c2' }] }, []],
    ['a relation', { seats: { some: { userId: 'u2' } } }, ['c1']],
    ['text', { title: { contains: 'Mountain' } }, ['c1']],
    ['a field left undefined', { ownerId: undefined }, ['c1', 'c2']],
  ])('finds rows by %s', async (_, where, found) => {
    prismaFake(rows())

    expect(ids(await prismaMock.campaign.findMany({ where } as never))).toEqual(
      found,
    )
    expect(await prismaMock.campaign.count({ where } as never)).toBe(
      found.length,
    )
  })

  it('finds one row, by a compound key too, or none', async () => {
    prismaFake(rows())

    expect(
      await prismaMock.campaign.findUnique({ where: { id: 'c2' } }),
    ).toMatchObject({ id: 'c2' })
    expect(
      await prismaMock.journalNote.findUnique({
        where: { [NOTE_KEY]: { bookId: 'b1', noteId: 'n1' } } as never,
      }),
    ).toEqual({ bookId: 'b1', noteId: 'n1', order: 1 })
    expect(
      await prismaMock.campaign.findFirst({ where: { id: 'c9' } }),
    ).toBeNull()
    await expect(
      prismaMock.campaign.findUniqueOrThrow({ where: { id: 'c9' } }),
    ).rejects.toMatchObject({ code: 'P2025' })
  })

  it('takes and skips, in the order given', async () => {
    prismaFake(rows())

    expect(
      ids(await prismaMock.campaign.findMany({ skip: 1, take: 1 })),
    ).toEqual(['c2'])
    expect(ids(await prismaMock.campaign.findMany({ take: 1 }))).toEqual(['c1'])
  })

  it('writes to its rows, as the next query reads them', async () => {
    const fake = prismaFake(rows())

    const made = await prismaMock.campaign.create({
      data: { ownerId: 'u3', title: 'Tomb' } as never,
    })
    await prismaMock.journalNote.update({
      where: { [NOTE_KEY]: { bookId: 'b1', noteId: 'n1' } } as never,
      data: { order: { increment: 2 } } as never,
    })
    const changed = await prismaMock.campaign.updateMany({
      where: { ownerId: 'u1' },
      data: { title: 'Erebor' },
    })
    await prismaMock.campaign.upsert({
      where: { id: 'c1' },
      create: {} as never,
      update: { ownerId: 'u4' },
    })
    await prismaMock.campaign.upsert({
      where: { id: 'c7' },
      create: { id: 'c7', ownerId: 'u7' } as never,
      update: {},
    })
    await prismaMock.campaign.delete({ where: { id: 'c2' } })
    const gone = await prismaMock.campaign.deleteMany({
      where: { ownerId: 'u3' },
    })

    expect(made).toEqual({ id: 'campaign-1', ownerId: 'u3', title: 'Tomb' })
    expect(changed).toEqual({ count: 1 })
    expect(gone).toEqual({ count: 1 })
    expect(fake.tables.journalNote[0].order).toBe(3)
    expect(fake.tables.campaign).toEqual([
      expect.objectContaining({ id: 'c1', ownerId: 'u4', title: 'Erebor' }),
      { id: 'c7', ownerId: 'u7' },
    ])
    await expect(
      prismaMock.campaign.update({ where: { id: 'c2' }, data: {} }),
    ).rejects.toMatchObject({ code: 'P2025' })
  })

  it('runs a transaction, and records every call made of the mock, in order', async () => {
    const fake = prismaFake(rows())

    await prismaMock.$transaction(async tx => {
      await tx.campaign.findUnique({ where: { id: 'c1' } })
      await tx.journalNote.count()
    })
    await prismaMock.$transaction([
      prismaMock.campaign.count({ where: { ownerId: 'u1' } }),
    ])
    // A model the rows don't name is answered by no one, and recorded too.
    await prismaMock.user.findMany({ where: { id: 'u1' } })

    expect(fake.calls).toEqual([
      { model: '$transaction', method: '', args: 'callback' },
      {
        model: 'campaign',
        method: 'findUnique',
        args: { where: { id: 'c1' } },
      },
      { model: 'journalNote', method: 'count', args: undefined },
      {
        model: 'campaign',
        method: 'count',
        args: { where: { ownerId: 'u1' } },
      },
      { model: '$transaction', method: '', args: [expect.any(Promise)] },
      { model: 'user', method: 'findMany', args: { where: { id: 'u1' } } },
    ])
  })

  it('is fresh again once reset, the client extended as itself', async () => {
    prismaFake(rows())
    resetPrisma()

    expect(
      await prismaMock.campaign.findUnique({ where: { id: 'c1' } }),
    ).toBeUndefined()
    expect(prismaMock.$extends({} as never)).toBe(prismaMock)
  })
})

/** A route that answers what it was asked, as JSON. */
const echo = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params
  return Response.json(
    {
      id,
      method: request.method,
      type: request.headers.get('content-type'),
      body: await request.text(),
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}

/** A route that answers in words. */
const words = async (request: Request) =>
  new Response(`got ${await request.text()}`, { status: 400 })

describe('routeCall', () => {
  it('calls a route as Next.js does, and gives its answer whole', async () => {
    const answer = await routeCall(echo, {
      method: 'POST',
      url: 'https://player.example/api/characters/c1/rolls',
      headers: { 'Content-Type': 'application/json' },
      body: { kind: 'skill' },
      params: { id: 'c1' },
    })

    expect(answer).toEqual({
      status: 201,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      },
      body: String.raw`{"id":"c1","method":"POST","type":"application/json","body":"{\"kind\":\"skill\"}"}`,
      json: {
        id: 'c1',
        method: 'POST',
        type: 'application/json',
        body: '{"kind":"skill"}',
      },
    })
  })

  it('gives a body that is not JSON as text only, and a raw body as sent', async () => {
    await expect(
      routeCall(words, {
        method: 'POST',
        url: 'https://player.example/api/events',
        body: '{not json',
      }),
    ).resolves.toEqual({
      status: 400,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: 'got {not json',
    })
  })
})
