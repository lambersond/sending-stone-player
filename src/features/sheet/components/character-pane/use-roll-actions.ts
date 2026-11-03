import { actionTitle } from '../action-entry/utils'
import { selfPick } from '../use-picker/utils'
import { itemCastOf } from './utils'
import { sheetActions } from '@/utils/sheet-actions'
import type {
  PaneActions,
  PanePicking,
  PaneRoller,
  PaneTable,
  UnlessLocked,
} from './types'
import type { TableDamage } from '../action-entry/types'
import type { RollDue } from '@/features/rolling/types'
import type {
  DamageModifiers,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/types/roll'
import type { FavoriteEntry, SheetAction } from '@/types/sending-stone'
import type { TableCombat, TableSheet } from '@/types/table'

/**
 * What the pane's tabs and favorites roll and use, once for all of them: each roll, an attack at a
 * combatant picked first where the game makes it; a use, at those picked, or its damage while
 * it's due; damage and formulas; and what the game takes of damage. Nothing rolls once the pane's
 * rolls are locked, as a gone companion's are (module 0.36.0).
 * @param picking - The picker: `ask` opens it where there's anything to pick, saying whether it
 *   did.
 */
export function useRollActions({
  table,
  roller: { roll, rollFormula },
  picking: { ask, makeUse, pickAlone },
  unlessLocked,
  rollDue,
  onRollDamage,
  sheet,
  entries,
  combat,
}: Readonly<{
  table: PaneTable
  roller: Pick<PaneRoller, 'roll' | 'rollFormula'>
  picking: PanePicking
  unlessLocked: UnlessLocked
  rollDue: RollDue
  onRollDamage: (request: SheetDamageRoll) => void
  sheet: TableSheet
  entries: FavoriteEntry[]
  combat?: TableCombat
}>): PaneActions {
  // An attack the game makes is made at a combatant the player picks first, in a combat, and with
  // the slot, ammunition or mode they choose, where there's more than one.
  const onRoll = unlessLocked((asked: SheetRoll) => {
    const { source } = asked
    const attack =
      source?.kind === 'attack'
        ? sheetActions(sheet, entries).find(
            ({ id, attackId }) =>
              id === source.item && attackId === source.activity,
          )
        : undefined
    // Where dnd5e gives the attack Elven Accuracy, a third d20 with advantage, typed in, whatever
    // the table takes; from 0.42.1 on its own line, skipped for the game only where it's sent.
    const request: SheetRoll = attack?.elvenAccuracy
      ? { ...asked, elvenAccuracy: true }
      : asked
    const action = table.takes('attack') ? attack : undefined
    if (action && ask({ kind: 'attack', action, request })) return
    void roll(action ? { ...request, ...itemCastOf(action) } : request)
  })
  // A spell or feature the game uses: at the combatants the player picks, in a combat, and with
  // the slot they choose, its damage changed as they chose, if they did; or, while its damage is
  // due, that damage rolled. One made at its user by default, as a potion, with no one to pick, as
  // out of a combat, is made at them, where it may be; any other at no one.
  const onUse = (action: SheetAction, modifiers?: DamageModifiers) => {
    if (!action.activity) return
    const due = table.dueFor({ item: action.id, activity: action.activity.id })
    if (due) {
      rollDue(actionTitle(action), due, undefined, modifiers)
      return
    }
    if (ask({ kind: 'use', action, modifiers })) return
    const at = selfPick(action, combat, table.selfTargets)
    makeUse(action, at ?? { targets: [] }, modifiers)
  }
  // While the game takes damage, or damage on its own or recharges from module 0.36.0: which it
  // waits for, whether it takes it changed, whether it goes on its own, and whether a recharge is
  // rolled here. A game may take recharges and not damage, as with Midi-QOL's activities and the
  // module's integration off, whatever this device's switch for damage on its own.
  const tableDamage: TableDamage | undefined =
    table.takes('damage') || table.sendsAlone || table.takes('recharge')
      ? {
          modifies: table.modifies,
          dueFor: table.dueFor,
          sendsAlone: table.sendsAlone,
          recharges: table.takes('recharge'),
          // Its choices, from module 0.41.0, where the game takes them.
          ...(table.aloneChoices && { pickAlone }),
        }
      : undefined
  return {
    onRoll,
    onRollDamage,
    // Hit dice spent, or a formula rolled, such as a light's radius.
    onRollFormula: unlessLocked((request: SheetFormulaRoll) => {
      void rollFormula(request)
    }),
    onUse: table.takes('use') ? onUse : undefined,
    tableDamage,
  }
}
