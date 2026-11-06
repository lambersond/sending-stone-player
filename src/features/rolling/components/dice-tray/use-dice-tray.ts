'use client'

import { useTray } from '@lambersond/3d-dice-react'
import { canStep, roomFor, toPlainRoll, trayDice } from './utils'
import { useDiceEntry } from '@/features/rolling/components/dice-entry/use-dice-entry'
import { useSheetRoller } from '@/features/rolling/hooks/use-sheet-roller'
import { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import { useTableRole } from '@/hooks/use-table-api'
import { plainRollReach } from '@/utils/plain-roll-words'
import type { LocalFormula, RollFeature, RollKind } from '@/types/roll'
import type { DieSides } from '@lambersond/3d-dice-core'

/**
 * The chat's dice tray (v0.44): the dice the player picks, by the dice library's tray, and a number
 * added, kept after each roll until cleared; no more than 20 dice, and the number from −100 to
 * +100. Each roll is thrown on the page's renderer, or with Manual Dice on typed in through a dice
 * dialog of the tray's own, and sent to the game as a plain roll of the character's where it takes
 * one and Send to the table is on, by a way to the game of the tray's own, apart from the sheet's,
 * so that it's never among the sheet's rolls. Must be used within a DiceRendererProvider.
 * @param characterId - The character it rolls as, or for the Gamemaster's seat its key.
 * @param kinds - The rolls the game takes from the seat now.
 * @param typing - Whether the player types in what their own dice show.
 * @returns The dice, smallest first, and the number added; whether one more die may be added; the
 *   ways to change them and to roll; whether dice tumble now, before they land; the latest roll and
 *   its way to the game; whether the game makes these, and if not why; and the tray's dice dialog,
 *   to put on the page.
 */
export function useDiceTray({
  characterId,
  kinds = [],
  features,
  typing,
}: Readonly<{
  characterId: string
  kinds?: readonly RollKind[]
  features?: readonly RollFeature[]
  typing: boolean
}>) {
  const tray = useTray()
  const table = useTableRolls(characterId, kinds, features)
  const entry = useDiceEntry()
  const { rollFormula, rolls, rolling } = useSheetRoller(
    undefined,
    undefined,
    table.sendFormula,
    typing ? entry.enter : undefined,
  )
  const role = useTableRole()
  const dice = trayDice(tray.poolList)
  const bonus = tray.modifier
  const room = roomFor(dice)
  const latest = rolls.find(
    (roll): roll is LocalFormula => roll.kind === 'formula',
  )
  return {
    dice,
    bonus,
    room,
    add: (sides: DieSides) => {
      if (room) tray.incrementDie(sides)
    },
    remove: tray.decrementDie,
    step: (by: 1 | -1) => {
      if (canStep(bonus, by)) {
        tray.bumpModifier(by > 0 ? 'plusOne' : 'minusOne')
      }
    },
    clear: tray.clear,
    roll: () => {
      if (dice.length > 0) void rollFormula(toPlainRoll(dice, bonus))
    },
    rolling,
    latest: latest && { roll: latest, state: table.states.get(latest.id) },
    reach: plainRollReach(kinds, table.sending, role),
    dialog: entry.dialog,
  }
}
