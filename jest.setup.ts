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
