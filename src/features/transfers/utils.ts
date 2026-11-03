import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'

/** Whether an item may hold anything: a container, unless it's known to hold nothing. */
export function mayHold(item: SheetItem | SheetContainer): boolean {
  return (
    'contents' in item && (item.contents === null || item.contents.length > 0)
  )
}

/** Any whole coin: dnd5e 6 may hold part of one, which can't be moved. */
export function anyCoins(currency: SheetCurrency[] | undefined): boolean {
  return !!currency?.some(coin => Math.floor(coin.value) >= 1)
}
