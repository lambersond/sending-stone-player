import type { ReactNode } from 'react'

/**
 * The 3D dice, for a suite that draws none: what a suite's mock of `@lambersond/3d-dice-react`
 * hands back (`jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER`). The library as it
 * is, its dice tray's state (`useTray`) among it, but for its renderer: the page's provider
 * (GameTable's, since v0.44, around the sheet and the chat alike) only passes its children through,
 * and the renderer is never ready, so every roll is thrown by the app's own dice.
 */
export const NO_DICE_RENDERER = {
  ...jest.requireActual<object>('@lambersond/3d-dice-react'),
  DiceRendererProvider: ({ children }: { children: ReactNode }) => children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}
