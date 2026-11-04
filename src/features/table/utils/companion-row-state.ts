import { NO_KEYS } from '@/features/table/constants'
import { companionRow, numberedNames } from '@/utils/companion-row'
import type {
  PaneMarks,
  RowState,
  WaitingCompanion,
} from '@/features/table/types'
import type {
  CompanionAsked,
  RowCompanion,
  TableCompanion,
} from '@/types/table'

/**
 * At most this many companions' panes stay mounted at once (module 0.36.0): the least recently
 * shown goes as another is chosen, unless it has damage to roll or a roll on its way.
 */
const MOST_PANES = 4

/** The row before any companion's been listed. */
export const NO_ROW: RowState = {
  dismissed: NO_KEYS,
  row: [],
  names: new Map(),
  numbers: new Map(),
  generations: new Map(),
}

/**
 * The row as it is now, from the row as it was: the companions listed now and those gone, kept
 * until dismissed, as `companionRow` keeps them. One listed again is no longer dismissed, and if
 * it had gone, or its pane was told it had, its pane is mounted afresh. Names are numbered as
 * `numberedNames` numbers them, the numbers given before kept.
 * @param listed - The companions the module lists now.
 * @param dismissed - The gone ones whose tabs have been shown and left.
 * @param lost - Those whose panes were told they're gone while the row still listed them.
 */
export function nextRow(
  held: RowState,
  listed: TableCompanion[] | undefined,
  dismissed: ReadonlySet<string>,
  lost: ReadonlySet<string> = NO_KEYS,
): RowState {
  const keys = new Set((listed ?? []).map(({ key }) => key))
  const left = [...dismissed].some(key => keys.has(key))
    ? new Set([...dismissed].filter(key => !keys.has(key)))
    : dismissed
  const row = companionRow(held.row, listed ?? [], left)
  let generations = held.generations
  for (const { key, gone } of held.row) {
    if ((gone || lost.has(key)) && keys.has(key)) {
      generations = new Map(generations).set(
        key,
        (generations.get(key) ?? 0) + 1,
      )
    }
  }
  const { names, kept } = numberedNames(row, held.numbers)
  return { listed, dismissed: left, row, names, numbers: kept, generations }
}

/** A pane's marks, with one changed: the same map where it's unchanged. */
export function withMark(
  marks: ReadonlyMap<string, PaneMarks>,
  key: string,
  change: PaneMarks,
): ReadonlyMap<string, PaneMarks> {
  const held = marks.get(key) ?? {}
  const next = { ...held, ...change }
  if (
    next.pending === held.pending &&
    next.busy === held.busy &&
    next.reconnecting === held.reconnecting
  ) {
    return marks
  }
  return new Map(marks).set(key, next)
}

/**
 * Those companions asked whose tabs the row shows, not gone, in the order first asked: the
 * character's own banner says so, with a way to each one's tab (module 0.41.0).
 */
export function waitingCompanions(
  asked: readonly CompanionAsked[],
  row: readonly RowCompanion[],
  names: ReadonlyMap<string, string>,
): WaitingCompanion[] {
  return asked.flatMap(({ key, label }) => {
    const shown = row.find(companion => companion.key === key)
    return shown && !shown.gone
      ? [{ key, label, name: names.get(key) ?? shown.name }]
      : []
  })
}

/**
 * The companions' panes mounted, most recently shown first: each as it's first chosen, kept as
 * others are, at most four, the least recently shown with nothing to roll or on its way going.
 * One whose tab has gone goes with it.
 */
export function mountedPanes(
  mounted: readonly string[],
  rowKeys: readonly string[],
  chosen: string,
  paneMarks: ReadonlyMap<string, PaneMarks>,
): string[] {
  let panes = mounted.filter(key => rowKeys.includes(key))
  if (chosen !== 'self' && panes[0] !== chosen) {
    panes = [chosen, ...panes.filter(key => key !== chosen)]
    while (panes.length > MOST_PANES) {
      const spare = panes.findLast(key => {
        const marks = paneMarks.get(key)
        return key !== chosen && !marks?.pending && !marks?.busy
      })
      if (spare === undefined) break
      panes = panes.filter(key => key !== spare)
    }
  }
  return panes
}
