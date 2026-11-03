'use client'

import { allApplied } from '../../utils/enchantments'
import { EndButton } from '../enchantments/end-button'
import { useEnchanting } from '../enchantments/use-enchanting'
import { EnchantSwitch } from './enchant-switch'
import { UseChip } from './use-chip'
import { profileName } from './utils'
import type { DamageModifiers } from '@/types/roll'
import type {
  SheetAction,
  SheetEnchant,
  SheetUses,
} from '@/types/sending-stone'

/**
 * Using an enchant activity in the game, while the game takes spells and features: for one that
 * enchants its own item and spends nothing, such as a Flame Tongue's Engulf in Flames, a switch,
 * on while it's enchanted, that applies it or ends it, as dnd5e uses it again to end it; for one
 * that enchants its own item in every way it may already, such as Dagger of Venom's Coat Blade
 * once the blade is coated, a button that ends it, as using it again would only end it at a cost,
 * saying the item as the sheet lists it, not as the activity's row is named, such as "Dagger of
 * Venom (Coat Blade)" beneath the dagger; or else one that uses it, as any other.
 */
export function EnchantChip({
  action,
  enchant,
  onUse,
  uses,
}: Readonly<{
  action: SheetAction
  enchant: SheetEnchant
  onUse: (modifiers?: DamageModifiers) => void
  uses?: SheetUses | null
}>) {
  const { belongings } = useEnchanting()
  if (enchant.toggle) {
    return <EnchantSwitch action={action} enchant={enchant} onUse={onUse} />
  }
  const [applied] = enchant.applied
  if (applied && action.activity && allApplied(enchant)) {
    return (
      <EndButton
        item={applied.item}
        itemName={belongings?.get(applied.item)?.name ?? action.name}
        enchantment={{
          id: applied.effect,
          name: profileName(enchant, applied.profile, action),
        }}
        source={{ item: action.id, activity: action.activity.id }}
        className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/20'
      />
    )
  }
  return <UseChip action={action} onUse={onUse} uses={uses} />
}
