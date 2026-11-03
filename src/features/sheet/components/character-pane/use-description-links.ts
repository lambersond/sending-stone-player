import { sheetTools } from '../description-actions/utils'
import { blockedReason } from './utils'
import type { Command, PaneRoller, PaneTable, UnlessLocked } from './types'
import type { ShowConditions } from '../conditions/types'
import type { DescriptionActions } from '../description-actions/types'
import type { RollKind, SheetRoll } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { TableSheet } from '@/types/table'

/**
 * What the links in descriptions do, on every tab, favorite and dialog: each roll they make, and
 * the table asked, shows in the tray, whichever tab it's on (`described`); nothing rolls once the
 * pane's rolls are locked.
 * @param onRoll - A roll as the pane makes it, an attack picked at first.
 * @param rollsToTable - The rolls the game takes now.
 */
export function useDescriptionLinks({
  table,
  roller: { rollDamage, rollFormula, logAsk },
  onRoll,
  sheet,
  role,
  rollsToTable,
  setDescribed,
  unlessLocked,
  command,
  showConditions,
}: Readonly<{
  table: PaneTable
  roller: Pick<PaneRoller, 'rollDamage' | 'rollFormula' | 'logAsk'>
  onRoll: (request: SheetRoll) => void
  sheet: TableSheet
  role: SeatRole
  rollsToTable?: RollKind[]
  setDescribed: (described: boolean) => void
  unlessLocked: UnlessLocked
  command: Command
  showConditions: ShowConditions
}>): DescriptionActions {
  return {
    roll: unlessLocked(request => {
      setDescribed(true)
      onRoll(request)
    }),
    rollDamage: unlessLocked(request => {
      setDescribed(true)
      void rollDamage(request)
    }),
    rollFormula: unlessLocked(request => {
      setDescribed(true)
      void rollFormula(request)
    }),
    takes: table.takes,
    // A description's damage at the table: changed, where the game takes it so, which it does
    // only from module 0.19.0, whose sheets say how it makes a critical hit's, and on its first
    // die whatever its sign before module 0.21.0; and as one, where they say how.
    ...(table.takes('textDamage') && {
      damage: {
        modifies: table.modifiesText && sheet.critical !== undefined,
        signed: table.signsText,
        ...(sheet.critical && { critical: sheet.critical }),
      },
    }),
    ask: unlessLocked(({ label, text, link }) => {
      if (!table.takes('ask')) return
      setDescribed(true)
      command(
        () => logAsk(label),
        logged => table.sendAsk(logged, { text, link }),
        { acts: false },
      )
    }),
    askBlocked: blockedReason('ask', table, role, rollsToTable),
    useBlocked: blockedReason('use', table, role, rollsToTable),
    // Where only this device's switch keeps the table from being asked, a way to turn it on, as
    // the switch in the sheet's settings is a step away.
    ...(table.available &&
      !table.sending &&
      rollsToTable?.includes('ask') && {
        sendRolls: () => table.setSending(true),
      }),
    abilities: sheet.abilities,
    skills: sheet.skills,
    tools: sheetTools(sheet),
    proficiency: sheet.proficiency,
    conditions: sheet.conditions,
    rules: sheet.rules,
    showConditions,
  }
}
