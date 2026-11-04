'use client'

import { Facts } from '../action-info/facts'
import { castAs, spellFacts } from '../action-info/utils'
import { EnchantmentList } from '../enchantments/enchantment-list'
import { SheetText } from '../sheet-text/sheet-text'
import { metaOf, originOf } from './utils'
import { itemSpellOf } from '@/utils/sheet-actions'
import type { EntryLook } from './types'
import type { UsesSpending } from '../action-info/types'
import type {
  SheetAction,
  SheetSpellSection,
  SlotPool,
} from '@/types/sending-stone'

/**
 * All there is to know of an action once it's open: what it is, its facts, its description. An
 * item listed for a spell it casts opens to the spell: in full, as the Spells tab has it, where it
 * lists it under the item.
 */
export function ActionDetails({
  action,
  pools,
  characterId,
  spellbook,
  look = {},
  spending,
}: Readonly<{
  action: SheetAction
  pools: SlotPool[] | null
  characterId: string
  /** The character's spells, among which the spell an item is listed for is found. */
  spellbook: SheetSpellSection[]
  look?: EntryLook
  /** Where its row's count is folded away in a narrow list, how its uses are spent from here. */
  spending?: UsesSpending
}>) {
  const { cast } = action
  const spell = cast?.text
    ? itemSpellOf(spellbook, action.id, {
        name:
          action.activityName ?? action.activities?.[0]?.name ?? action.name,
        text: cast.text,
        casts: true,
        resolved: true,
      })
    : undefined
  const meta = look.meta ?? metaOf(action, spell)
  const text = cast?.text ?? action.text
  return (
    <>
      {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
      {look.lead}
      <Facts
        action={spell ? castAs(action, spell) : action}
        uses={look.uses}
        pools={pools}
        spending={spending}
        casting={!!spell}
        more={[
          ...(spell ? spellFacts(spell, cast) : []),
          ...(look.facts ?? []),
        ]}
      />
      <EnchantmentList
        item={action.id}
        itemName={action.name}
        enchantments={action.enchantments}
      />
      {look.moves}
      {text && (
        <SheetText
          characterId={characterId}
          hash={text}
          origin={originOf(action, spell)}
        />
      )}
    </>
  )
}
