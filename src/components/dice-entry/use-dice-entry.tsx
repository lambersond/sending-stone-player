'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { DiceEntryDialog } from './dice-entry-dialog'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'

/** A roll's dice asked for, until the player types them in or it closes. */
type Asked = {
  entry: DiceEntry
  /** Gives the roll what was typed, or nothing; only the first time counts. */
  settle: (values?: number[][]) => void
}

/**
 * Asks the player for each roll's dice, from their own physical dice (module 0.32.0): one dialog
 * at a time, each roll asked for in turn, first come first asked, the next opening as the last
 * closes. One whose answer is answered or closed elsewhere is given nothing, open or waiting its
 * turn, as is every one still asked for once the sheet goes. The dialog stays on the page, only
 * closed between rolls, as only the browser's own close gives focus back to what opened it.
 * @returns `enter`, the same function each time, to ask with; and the dialog, to put on the page.
 */
export function useDiceEntry(): { enter: EnterDice; dialog: ReactNode } {
  const [queue, setQueue] = useState<readonly Asked[]>([])
  // Everything asked for and not yet settled, for the sheet going to give each nothing.
  const pending = useRef(new Set<Asked>())

  const enter = useCallback<EnterDice>(
    entry =>
      new Promise(resolve => {
        const { signal } = entry
        if (signal?.aborted) {
          // eslint-disable-next-line unicorn/no-useless-undefined -- nothing typed in
          resolve(undefined)
          return
        }
        const asked: Asked = {
          entry,
          settle: values => {
            if (!pending.current.delete(asked)) return
            signal?.removeEventListener('abort', closed)
            setQueue(held => held.filter(each => each !== asked))
            resolve(values)
          },
        }
        const closed = () => asked.settle()
        signal?.addEventListener('abort', closed, { once: true })
        pending.current.add(asked)
        setQueue(held => [...held, asked])
      }),
    [],
  )

  useEffect(() => {
    const asked = pending.current
    return () => {
      for (const each of asked) each.settle()
    }
  }, [])

  const [current] = queue
  const dialog = (
    <DiceEntryDialog
      entry={current?.entry}
      onDone={values => current?.settle(values)}
      onCancel={() => current?.settle()}
    />
  )
  return { enter, dialog }
}
