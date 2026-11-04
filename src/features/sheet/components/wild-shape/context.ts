import { createContext, createRef } from 'react'
import type { WildShapeValue } from './types'

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
