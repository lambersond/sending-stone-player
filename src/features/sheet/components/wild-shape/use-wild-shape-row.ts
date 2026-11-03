import { createRef, createContext, use } from 'react'
import type { WildShapeValue } from './use-wild-shape'

/** None, as at a creature's pane, and anywhere outside a pane. */
const NO_WILD_SHAPE: WildShapeValue = {
  on: false,
  pane: false,
  role: 'player',
  name: '',
  effects: false,
  offered: [],
  fromPicker: false,
  pick: () => {},
  change: () => {},
  pickBeast: () => {},
  learn: () => {},
  loadBeasts: () => {},
  openPicker: () => {},
  openKnown: () => {},
  showKnown: () => {},
  showLearn: () => {},
  back: () => {},
  close: () => {},
  openReturn: () => {},
  closeReturn: () => {},
  heading: createRef(),
  body: createRef(),
  panel: () => null,
}

export const WildShapeContext = createContext<WildShapeValue>(NO_WILD_SHAPE)

/**
 * Whether the row by this id is the character's Wild Shape row, as its sheet says, for Features to
 * draw it as an action's row, with its controls and its line.
 */
export function useWildShapeRow(id: string): boolean {
  return use(WildShapeContext).block?.item === id
}
