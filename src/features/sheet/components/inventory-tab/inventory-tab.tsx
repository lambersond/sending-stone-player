'use client'

import { type ReactNode } from 'react'
import { useActionRows } from '../action-entry/use-action-rows'
import { PartySheetList } from '../party-sheets/party-sheet-list'
import { WildShapeNote } from '../wild-shape/wild-shape-note'
import { Holdings } from './holdings'
import { InventoryList } from './inventory-list'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import { Transferring } from '@/features/transfers/components/transferring/transferring'
import { NO_TRANSFERS } from '@/features/transfers/constants'
import type { TableDamage } from '../action-entry/types'
import type { PartySheets } from '../party-sheets/types'
import type { TransferControls } from '@/features/transfers/types'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
  DamageModifiers,
} from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The character's inventory, as dnd5e's Inventory tab shows it to its player: coin, load and
 * attunement, items by type, and containers, each opening to what it holds. What an item rolls is
 * beside it, as on the Actions tab, whether it's equipped or not: each a button that rolls it, or
 * uses it in the Gamemaster's game while the game takes items' uses. From module 0.31.0, its items
 * and coins may be moved from here, with the controls given: on this tab alone, never among the
 * favorites. The party sheets the seat may open are under the coin, each opening in its side panel.
 */
export function InventoryTab({
  characterId,
  sheet,
  favorites,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
  transfers,
  parties,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses an item in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
  /** How its items and coins are moved, while the game takes moves. */
  transfers?: TransferControls
  /** The party sheets the seat may open, from module 0.30.0. */
  parties?: PartySheets
}>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    sheet,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  const { inventory } = sheet
  const { currency, encumbrance, attunement } = inventory
  // Unique on the page, where a companion's pane is mounted beside its character's.
  const idPrefix = useSheetId('inventory')
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {/* While transformed, as by Wild Shape (module 0.40.0): the form's, not the character's. */}
      <WildShapeNote tab='inventory' />
      {favorites}
      <Transferring controls={transfers ?? NO_TRANSFERS}>
        {(currency.length > 0 || encumbrance || attunement) && (
          <Holdings inventory={inventory} />
        )}
        {parties && <PartySheetList {...parties} />}
        <InventoryList
          characterId={characterId}
          inventory={inventory}
          rows={rows}
          idPrefix={idPrefix}
        />
      </Transferring>
      {dialogs}
    </div>
  )
}
