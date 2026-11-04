import type {
  SheetAction,
  SheetActivity,
  SheetSpend,
} from '@/types/sending-stone'

/** One of an item's activities folded beneath it, to be read about. */
export type ActivityInfo = {
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  /** The item it's one of, as an action. */
  item: SheetAction
  /** Whether it's used only in Foundry, as the app neither rolls nor uses it. */
  foundry: boolean
}

/**
 * How the uses an action's row shows are spent from its facts, where its row folds them away in a
 * narrow list: what they're called, and what using it spends, as its count's button has them.
 */
export type UsesSpending = { name: string; spends?: SheetSpend[] }
