'use client'

import { Sparkles } from 'lucide-react'
import { joinParts } from '../../utils/join-parts'
import { EndButton } from './end-button'
import { enchantmentParts } from '@/features/sheet/utils/enchantments'
import type { SheetEnchantment } from '@/types/sending-stone'

/**
 * The enchantments on an item, once it's open: each one's name, whether it lasts while its caster
 * concentrates, the time it has left, or that it has run out, and what put it there; and for one
 * the player may end, while the game takes it, a button that ends it, once they say so.
 */
export function EnchantmentList({
  item,
  itemName,
  enchantments,
}: Readonly<{
  /** The item's id. */
  item: string
  itemName: string
  enchantments?: SheetEnchantment[]
}>) {
  if (!enchantments?.length) return
  return (
    <ul aria-label='Enchantments' className='flex flex-col gap-1.5'>
      {enchantments.map(enchantment => {
        const rest = joinParts(...enchantmentParts(enchantment))
        return (
          <li
            key={enchantment.id}
            className='flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs'
          >
            <Sparkles aria-hidden className='size-3.5 shrink-0 text-primary' />
            <span className='min-w-0 flex-1'>
              <span className='font-semibold'>{enchantment.name}</span>
              {rest && <span className='text-text-secondary'> · {rest}</span>}
            </span>
            {enchantment.endable && (
              <EndButton
                item={item}
                itemName={itemName}
                enchantment={enchantment}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
