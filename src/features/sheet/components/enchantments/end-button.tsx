'use client'

import { useEnchanting } from './use-enchanting'
import { ConfirmDialog } from '@/components/modal/confirm-dialog'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { AttackSource } from '@/types/roll'
import type { SheetEnchantment } from '@/types/sending-stone'

/**
 * A button that ends an enchantment on one of the character's items, once the player says so, as
 * dnd5e's chat card ends it: the enchantment alone, with what it added to the item, such as an
 * attack, its caster's concentration going on. Nothing while the game doesn't take it.
 */
export function EndButton({
  item,
  itemName,
  enchantment,
  source,
  className = 'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5',
}: Readonly<{
  item: string
  itemName: string
  enchantment: Pick<SheetEnchantment, 'id' | 'name'>
  /** The enchant activity it's ended from, if any. */
  source?: AttackSource
  className?: string
}>) {
  const { end } = useEnchanting()
  const { game } = seatWords(useTableRole())
  if (!end) return
  return (
    <ConfirmDialog
      trigger='End'
      triggerLabel={`End ${enchantment.name} on ${itemName}`}
      triggerClassName={className}
      title={`End ${enchantment.name}?`}
      confirmLabel='End'
      cancelLabel='Keep'
      onConfirm={async () => {
        end(item, enchantment, source)
      }}
    >
      <p>
        On {itemName}. Only the enchantment ends, as from its card in {game};
        what it added to the item, such as an attack, goes with it. Any
        concentration on it goes on.
      </p>
    </ConfirmDialog>
  )
}
