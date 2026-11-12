import { useCallback, useRef } from 'react'
import { READ_AGAIN_AFTER } from '@/constants/polling'

/**
 * A view's poll read again as a roll the game answered ends (ROADMAP item 39), as the character's
 * table (`useTableView`) and a companion's pane (`useCompanionView`) keep theirs: `readAgain` reads
 * at once, or as soon as a read on its way has come, and once more a moment later
 * (`READ_AGAIN_AFTER`), then at the poll's own pace.
 * @returns `readAgain`, the same function on every render, which reads nothing while no poll runs;
 *   and `pace`, which each run of the poll calls as it starts, with its signal, aborted as the run
 *   stops, and how it reads at once while it waits for its next read. `pace` gives the run its wait
 *   before each next read, from the one it would otherwise wait.
 */
export function useReadAgain() {
  // As the poll running has it; nothing before it starts, nor once it's stopped.
  const again = useRef(() => {})
  const readAgain = useCallback(() => again.current(), [])
  const pace = useCallback((signal: AbortSignal, readNow: () => void) => {
    // Whether the next read waits only a moment, as a roll the game answered has ended.
    let soon = false
    again.current = () => {
      if (signal.aborted) return
      soon = true
      // At once, unless a read is on its way: the next comes a moment after it either way.
      readNow()
    }
    return (otherwise: number) => {
      const wait = soon ? READ_AGAIN_AFTER : otherwise
      soon = false
      return wait
    }
  }, [])
  return { readAgain, pace }
}
