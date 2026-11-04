import { createElement, type ReactNode } from 'react'
import { EnchantedMark } from './enchanted-mark'
import { EnchantmentList } from './enchantment-list'
import type { SheetEnchantment } from '@/types/sending-stone'

/**
 * What a row the sheet lists as an entry shows of the enchantments on it: the mark that it's
 * enchanted, by its name, and once it's open, each of them. Nothing for one with none.
 */
export function enchantedEntry(
  entry: Readonly<{
    id: string
    name: string
    enchantments?: SheetEnchantment[]
  }>,
): { badge?: ReactNode; lead?: ReactNode } {
  if (!entry.enchantments?.length) return {}
  return {
    badge: createElement(EnchantedMark),
    lead: createElement(EnchantmentList, {
      item: entry.id,
      itemName: entry.name,
      enchantments: entry.enchantments,
    }),
  }
}
