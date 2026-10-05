import '@testing-library/jest-dom'
import { PrismaClient } from '@prisma/client'
import { mockDeep } from 'jest-mock-extended'

// create one shared deep‐mock for all tests
export const prismaMock = mockDeep<PrismaClient>()

// src/clients/prisma extends the client with Accelerate; hand back the same mock so that
// `import prisma from '@/clients/prisma'` is prismaMock
prismaMock.$extends.mockReturnValue(prismaMock as any)

// jest will replace any import of { PrismaClient } with this mock. The Prisma namespace stays
// real, for its error classes.
jest.mock('@prisma/client', () => {
  return {
    __esModule: true,
    PrismaClient: jest.fn(() => prismaMock),
    Prisma: jest.requireActual('@prisma/client').Prisma,
  }
})

globalThis.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

globalThis.fetch = jest.fn()
/**
 * A simple mockFetch function that returns a Promise<Response>.
 * @param status The status code of the response
 * @param responseData The data that is passed in response
 * @returns void
 */
export function mockFetch({ status = 200, responseData = {} } = {}) {
  globalThis.fetch = jest.fn(() => {
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(responseData),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: '',
      clone: () => {},
      // eslint-disable-next-line unicorn/no-null
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(responseData),
    } as Response)
  })
}

export function mockManyFetch(
  responses: Array<{ status?: number; responseData?: any }> = [
    { status: 200, responseData: {} },
  ],
) {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo, RequestInit?]>()

  // for each config, queue up one mock response
  for (const { status = 200, responseData = {} } of responses) {
    const res: Partial<Response> = {
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(responseData),
      text: () =>
        typeof responseData === 'string'
          ? Promise.resolve(responseData)
          : Promise.resolve(JSON.stringify(responseData)),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: '',
      clone: () => ({}) as Response,
      body: undefined,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
    }
    fetchMock.mockResolvedValueOnce(res as Response)
  }

  globalThis.fetch = fetchMock as any
  return fetchMock
}

// jsdom has <dialog> but not its methods. Suites run in Node have no DOM at all.
if (typeof HTMLDialogElement !== 'undefined') {
  class Dialog extends HTMLDialogElement {
    override showModal() {
      this.open = true
    }

    override close() {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
  HTMLDialogElement.prototype.showModal = Dialog.prototype.showModal
  HTMLDialogElement.prototype.close = Dialog.prototype.close
}

// jsdom has no media queries either. Every query is unmatched, as in a narrow window; a test of a
// wide one spies on matchMedia.
if (globalThis.window !== undefined) {
  globalThis.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
}

// jsdom has no PointerEvent, so a pointer event's type and position would be lost.
if (globalThis.window !== undefined && globalThis.PointerEvent === undefined) {
  class PointerEvent extends MouseEvent {
    readonly pointerType: string

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? ''
    }
  }
  globalThis.PointerEvent = PointerEvent as typeof globalThis.PointerEvent
}
