import { useState } from 'react'
import { useCreatureChoice } from './use-creature-choice'
import { NO_KEYS } from '@/features/table/constants'
import {
  mountedPanes,
  NO_ROW,
  nextRow,
  waitingCompanions,
  withMark,
} from '@/features/table/utils/companion-row-state'
import { useWaitingCompanions } from '@/hooks/use-waiting-prompts'
import type {
  CompanionRow,
  PaneMarks,
  PaneReporters,
  Tab,
} from '@/features/table/types'
import type { TableView } from '@/types/table'

/**
 * The character's companions (module 0.36.0), as the row of tabs above the sheet shows them:
 * those the module lists, and those it no longer lists, kept until the player has seen they've
 * gone; each name numbered where the row repeats it, each number kept while it does.
 */
function useRow(companions: TableView['companions']) {
  const [kept, setKept] = useState(() => nextRow(NO_ROW, companions, NO_KEYS))
  // Those whose panes were told they're gone (404) while the page still listed them, as one that
  // leaves and comes back between two of the page's polls: mounted afresh as a later view lists
  // them, since a pane told so asks no more.
  const [lost, setLost] = useState<ReadonlySet<string>>(NO_KEYS)
  let shownRow = kept
  if (kept.listed !== companions) {
    shownRow = nextRow(kept, companions, kept.dismissed, lost)
    setKept(shownRow)
    if (lost.size > 0) setLost(NO_KEYS)
  }
  return { shownRow, setKept, setLost }
}

/**
 * What each companion's pane says of itself: damage to roll, which its tab marks while it's
 * hidden, and a roll on its way, while the page must keep it; and the panes mounted, most recently
 * shown first: each as it's first chosen, kept as others are, at most four, the least recently
 * shown with nothing to roll or on its way going. One whose tab has gone goes with it, and with it
 * what it said of itself.
 * @param onLost - Told a pane's route said its companion is gone, by its key.
 */
function usePanes(
  rowKeys: readonly string[],
  chosen: string,
  onLost: (key: string) => void,
) {
  const [paneMarks, setPaneMarks] = useState<ReadonlyMap<string, PaneMarks>>(
    () => new Map(),
  )
  const [reporters] = useState(() => new Map<string, PaneReporters>())
  const reportersOf = (key: string): PaneReporters => {
    let held = reporters.get(key)
    if (!held) {
      held = {
        onPending: pending =>
          setPaneMarks(marks => withMark(marks, key, { pending })),
        onBusy: busy => setPaneMarks(marks => withMark(marks, key, { busy })),
        onReconnecting: reconnecting =>
          setPaneMarks(marks => withMark(marks, key, { reconnecting })),
        onLost: () => onLost(key),
      }
      reporters.set(key, held)
    }
    return held
  }
  const [mounted, setMounted] = useState<readonly string[]>([])
  const panes = mountedPanes(mounted, rowKeys, chosen, paneMarks)
  if (panes.join('|') !== mounted.join('|')) {
    setMounted(panes)
    if ([...paneMarks.keys()].some(key => !panes.includes(key))) {
      setPaneMarks(
        new Map([...paneMarks].filter(([key]) => panes.includes(key))),
      )
    }
  }
  return { paneMarks, reportersOf, panes }
}

/**
 * The row of the character's companions above the sheet (module 0.36.0), with the one chosen, the
 * panes mounted and what each says of itself, and those the game asks a save of (module 0.41.0).
 * @param seatKey - The seat's key, which the creature chosen is kept by.
 * @param show - Shows one of the table's tabs.
 * @returns The row, its names, numbers and how often each has come back; those asked; the one
 *   chosen, and `choose`; the panes mounted, what each says of itself and how it says so; whether
 *   the chosen one's pane can't read its view; and `openCompanion`, which chooses one, shows the
 *   Character tab and focuses its tab.
 */
export function useCompanionRow({
  view,
  seatKey,
  show,
}: {
  view: TableView
  seatKey: string
  show: (tab: Tab) => void
}): CompanionRow {
  // From module 0.41.0, those the game asks of the character's companions, which each one's tab
  // marks.
  const companionsAsked = useWaitingCompanions(
    view.connected ? view.companionPrompts : undefined,
  )
  const { shownRow, setKept, setLost } = useRow(view.companions)
  const { row, names, numbers, generations } = shownRow
  const rowKeys = row.map(({ key }) => key)
  // Those companions asked whose tabs the row shows, not gone, in the order first asked: the
  // character's own banner says so, with a way to each one's tab (module 0.41.0).
  const waiting = waitingCompanions(companionsAsked, row, names)
  const waitingKeys = new Set(waiting.map(({ key }) => key))
  const [chosen, chooseKept] = useCreatureChoice(seatKey, rowKeys)
  const goneKeys = new Set(row.flatMap(({ key, gone }) => (gone ? [key] : [])))
  // A gone companion's tab goes once it has been shown and another is chosen.
  const choose = (next: string) => {
    if (next !== chosen && goneKeys.has(chosen)) {
      setKept(held =>
        nextRow(held, held.listed, new Set(held.dismissed).add(chosen)),
      )
    }
    chooseKept(next)
  }
  const { paneMarks, reportersOf, panes } = usePanes(rowKeys, chosen, key =>
    setLost(keys => (keys.has(key) ? keys : new Set(keys).add(key))),
  )
  // A companion's tab, from the turn panel's "its tab" (module 0.36.0): chosen, shown, focused.
  const openCompanion = (key: string) => {
    choose(key)
    show('character')
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`#${CSS.escape(`creature-tab-${key}`)}`)
        ?.focus(),
    )
  }
  return {
    row,
    names,
    numbers,
    generations,
    rowKeys,
    waiting,
    waitingKeys,
    chosen,
    choose,
    paneMarks,
    reportersOf,
    panes,
    reconnecting: paneMarks.get(chosen)?.reconnecting === true,
    openCompanion,
  }
}
