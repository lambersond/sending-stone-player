import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { follow } from '@/utils/lifecycle'
import type { Follow } from './types'
import type { RollRequestInput, TableRollState } from '@/types/roll'

/**
 * A page's own `useFollow`, for what's sent from within it to be followed as long as the page is
 * open, not only while the part that sent it is (ROADMAP item 46): a party sheet over a character's
 * table may be closed while the game makes a move sent from it, and the table is still read again
 * as the game answers. Unset, each part's follows end with it.
 */
export const FollowContext = createContext<Follow | undefined>(undefined)

/**
 * Requests sent to the game and followed, each given up on as the page is left: what becomes of
 * one is told until then, and nothing after. Under a `FollowContext`, its page's.
 * @returns `follow(api, input, onState, onTaken?)`, the same function on every render: it sends
 * `input` through the seat's API base, such as `/api/characters/<id>`, tells `onState` each way it
 * learns, and `onTaken` the id the app took it under.
 */
export function useFollow(): Follow {
  const page = useContext(FollowContext)
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])
  const own = useCallback(
    (
      api: string,
      input: RollRequestInput,
      onState: (state: TableRollState) => void,
      onTaken: (id: string) => void = () => {},
    ) => {
      const controller = new AbortController()
      running.current.add(controller)
      const update = (state: TableRollState) => {
        if (controller.signal.aborted) return
        onState(state)
      }
      void follow(api, input, controller.signal, update, onTaken).finally(() =>
        running.current.delete(controller),
      )
    },
    [],
  )
  return page ?? own
}
