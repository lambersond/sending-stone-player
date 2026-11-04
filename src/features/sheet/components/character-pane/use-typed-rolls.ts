import { useCallback, useMemo, useRef } from 'react'
import { useSheetRoller } from '@/features/rolling/hooks/use-sheet-roller'
import { effectDiceFor, offersFor } from '@/features/rolling/utils/effect-dice'
import type { PaneTable } from './types'
import type { useDiceEntry } from '@/features/rolling/components/dice-entry/use-dice-entry'
import type { LocalFormula, SheetFormulaRoll, TypedRolls } from '@/types/roll'
import type { TablePrompt, TableSheet } from '@/types/table'

/**
 * The pane's rolls (`roller`), thrown as the player's dice say where they type them in. A
 * recharge's d6, from module 0.36.0, goes to the game as one; any other formula as ever. While the
 * player types in their dice, from module 0.42.0, where the game takes them: the dice the
 * character's effects add to each roll, such as Bless's d4, by its sheet, and what the roll
 * answers, asked for after their own; and whether the dice typed are kept as rerolled at the
 * table, as their feature says. The dice of effects only of a roll the game is sent: one this
 * device keeps, a kind the game doesn't take, or a check an activity asks of a game that doesn't
 * make it so, is the player's alone, and no game would roll a die skipped. From 0.42.1, whether a
 * roll goes to the game whatever the game takes of it, for Elven Accuracy's third d20 to be
 * skipped, which every module since 0.32.0 throws itself where two are sent. And from module
 * 0.42.1, as the dice of effects are, the dice the sheet offers, such as Bardic Inspiration's, but
 * none whose effect a roll of this page spent already (`spent`, as `useSpentOffers` keeps it),
 * read as each roll is asked for, as the rolls come after this.
 * @param typing - Whether the player types in what their own dice show, each roll asking for them.
 */
export function useTypedRolls({
  table,
  sheet,
  prompts,
  typing,
  entry,
}: Readonly<{
  table: PaneTable
  sheet: TableSheet
  prompts?: TablePrompt[]
  typing: boolean
  entry: ReturnType<typeof useDiceEntry>
}>) {
  const { sendFormula, sendRecharge } = table
  const formulaThrown = useCallback(
    (thrown: SheetFormulaRoll, rolled: LocalFormula) => {
      if (thrown.recharge) {
        sendRecharge({ label: thrown.label, counter: thrown.recharge }, rolled)
      } else {
        sendFormula(thrown, rolled)
      }
    },
    [sendFormula, sendRecharge],
  )
  const { typedEffects, keptRerolls, sends } = table
  const spent = useRef<ReadonlySet<string>>(new Set())
  const typedRolls = useMemo<TypedRolls | undefined>(() => {
    if (!typing) return
    return {
      effectsFor: typedEffects
        ? request =>
            sends(request.source) ? effectDiceFor(sheet, request, prompts) : []
        : () => [],
      keptRerolls,
      sends: request => sends(request.source),
      offersFor: typedEffects
        ? request =>
            sends(request.source)
              ? offersFor(sheet, request, prompts).filter(
                  ({ spends }) => !spent.current.has(spends.effect),
                )
              : []
        : () => [],
    }
  }, [typing, typedEffects, keptRerolls, sends, sheet, prompts])
  const roller = useSheetRoller(
    table.send,
    table.sendDamage,
    formulaThrown,
    typing ? entry.enter : undefined,
    typedRolls,
  )
  return { roller, spent }
}
