import { useMemo, type ReactNode } from 'react'
import { useD20Rolls } from '../../../rolling/components/d20-rolls/use-d20-rolls'
import { useActionInfo } from '../action-info/action-info'
import { useDescriptionActions } from '../description-actions/use-description-actions'
import { useLinkMenus } from '../description-link/description-link'
import { useDamageRolls } from './action-entry'
import { castIndex } from '@/utils/casts'
import type { TableDamage, ActionRows } from './types'
import type {
  SheetRoll,
  SheetDamageRoll,
  SheetFormulaRoll,
  DamageModifiers,
} from '@/types/roll'
import type { CharacterSheet, SheetAction } from '@/types/sending-stone'

/**
 * What every action's row needs, on a tab or among the favorites, with the menus and dialogs its
 * rolls open in `dialogs`, to be put on the page.
 */
export function useActionRows({
  characterId,
  sheet,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  /** Its spellbook, and wherever a spell an item casts is listed with how it's cast. */
  sheet: Pick<
    CharacterSheet,
    'spells' | 'actions' | 'inventory' | 'features' | 'favorites'
  >
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>): { rows: ActionRows; dialogs: ReactNode } {
  const spellbook = sheet.spells
  const casts = useMemo(() => castIndex(sheet), [sheet])
  const { actions: d20, dialogs } = useD20Rolls(onRoll)
  // A check an activity asks for rolls as a description's does, against its DC; and damage on its
  // own asks its kind from its chip, as a description's damage does.
  const { menus, dialogs: checks } = useLinkMenus(useDescriptionActions())
  const { actions: damage, dialogs: damageMenu } = useDamageRolls(
    onRollDamage,
    tableDamage,
    menus,
    spellbook,
  )
  const { show: about, dialog: info } = useActionInfo(characterId, spellbook)
  return {
    rows: {
      characterId,
      spellbook,
      casts,
      d20,
      damage,
      ...(onUse && {
        use: { onUse, sendsAlone: tableDamage?.sendsAlone === true },
      }),
      ...(onRollFormula && { formula: onRollFormula }),
      about,
      menus,
      recharges: tableDamage?.recharges === true,
    },
    dialogs: (
      <>
        {dialogs}
        {damageMenu}
        {info}
        {checks}
      </>
    ),
  }
}
