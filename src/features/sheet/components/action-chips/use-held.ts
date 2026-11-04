import { useState } from 'react'

/**
 * What the game said of something, held from when it said it until the sheet changes from how it
 * was then, as the sheet may come after it; and then, or with nothing said, as the sheet has it.
 * @param key - Which saying it is: another is held afresh.
 */
export function useHeld(
  key: string | undefined,
  said: boolean | undefined,
  sheet: boolean,
  sheetKey: string,
): boolean {
  const [held, setHeld] = useState<{
    key: string
    said: boolean
    sheetKey: string
    /** Whether the sheet has changed since, and is followed from then on. */
    letGo?: boolean
  }>()
  if (key !== held?.key) {
    setHeld(
      key === undefined || said === undefined
        ? undefined
        : { key, said, sheetKey },
    )
  } else if (held && !held.letGo && held.sheetKey !== sheetKey) {
    setHeld({ ...held, letGo: true })
  }
  return held && !held.letGo && held.sheetKey === sheetKey ? held.said : sheet
}
