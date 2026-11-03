import { createContext, use } from 'react'
import type { Belonging } from '@/features/sheet/types'
import type { AttackSource, TableRollState } from '@/types/roll'
import type { SheetEnchantment } from '@/types/sending-stone'

/** An enchantment ended: on which of the character's items, its effect's id, and its name. */
export type EndEnchantment = (
  item: string,
  enchantment: Pick<SheetEnchantment, 'id' | 'name'>,
  /** The enchant activity's switch or chip it's ended from, if any, which then follows it. */
  source?: AttackSource,
) => void

/**
 * What the sheet does with enchantments: end one, while the Gamemaster's game takes it; follow the
 * latest use of an enchant activity at the table, or the end of what it applied; and name the item
 * one is on as the sheet lists it.
 */
export type EnchantActions = {
  end?: EndEnchantment
  latestFor?: (source: AttackSource) => TableRollState | undefined
  /** What the character has, by id, with its name as the sheet lists it. */
  belongings?: ReadonlyMap<string, Belonging>
}

/** Nothing, until it's given, as where the game takes nothing. */
export const Actions = createContext<EnchantActions>({})

/** What the sheet does with enchantments, as it's given. */
export function useEnchanting(): EnchantActions {
  return use(Actions)
}
