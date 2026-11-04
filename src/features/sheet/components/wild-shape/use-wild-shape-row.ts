import { use } from 'react'
import { WildShapeContext } from './context'

/**
 * Whether the row by this id is the character's Wild Shape row, as its sheet says, for Features to
 * draw it as an action's row, with its controls and its line.
 */
export function useWildShapeRow(id: string): boolean {
  return use(WildShapeContext).block?.item === id
}
