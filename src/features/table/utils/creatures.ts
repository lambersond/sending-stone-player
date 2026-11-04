import { isTurnOf } from './combat'
import { switcherWords } from '@/utils/wild-shape-words'
import type { SwitcherCreature } from '@/features/companions/types'
import type { PaneMarks } from '@/features/table/types'
import type { RowCompanion, TableView } from '@/types/table'

/**
 * The creatures the row of tabs above the sheet switches between (module 0.36.0): the character,
 * then its companions in the row's order, each with its news, what its tab says of it while it
 * isn't the one shown.
 * @param character - The character's name.
 * @param asking - Whether the game asks a save of the character that still waits.
 * @param asksForRoll - How the seat's tabs say the game asks one.
 * @param waitingKeys - The companions asked a save that still waits, by key.
 * @param paneMarks - What each companion's pane says of itself.
 */
export function switcherCreatures({
  character,
  view,
  asking,
  asksForRoll,
  row,
  numbers,
  waitingKeys,
  paneMarks,
}: {
  character: string
  view: TableView
  asking: boolean
  asksForRoll: string
  row: readonly RowCompanion[]
  numbers: ReadonlyMap<string, number>
  waitingKeys: ReadonlySet<string>
  paneMarks: ReadonlyMap<string, PaneMarks>
}): SwitcherCreature[] {
  return [
    {
      key: 'self',
      name: character,
      portrait: view.sheet?.portrait,
      // What the character is transformed into, from module 0.40.0, as its name says it.
      ...(view.sheet?.form && { shape: switcherWords(view.sheet.form) }),
      news: [
        asking && asksForRoll,
        isTurnOf(view.combat, ({ side }) => side === 'me') && ', your turn',
      ]
        .filter(Boolean)
        .join(''),
    },
    ...row.map(
      ({ key, name, portrait, kind, from, gone }): SwitcherCreature => ({
        key,
        name,
        number: numbers.get(key),
        portrait,
        kind,
        from,
        gone,
        news: gone
          ? ''
          : [
              // What the game asks of it, from module 0.41.0, as the character's own tab says.
              waitingKeys.has(key) && asksForRoll,
              isTurnOf(view.combat, combatant => combatant.companion === key) &&
                ', its turn',
              paneMarks.get(key)?.pending && ', damage to roll',
            ]
              .filter(Boolean)
              .join(''),
      }),
    ),
  ]
}
