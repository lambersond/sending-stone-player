import { LAYOUTS } from './constants'
import { useStoredChoice } from '@/hooks/use-stored'
import type { ActionsLayout, Layout } from './types'

const LAYOUT_IDS = LAYOUTS.map(({ id }) => id)

/** Where this browser keeps the layout chosen. */
export const LAYOUT_KEY = 'sending-stone:actions-layout'

/**
 * The layouts the Actions tab offers where it is this many pixels wide, and the one it shows: the
 * one this browser chose, where it's offered, or else the list. Choosing one keeps it in this
 * browser; listing where it doesn't fit leaves the choice kept, so a phone turned sideways gets
 * its table back.
 * @param width - How wide the Actions tab is, in pixels.
 */
export function useActionsLayout(width: number): ActionsLayout {
  const offered = LAYOUTS.filter(({ from }) => width >= from)
  const [chosen, choose] = useStoredChoice(LAYOUT_KEY, LAYOUT_IDS, 'list')
  const layout: Layout = offered.some(({ id }) => id === chosen)
    ? chosen
    : 'list'
  return { offered, layout, choose }
}
