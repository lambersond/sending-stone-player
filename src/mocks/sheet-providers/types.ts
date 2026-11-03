import type { useSheetRoller } from '@/features/rolling/hooks/use-sheet-roller'
import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { Concentrating } from '@/features/sheet/components/concentration/concentration'
import type { ConditionsOpener } from '@/features/sheet/components/conditions/conditions-panel'
import type { DescriptionLinks } from '@/features/sheet/components/description-actions/description-actions'
import type { Effecting } from '@/features/sheet/components/effect-controls/effect-controls'
import type { Enchanting } from '@/features/sheet/components/enchantments/enchantments'
import type { FavoriteMarks } from '@/features/sheet/components/favorite-mark/favorite-mark'
import type { Favoriting } from '@/features/sheet/components/favoriting/favoriting'
import type { Preparing } from '@/features/sheet/components/preparing/preparing'
import type { Charging } from '@/features/sheet/components/uses-button/uses-button'
import type { WildShaping } from '@/features/sheet/components/wild-shape/wild-shape'
import type { TableSeat } from '@/types/character'
import type { RollFeature, RollKind } from '@/types/roll'
import type { CreatureFacts, TableSheet } from '@/types/table'
import type { ComponentProps, ReactNode } from 'react'

/**
 * What SheetProviders is given: the sheet and the seat a pane would have, as CharacterPane's own
 * props name them, and, for any context, what it gives in place of what the pane's would.
 */
export type SheetProvidersProps = {
  sheet: TableSheet
  /** The character, whose API the rolls go through at a player's seat. `char-1` when unset. */
  characterId?: string
  /** The character's name, as the pane is given it. */
  name: string
  /** The Gamemaster's seat (TableApiContext); a player's page has none. */
  seat?: TableSeat
  rollsToTable?: RollKind[]
  rollFeatures?: RollFeature[]
  /** Whether the seat's player may change favorites, effects and Wild Shape, as the pane's. */
  favorites?: boolean
  effects?: true
  wildShape?: true
  /** A creature's pane rather than the character's (CreatureContext). */
  creature?: CreatureFacts
  /** Whether its rolls are locked, as a gone companion's (RollsLocked). */
  locked?: boolean
  /** What its ids begin with (SheetIdPrefix). */
  idPrefix?: string
  /** In place of the pane's, one each. */
  marks?: ComponentProps<typeof FavoriteMarks>['keys']
  favoriting?: ComponentProps<typeof Favoriting>['value']
  effecting?: ComponentProps<typeof Effecting>['value']
  wildShaping?: ComponentProps<typeof WildShaping>['value']
  showConditions?: ComponentProps<typeof ConditionsOpener>['show']
  descriptions?: ComponentProps<typeof DescriptionLinks>['actions']
  enchanting?: ComponentProps<typeof Enchanting>['actions']
  concentrating?: ComponentProps<typeof Concentrating>['actions']
  charging?: ComponentProps<typeof Charging>['actions']
  preparing?: ComponentProps<typeof Preparing>['value']
  children: ReactNode
}

/** A pane's rolls at the table, as `useTableRolls` gives them. */
export type PaneTable = ReturnType<typeof useTableRolls>

/** A pane's own dice and lines, as `useSheetRoller` gives them. */
export type PaneRoller = ReturnType<typeof useSheetRoller>
