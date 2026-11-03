import type { ReactNode } from 'react'

/**
 * The 3D dice, for a suite that draws none: what a suite's mock of `@lambersond/3d-dice-react`
 * hands back (`jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER`). The provider only
 * passes its children through, and the renderer is never ready, so every roll is thrown by the
 * app's own dice.
 */
export const NO_DICE_RENDERER = {
  DiceRendererProvider: ({ children }: { children: ReactNode }) => children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}
