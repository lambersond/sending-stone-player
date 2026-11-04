import { Prisma } from '@prisma/client'
import { mockReset } from 'jest-mock-extended'
import { prismaMock } from '../../jest.setup'
import type { NextRequest } from 'next/server'

/*
 * The node suites' test kit (v0.43): the shared Prisma mock, a small fake database over it that
 * records what was asked of it, a guard for suites that should ask it nothing, and a route
 * handler called as Next.js calls it. Tests import it; nothing else does.
 */

/** The one deep mock of the Prisma client every suite shares (jest.setup.ts). */
export { prismaMock } from '../../jest.setup'

/** The mock as plain objects of mock functions, to be walked and indexed by name. */
const models = prismaMock as unknown as Record<
  string,
  Record<string, jest.Mock> & Partial<jest.Mock>
>

const isMock = (value: unknown): value is jest.Mock =>
  typeof value === 'function' && '_isMockFunction' in value

/** Set once, as the client is extended with Accelerate when it loads: never a query. */
const LOADING = new Set(['$extends'])

/** Every call made of the mock, in the order made: `$transaction` and each model's methods. */
const callsMade = () => {
  const made: { model: string; method: string; arg: unknown; at: number }[] = []
  const add = (model: string, method: string, fn: jest.Mock) => {
    for (const [index, args] of fn.mock.calls.entries()) {
      made.push({
        model,
        method,
        arg: args[0],
        at: fn.mock.invocationCallOrder[index],
      })
    }
  }
  for (const model of Object.keys(prismaMock)) {
    if (LOADING.has(model)) continue
    const value = models[model]
    if (isMock(value)) add(model, '', value)
    for (const method of Object.keys(value ?? {})) {
      const fn = value[method]
      if (isMock(fn)) add(model, method, fn)
    }
  }
  return made.toSorted((a, b) => a.at - b.at)
}

/**
 * Fails each test, after it, that asked the database anything, naming each model method asked: for
 * a suite whose every database module is mocked, so that a query a change adds is seen.
 */
export const guardNoDb = () => {
  afterEach(() => {
    const asked = [
      ...new Set(
        callsMade().map(({ model, method }) =>
          method ? `${model}.${method}` : `${model}()`,
        ),
      ),
    ]
    if (asked.length > 0) {
      throw new Error(`The database was asked: ${asked.join(', ')}`)
    }
  })
}

/**
 * The mock as fresh: every implementation and answer given it gone (the config's `clearMocks`
 * clears only calls), and the client extended as itself again, as jest.setup.ts has it.
 */
export const resetPrisma = () => {
  mockReset(prismaMock)
  prismaMock.$extends.mockReturnValue(prismaMock as never)
}

type Row = Record<string, unknown>

/** Prisma's answer for a query that found no row. */
const NO_ROW = null

const FILTERS = new Set([
  'equals',
  'in',
  'notIn',
  'not',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
  'has',
  'some',
  'every',
  'none',
  'is',
  'isNot',
])

const isObject = (value: unknown): value is Row =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date)

const isFilter = (value: Row) =>
  Object.keys(value).length > 0 &&
  Object.keys(value).every(key => FILTERS.has(key))

const comparable = (value: unknown) =>
  value instanceof Date ? value.getTime() : value

const same = (a: unknown, b: unknown) =>
  JSON.stringify(comparable(a)) === JSON.stringify(comparable(b))

const listOf = (value: unknown): Row[] =>
  (Array.isArray(value) ? value : [value]) as Row[]

/** One of Prisma's scalar filters (`in`, `gt`, `contains` …) over a value. */
const passes = (value: unknown, filter: string, wanted: unknown): boolean => {
  const [have, want] = [comparable(value), comparable(wanted)] as [
    number | string,
    number | string,
  ]
  switch (filter) {
    case 'equals': {
      return same(value, wanted)
    }
    case 'in': {
      return (wanted as unknown[]).some(each => same(value, each))
    }
    case 'notIn': {
      return !(wanted as unknown[]).some(each => same(value, each))
    }
    case 'not': {
      return !fieldMatches(value, wanted)
    }
    case 'lt': {
      return have < want
    }
    case 'lte': {
      return have <= want
    }
    case 'gt': {
      return have > want
    }
    case 'gte': {
      return have >= want
    }
    default: {
      return textOrListPasses(value, filter, wanted)
    }
  }
}

/** The text filters, a scalar list's `has`, and a relation's (`some`, `every`, `none`, `is` …). */
const textOrListPasses = (
  value: unknown,
  filter: string,
  wanted: unknown,
): boolean => {
  const rows = Array.isArray(value) ? (value as Row[]) : []
  switch (filter) {
    case 'contains': {
      return String(value).includes(String(wanted))
    }
    case 'startsWith': {
      return String(value).startsWith(String(wanted))
    }
    case 'endsWith': {
      return String(value).endsWith(String(wanted))
    }
    case 'has': {
      return rows.some(each => same(each, wanted))
    }
    case 'some': {
      return rows.some(row => matches(row, wanted as Row))
    }
    case 'every': {
      return rows.every(row => matches(row, wanted as Row))
    }
    case 'none': {
      return !rows.some(row => matches(row, wanted as Row))
    }
    case 'is': {
      return isObject(value) && matches(value, wanted as Row)
    }
    case 'isNot': {
      return !(isObject(value) && matches(value, wanted as Row))
    }
    default: {
      // `mode` (case) changes nothing here.
      return true
    }
  }
}

/** Whether a row's field is as a `where` asks: equal, or as its filters or nested fields say. */
const fieldMatches = (value: unknown, wanted: unknown): boolean => {
  if (!isObject(wanted)) return same(value, wanted)
  if (isFilter(wanted)) {
    return Object.entries(wanted).every(([filter, each]) =>
      passes(value, filter, each),
    )
  }
  return isObject(value) && matches(value, wanted)
}

/**
 * Whether a row is one a `where` asks for: each field equal or as its filters say, AND, OR and
 * NOT, a compound key's fields (`bookId_noteId: {…}`) on the row itself, and a relation's fields
 * where the row holds it. A field the `where` gives `undefined` is left out, as Prisma leaves it.
 */
const matches = (row: Row, where: Row | undefined): boolean =>
  Object.entries(where ?? {}).every(([key, wanted]) => {
    if (wanted === undefined) return true
    if (key === 'AND') return listOf(wanted).every(each => matches(row, each))
    if (key === 'OR') return listOf(wanted).some(each => matches(row, each))
    if (key === 'NOT') return !listOf(wanted).some(each => matches(row, each))
    if (!(key in row) && isObject(wanted) && !isFilter(wanted)) {
      return matches(row, wanted)
    }
    return fieldMatches(row[key], wanted)
  })

/** Prisma's error for a row a query had to find and didn't. */
const notFound = (model: string) =>
  new Prisma.PrismaClientKnownRequestError(
    `No ${model} was found for the query.`,
    { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
  )

/** A field's new value, as an update's `data` gives it: set, or changed by a number. */
const updated = (value: unknown, change: unknown) => {
  if (!isObject(change)) return change
  const now = Number(value)
  if ('set' in change) return change.set
  if ('increment' in change) return now + Number(change.increment)
  if ('decrement' in change) return now - Number(change.decrement)
  if ('multiply' in change) return now * Number(change.multiply)
  if ('divide' in change) return now / Number(change.divide)
  return change
}

const withData = (row: Row, data: Row) => {
  for (const [key, change] of Object.entries(data)) {
    if (change !== undefined) row[key] = updated(row[key], change)
  }
  return row
}

/** The methods of one model, answering from its rows, which they change as they write. */
const modelMethods = (model: string, rows: Row[]) => {
  let made = 0
  const found = (where?: Row) => rows.find(row => matches(row, where))
  const all = (where?: Row) => rows.filter(row => matches(row, where))
  const create = (data: Row) => {
    made += 1
    const row = { id: `${model}-${made}`, ...data }
    rows.push(row)
    return row
  }
  const remove = (gone: Row[]) => {
    for (const row of gone) rows.splice(rows.indexOf(row), 1)
    return { count: gone.length }
  }
  const required = (where?: Row) => {
    const row = found(where)
    if (!row) throw notFound(model)
    return row
  }
  return {
    findUnique: ({ where }: Row) => found(where as Row) ?? NO_ROW,
    findFirst: (args?: Row) => found(args?.where as Row) ?? NO_ROW,
    findUniqueOrThrow: ({ where }: Row) => required(where as Row),
    findFirstOrThrow: (args?: Row) => required(args?.where as Row),
    findMany: (args?: Row) => {
      const skip = Number(args?.skip ?? 0)
      const take =
        args?.take === undefined ? undefined : skip + Number(args.take)
      return all(args?.where as Row).slice(skip, take)
    },
    count: (args?: Row) => all(args?.where as Row).length,
    create: ({ data }: Row) => create(data as Row),
    createMany: ({ data }: Row) => ({
      count: listOf(data).map(row => create(row)).length,
    }),
    createManyAndReturn: ({ data }: Row) =>
      listOf(data).map(row => create(row)),
    update: ({ where, data }: Row) =>
      withData(required(where as Row), data as Row),
    updateMany: ({ where, data }: Row) => {
      const changed = all(where as Row)
      for (const row of changed) withData(row, data as Row)
      return { count: changed.length }
    },
    upsert: ({ where, create: fresh, update }: Row) => {
      const row = found(where as Row)
      return row ? withData(row, update as Row) : create(fresh as Row)
    },
    delete: ({ where }: Row) => {
      const row = required(where as Row)
      remove([row])
      return row
    },
    deleteMany: (args?: Row) => remove(all(args?.where as Row)),
  }
}

/**
 * A small database for the real db modules to run over: for each model named in `rows` (as the
 * client names it, `rollRequest`), its find, count, create, update, upsert and delete methods
 * answer from those rows by `where` (`select`, `include` and `orderBy` aside: rows come back whole,
 * in the order given), and write to them; and `$transaction` runs its callback over the mock, or
 * awaits its list. `calls` is every call made of the mock, any model's, in order: `{model, method,
 * args}`, args being the query asked. Unique constraints aren't kept: a test that needs P2002 says
 * so with `mockRejectedValueOnce`.
 * @param rows - Each model's rows, as the database holds them.
 */
export const prismaFake = (rows: Record<string, Row[]>) => {
  const tables = Object.fromEntries(
    Object.entries(rows).map(([model, held]) => [
      model,
      held.map(row => ({ ...row })),
    ]),
  )
  for (const [model, held] of Object.entries(tables)) {
    for (const [method, answer] of Object.entries(modelMethods(model, held))) {
      models[model][method].mockImplementation(async (args?: Row) =>
        answer(args as Row),
      )
    }
  }
  prismaMock.$transaction.mockImplementation((async (run: unknown) =>
    typeof run === 'function'
      ? run(prismaMock)
      : Promise.all(run as Promise<unknown>[])) as never)
  return {
    /** Each model's rows, as the calls left them. */
    tables,
    /** Every call made of the mock, in order. */
    get calls() {
      return callsMade().map(({ model, method, arg }) => ({
        model,
        method,
        args: typeof arg === 'function' ? 'callback' : arg,
      }))
    },
  }
}

/** Code-unit order, the same on every machine (no locale). */
const byKey = ([a]: [string, string], [b]: [string, string]) => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * A route handler called as Next.js calls it, with a `NextRequest` and its params, and what it
 * answered: its status, its headers as one object sorted by name, its body as text, and that body
 * parsed where it's JSON.
 * @param handler - The route's exported method, such as `GET`.
 * @param request - The request: `body` a string as given, or anything else as JSON.
 */
export const routeCall = async <Params>(
  handler: (
    request: NextRequest,
    context: { params: Promise<Params> },
  ) => Response | Promise<Response>,
  {
    method = 'GET',
    url,
    body,
    headers,
    params,
  }: {
    method?: string
    url: string
    body?: unknown
    headers?: Record<string, string>
    params?: Params
  },
) => {
  // Loaded only once a route is called: it needs Node's Request, which jsdom suites haven't.
  const next = jest.requireActual<typeof import('next/server')>('next/server')
  const request = new next.NextRequest(url, {
    method,
    headers,
    body:
      body === undefined || typeof body === 'string'
        ? body
        : JSON.stringify(body),
  })
  const response = await handler(request, {
    params: Promise.resolve(params ?? ({} as Params)),
  })
  const text = await response.text()
  const json = (response.headers.get('content-type') ?? '').includes(
    'application/json',
  )
  return {
    status: response.status,
    headers: Object.fromEntries(
      [...response.headers.entries()].toSorted(byKey),
    ),
    body: text,
    ...(json && text !== '' && { json: JSON.parse(text) as unknown }),
  }
}
