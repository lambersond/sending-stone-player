import type {
  SheetItem,
  SheetContainer,
  SheetCurrency,
} from '@/types/sending-stone'
import type { ReactNode } from 'react'

/**
 * Where a party's sheet takes into, as its page says. Only data, as a server page passes it: the
 * API a pick is taken through is built here.
 */
export type TakeInto =
  /** A player's character, or the character a Gamemaster's page is on. */
  | { kind: 'own'; actorId: string; name: string; api: string }
  /** The Gamemaster's party page: picked in the dialog. */
  | { kind: 'choose'; campaignId: string }

/** What a sheet shows to move its items and coins, by where it shows it. */
export type TransferControls = {
  /** For an item row: beside its quantity (`aside`), and once opened (`body`). */
  item?: (
    item: SheetItem | SheetContainer,
  ) => { aside?: ReactNode; body?: ReactNode } | undefined
  /** Beside the Currency fact's coins. */
  coins?: (currency: SheetCurrency[]) => ReactNode
  /**
   * From module 0.32.0's feedback: what "Send to…" in an item's own menu opens for it, on a
   * right-click or long-press of its row. Unset where it can't be sent from here.
   */
  send?: (item: SheetItem | SheetContainer) => (() => void) | undefined
  /**
   * From module 0.33.0: "Remove…" in an item's own menu, on a character's sheet: what opens its
   * confirmation, and whether it waits, as while a move or a removal of it is on its way. Unset
   * where nothing is removed from here, as on a party's sheet.
   */
  remove?: (
    item: SheetItem | SheetContainer,
  ) => { open: () => void; waiting: boolean } | undefined
  /**
   * From module 0.33.0's feedback, on a party's sheet: what's on its way, by item id and `coins`,
   * said by one spinner beside the Currency label or the item's name, its buttons disabled with
   * none of their own. Unset on a character's sheet, whose buttons say it themselves.
   */
  waiting?: ReadonlySet<string>
}
