import { useCallback, useEffect, useRef } from 'react'
import { follow } from '@/utils/lifecycle'
import type { RollRequestInput, TableRollState } from '@/types/roll'

/**
 * Requests sent to the game and followed, each given up on as the page is left: what becomes of
 * one is told until then, and nothing after.
 * @returns `follow(api, input, onState, onTaken?)`, the same function on every render: it sends
 * `input` through the seat's API base, such as `/api/characters/<id>`, tells `onState` each way it
 * learns, and `onTaken` the id the app took it under.
 */
export function useFollow() {
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])
  return useCallback(
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
}
